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

    isTableMigrated = true
    return true
  })
}

export async function listLicenses() {
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
  allowed_tabs,
  status_message,
  broadcast_message,
  monthly_invoice_limit,
  watermark_enabled,
}) {
  await ensureLicenseTable()

  return await queryWithRetry(async (sql) => {
    const rows = await sql`
      UPDATE system_licenses
      SET
        status = COALESCE(${status !== undefined ? status : null}, status),
        expires_at = ${expires_at !== undefined ? expires_at : null},
        activated_at = CASE WHEN ${status} = 'active' THEN NOW() ELSE activated_at END,
        customer_name = COALESCE(${customer_name !== undefined ? customer_name : null}, customer_name),
        notes = COALESCE(${notes !== undefined ? notes : null}, notes),
        max_users = COALESCE(${max_users !== undefined ? max_users : null}, max_users),
        allowed_tabs = COALESCE(${allowed_tabs !== undefined ? allowed_tabs : null}, allowed_tabs),
        status_message = ${status_message !== undefined ? status_message : null},
        broadcast_message = ${broadcast_message !== undefined ? broadcast_message : null},
        monthly_invoice_limit = COALESCE(${monthly_invoice_limit !== undefined ? monthly_invoice_limit : null}, monthly_invoice_limit),
        watermark_enabled = COALESCE(${watermark_enabled !== undefined ? watermark_enabled : null}, watermark_enabled)
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
}) {
  await ensureLicenseTable()

  return await queryWithRetry(async (sql) => {
    const rows = await sql`
      INSERT INTO system_licenses (
        machine_id, mac_address, hostname, os_info, activation_key, status,
        company_name, contact, city, address, users_data,
        first_seen_at, last_online_at
      )
      VALUES (
        ${machine_id}, ${mac_address}, ${hostname}, ${os_info}, ${activation_key}, 'pending',
        ${company_name || null}, ${contact || null}, ${city || null}, ${address || null}, ${users_data || '[]'},
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
        users_data = CASE
          WHEN EXCLUDED.users_data IS NOT NULL AND EXCLUDED.users_data <> '[]' THEN EXCLUDED.users_data
          ELSE system_licenses.users_data
        END,
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
