import { neon } from '@neondatabase/serverless'
import { NEON_DATABASE_URL } from './license-config.js'

/**
 * Resilient query executor with automatic retry for serverless cold-starts & transient ECONNRESET
 */
async function queryWithRetry(fn, retries = 3) {
  let lastErr = null
  for (let i = 1; i <= retries; i++) {
    try {
      if (!NEON_DATABASE_URL) {
        throw new Error('NEON_DATABASE_URL is not configured.')
      }
      const sql = neon(NEON_DATABASE_URL)
      return await fn(sql)
    } catch (err) {
      lastErr = err
      const isRetryable =
        err?.message?.includes('fetch failed') ||
        err?.message?.includes('ECONNRESET') ||
        err?.message?.includes('ETIMEDOUT') ||
        err?.sourceError?.code === 'ECONNRESET' ||
        err?.sourceError?.message?.includes('ECONNRESET')

      if (isRetryable && i < retries) {
        console.warn(`[Neon DB] Retry attempt ${i}/${retries} after transient connection drop...`)
        await new Promise((res) => setTimeout(res, 600 * i))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

let isTableMigrated = false

export async function ensureLicenseTable() {
  if (isTableMigrated) return true

  return await queryWithRetry(async (sql) => {
    await sql`
      CREATE TABLE IF NOT EXISTS system_licenses (
        id SERIAL PRIMARY KEY,
        machine_id VARCHAR(128) UNIQUE NOT NULL,
        mac_address VARCHAR(64) NOT NULL,
        hostname VARCHAR(128),
        os_info VARCHAR(128),
        activation_key VARCHAR(64) UNIQUE NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        customer_name VARCHAR(255),
        notes TEXT,
        first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        activated_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE,
        last_online_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `

    // Migrate additional columns if not present
    await sql`ALTER TABLE system_licenses ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);`
    await sql`ALTER TABLE system_licenses ADD COLUMN IF NOT EXISTS contact VARCHAR(128);`
    await sql`ALTER TABLE system_licenses ADD COLUMN IF NOT EXISTS city VARCHAR(128);`
    await sql`ALTER TABLE system_licenses ADD COLUMN IF NOT EXISTS address TEXT;`
    await sql`ALTER TABLE system_licenses ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 5;`
    await sql`ALTER TABLE system_licenses ADD COLUMN IF NOT EXISTS allowed_tabs TEXT DEFAULT 'ALL';`
    await sql`ALTER TABLE system_licenses ADD COLUMN IF NOT EXISTS users_data TEXT DEFAULT '[]';`
    await sql`ALTER TABLE system_licenses ADD COLUMN IF NOT EXISTS status_message TEXT;`
    await sql`ALTER TABLE system_licenses ADD COLUMN IF NOT EXISTS broadcast_message TEXT;`
    await sql`ALTER TABLE system_licenses ADD COLUMN IF NOT EXISTS monthly_invoice_limit INTEGER DEFAULT 0;`
    await sql`ALTER TABLE system_licenses ADD COLUMN IF NOT EXISTS watermark_enabled BOOLEAN DEFAULT TRUE;`
    await sql`ALTER TABLE system_licenses ADD COLUMN IF NOT EXISTS max_devices INTEGER DEFAULT 3;`
    await sql`ALTER TABLE system_licenses ADD COLUMN IF NOT EXISTS devices_data TEXT DEFAULT '[]';`
    await sql`ALTER TABLE system_licenses ADD COLUMN IF NOT EXISTS allow_updates BOOLEAN DEFAULT TRUE;`

    isTableMigrated = true
    return true
  })
}

export async function listLicenses() {
  await ensureLicenseTable()
  return await queryWithRetry(async (sql) => {
    const rows = await sql`
      SELECT * FROM system_licenses
      ORDER BY
        CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
        first_seen_at DESC
    `
    return rows
  })
}

export async function updateLicenseStatus({
  id,
  status,
  expires_at,
  customer_name,
  notes,
  max_users,
  max_devices,
  allowed_tabs,
  devices_data,
  users_data,
  status_message,
  broadcast_message,
  monthly_invoice_limit,
  watermark_enabled,
  allow_updates,
}) {
  await ensureLicenseTable()

  return await queryWithRetry(async (sql) => {
    const rows = await sql`
      UPDATE system_licenses
      SET
        status = COALESCE(${status !== undefined ? status : null}, status),
        expires_at = CASE WHEN ${expires_at !== undefined} THEN ${expires_at || null} ELSE expires_at END,
        activated_at = CASE WHEN ${status} = 'active' THEN NOW() ELSE activated_at END,
        customer_name = COALESCE(${customer_name !== undefined ? customer_name : null}, customer_name),
        notes = COALESCE(${notes !== undefined ? notes : null}, notes),
        max_users = COALESCE(${max_users !== undefined ? max_users : null}, max_users),
        max_devices = COALESCE(${max_devices !== undefined ? max_devices : null}, max_devices),
        allowed_tabs = COALESCE(${allowed_tabs !== undefined ? allowed_tabs : null}, allowed_tabs),
        devices_data = COALESCE(${devices_data !== undefined ? (typeof devices_data === 'string' ? devices_data : JSON.stringify(devices_data)) : null}, devices_data),
        users_data = COALESCE(${users_data !== undefined ? (typeof users_data === 'string' ? users_data : JSON.stringify(users_data)) : null}, users_data),
        status_message = CASE WHEN ${status_message !== undefined} THEN ${status_message || null} ELSE status_message END,
        broadcast_message = CASE WHEN ${broadcast_message !== undefined} THEN ${broadcast_message || null} ELSE broadcast_message END,
        monthly_invoice_limit = COALESCE(${monthly_invoice_limit !== undefined ? monthly_invoice_limit : null}, monthly_invoice_limit),
        watermark_enabled = COALESCE(${watermark_enabled !== undefined ? watermark_enabled : null}, watermark_enabled),
        allow_updates = COALESCE(${allow_updates !== undefined ? allow_updates : null}, allow_updates)
      WHERE id = ${id}
      RETURNING *;
    `
    return rows[0] || null
  })
}

export async function deleteLicense(id) {
  return await queryWithRetry(async (sql) => {
    const rows = await sql`DELETE FROM system_licenses WHERE id = ${id} RETURNING id;`
    return rows[0] || null
  })
}

export async function registerOrCheckLicense({
  machine_id,
  mac_address,
  hostname,
  os_info,
  activation_key,
  company_name,
  contact,
  city,
  address,
  users_data,
  devices_data,
}) {
  await ensureLicenseTable()

  return await queryWithRetry(async (sql) => {
    // 1. Check existing record to preserve server-configured roles, tab permissions, and device statuses
    const existingRows = await sql`
      SELECT id, status, users_data, devices_data
      FROM system_licenses
      WHERE machine_id = ${machine_id}
      LIMIT 1;
    `
    const existing = existingRows[0] || null

    let resolvedUsersData = users_data || '[]'
    if (existing?.users_data && users_data) {
      try {
        const remoteUsers =
          typeof existing.users_data === 'string'
            ? JSON.parse(existing.users_data)
            : existing.users_data
        const incomingUsers =
          typeof users_data === 'string' ? JSON.parse(users_data) : users_data

        if (Array.isArray(remoteUsers) && Array.isArray(incomingUsers)) {
          const remoteMap = new Map()
          for (const ru of remoteUsers) {
            if (ru.id) remoteMap.set(String(ru.id), ru)
            if (ru.email) remoteMap.set(String(ru.email).toLowerCase(), ru)
          }

          const mergedUsers = incomingUsers.map((inc) => {
            const rem =
              remoteMap.get(String(inc.id)) ||
              (inc.email ? remoteMap.get(String(inc.email).toLowerCase()) : null)
            if (!rem) return inc
            return {
              ...inc,
              user_type: rem.role_assigned_by_admin ? rem.user_type : (inc.user_type || rem.user_type),
              allowed_tabs: rem.allowed_tabs !== undefined ? rem.allowed_tabs : inc.allowed_tabs,
              role_assigned_by_admin: rem.role_assigned_by_admin || false,
            }
          })
          resolvedUsersData = JSON.stringify(mergedUsers)
        }
      } catch (err) {
        console.warn('Error merging users_data in license registration:', err.message)
      }
    }

    let resolvedDevicesData = devices_data || '[]'
    if (existing?.devices_data && devices_data) {
      try {
        const remoteDevs =
          typeof existing.devices_data === 'string'
            ? JSON.parse(existing.devices_data)
            : existing.devices_data
        const incomingDevs =
          typeof devices_data === 'string' ? JSON.parse(devices_data) : devices_data

        if (Array.isArray(remoteDevs) && Array.isArray(incomingDevs)) {
          const remoteDevMap = new Map()
          for (const rd of remoteDevs) {
            if (rd.device_id) remoteDevMap.set(String(rd.device_id), rd)
          }

          const mergedDevs = incomingDevs.map((inc) => {
            const rem = remoteDevMap.get(String(inc.device_id))
            if (!rem) return inc
            return {
              ...inc,
              status: rem.status || inc.status,
              device_role: rem.device_role || inc.device_role,
            }
          })
          resolvedDevicesData = JSON.stringify(mergedDevs)
        }
      } catch (err) {
        console.warn('Error merging devices_data in license registration:', err.message)
      }
    }

    const rows = await sql`
      INSERT INTO system_licenses (
        machine_id, mac_address, hostname, os_info, activation_key, status,
        company_name, contact, city, address, users_data, devices_data,
        first_seen_at, last_online_at
      )
      VALUES (
        ${machine_id}, ${mac_address}, ${hostname}, ${os_info}, ${activation_key}, 'pending',
        ${company_name || null}, ${contact || null}, ${city || null}, ${address || null}, ${resolvedUsersData}, ${resolvedDevicesData},
        NOW(), NOW()
      )
      ON CONFLICT (machine_id) DO UPDATE SET
        mac_address = EXCLUDED.mac_address,
        hostname = EXCLUDED.hostname,
        os_info = EXCLUDED.os_info,
        company_name = COALESCE(EXCLUDED.company_name, system_licenses.company_name),
        contact = COALESCE(EXCLUDED.contact, system_licenses.contact),
        city = COALESCE(EXCLUDED.city, system_licenses.city),
        address = COALESCE(EXCLUDED.address, system_licenses.address),
        users_data = ${resolvedUsersData},
        devices_data = ${resolvedDevicesData},
        last_online_at = NOW()
      RETURNING *;
    `

    const record = rows[0]
    if (!record) return null

    // If status is active, check if expiry has passed
    if (record.status === 'active' && record.expires_at) {
      const expiryTime = new Date(record.expires_at).getTime()
      if (expiryTime <= Date.now()) {
        record.status = 'expired'
        await sql`UPDATE system_licenses SET status = 'expired' WHERE id = ${record.id}`
      }
    }

    return record
  })
}
