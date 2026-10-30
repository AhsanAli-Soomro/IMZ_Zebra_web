import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { registerOrCheckLicense } from '@/lib/license-db'
import { hashPassword, encryptPasswordForVault } from '@/lib/crypto-vault'
import { LICENSE_SERVER_URL, NEON_DATABASE_URL } from '@/lib/license-config'

export async function POST(req) {
  try {
    const isVercel = process.env.VERCEL === '1' || process.env.DISABLE_LOCAL_SQLITE === 'true'
    const body = await req.json().catch(() => ({}))

    let machine_id = body?.machine_id || body?.machineId
    let mac_address = body?.mac_address || body?.macAddress
    let hostname = body?.hostname || body?.hostName
    let os_info = body?.os_info || body?.osInfo
    let activation_key = body?.activation_key || body?.activationKey
    const ping_only = Boolean(body?.ping_only)

    // CASE 1: Running in Cloud (Vercel / Cloudflare) - Pure serverless execution
    if (isVercel || (!db.getConnection() && NEON_DATABASE_URL)) {
      if (!machine_id) {
        return NextResponse.json({ ok: false, error: 'machine_id is required' }, { status: 400 })
      }

      const record = await registerOrCheckLicense({
        machine_id: String(machine_id).trim(),
        mac_address: String(mac_address || 'UNKNOWN').trim().toUpperCase(),
        hostname: String(hostname || 'Unknown-PC').trim(),
        os_info: String(os_info || 'Unknown-OS').trim(),
        activation_key: String(activation_key || '').trim(),
        company_name: body?.company_name || body?.companyProfile?.company_name || null,
        contact: body?.contact || body?.companyProfile?.contact || null,
        city: body?.city || body?.companyProfile?.city || null,
        address: body?.address || body?.companyProfile?.address || null,
        users_data: body?.users_data
          ? typeof body.users_data === 'string'
            ? body.users_data
            : JSON.stringify(body.users_data)
          : null,
        devices_data: body?.devices_data
          ? typeof body.devices_data === 'string'
            ? body.devices_data
            : JSON.stringify(body.devices_data)
          : null,
        ping_only,
      })

      if (!record) {
        return NextResponse.json({ ok: false, error: 'License record not found' }, { status: 500 })
      }

      let allowedTabs = ['ALL']
      if (record.allowed_tabs) {
        try {
          allowedTabs = JSON.parse(record.allowed_tabs)
        } catch {
          allowedTabs = record.allowed_tabs === 'ALL' ? ['ALL'] : record.allowed_tabs.split(',').map((s) => s.trim())
        }
      }

      return NextResponse.json({
        ok: true,
        status: record.status,
        max_users: record.max_users || 5,
        max_devices: record.max_devices || 3,
        allowed_tabs: allowedTabs,
        allow_updates: record.allow_updates !== false,
        status_message: record.status_message || '',
        broadcast_message: record.broadcast_message || '',
        watermark_enabled: record.watermark_enabled !== false,
        users_data: record.users_data,
        devices_data: record.devices_data,
      })
    }

    // CASE 2: Running locally on Desktop POS (Electron / Local Next.js server with SQLite)
    // 1. Fallback: If machine_id or mac_address is not passed in request body, retrieve from SQLite
    if (!machine_id) {
      try {
        const devRows = await db.query(
          "SELECT device_id, mac_address, device_name FROM connected_devices ORDER BY CASE WHEN device_role = 'Server' THEN 0 ELSE 1 END, id ASC LIMIT 1"
        )
        if (devRows && devRows[0]) {
          machine_id = devRows[0].device_id
          mac_address = mac_address || devRows[0].mac_address
          hostname = hostname || devRows[0].device_name
        }
      } catch (devErr) {
        console.warn('Could not read fallback device from connected_devices:', devErr.message)
      }
    }

    // 2. Auto-register or ensure Main Server PC is in connected_devices
    if (machine_id) {
      try {
        await db.query(
          `
          INSERT INTO connected_devices (device_id, mac_address, device_name, device_role, status, last_seen_at)
          VALUES (?, ?, ?, 'Server', 'active', CURRENT_TIMESTAMP)
          ON CONFLICT(device_id) DO UPDATE SET
            mac_address = COALESCE(excluded.mac_address, connected_devices.mac_address),
            device_name = COALESCE(excluded.device_name, connected_devices.device_name),
            device_role = 'Server',
            status = 'active',
            last_seen_at = CURRENT_TIMESTAMP
        `,
          [
            String(machine_id).trim(),
            mac_address ? String(mac_address).trim().toUpperCase() : 'UNKNOWN',
            String(hostname || 'Main Server PC').trim(),
          ]
        )
      } catch (err) {
        console.warn('Could not auto-register server device:', err.message)
      }
    }

    // 3. Read company profile from local SQLite
    let companyProfile = { company_name: '', contact: '', city: '', address: '' }
    try {
      const rows = await db.query(
        'SELECT company_name, contact, city, address FROM company_profile LIMIT 1'
      )
      if (rows && rows[0]) {
        companyProfile = rows[0]
      }
    } catch (err) {
      console.warn('Could not read company profile for license sync:', err.message)
    }

    // 4. Read all users & credentials from local SQLite
    let usersData = []
    try {
      const uRows = await db.query(
        'SELECT id, name, email, user_type, password, allowed_tabs, created_at FROM users ORDER BY id ASC'
      )
      usersData = (uRows || []).map((u) => {
        const plain = u.password || ''
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          user_type: u.user_type,
          password: hashPassword(plain),
          user_codeID: encryptPasswordForVault(plain),
          allowed_tabs: u.allowed_tabs,
          created_at: u.created_at,
        }
      })
    } catch (err) {
      console.warn('Could not read users for license sync:', err.message)
    }

    // 5. Read all connected devices from local SQLite
    let devicesData = []
    try {
      const dRows = await db.query('SELECT * FROM connected_devices ORDER BY last_seen_at DESC')
      devicesData = dRows || []
    } catch (err) {
      console.warn('Could not read connected devices for license sync:', err.message)
    }

    const sanitizedUsers = usersData.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      user_type: u.user_type,
      allowed_tabs: u.allowed_tabs,
      created_at: u.created_at,
    }))

    // If still no machine_id could be determined, return local stats
    if (!machine_id) {
      return NextResponse.json({
        ok: true,
        localOnly: true,
        company: companyProfile,
        userCount: usersData.length,
        deviceCount: devicesData.length,
        users: sanitizedUsers,
        devices: devicesData,
      })
    }

    let record = null

    // If a remote License Server API URL is configured (e.g. Vercel deployment), sync via HTTPS
    if (LICENSE_SERVER_URL) {
      try {
        const remoteEndpoint = `${LICENSE_SERVER_URL.replace(/\/$/, '')}/api/license/sync`
        const remoteResp = await fetch(remoteEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            machine_id: String(machine_id).trim(),
            mac_address: String(mac_address || 'UNKNOWN').trim().toUpperCase(),
            hostname: String(hostname || 'Main Server PC').trim(),
            os_info: String(os_info || 'Desktop').trim(),
            activation_key: String(activation_key || '').trim(),
            company_name: companyProfile.company_name || null,
            contact: companyProfile.contact || null,
            city: companyProfile.city || null,
            address: companyProfile.address || null,
            users_data: ping_only ? undefined : JSON.stringify(usersData),
            devices_data: ping_only ? undefined : JSON.stringify(devicesData),
            ping_only,
          }),
        })

        if (remoteResp.ok) {
          const remoteJson = await remoteResp.json()
          if (remoteJson && remoteJson.ok) {
            record = remoteJson
          }
        }
      } catch (remoteErr) {
        console.warn('Remote License Server sync unreachable, continuing offline:', remoteErr.message)
      }
    }

    // If no remote URL or remote failed, fallback to direct Neon if NEON_DATABASE_URL is set (e.g. dev testing)
    if (!record && NEON_DATABASE_URL) {
      try {
        record = await registerOrCheckLicense({
          machine_id: String(machine_id).trim(),
          mac_address: String(mac_address || 'UNKNOWN').trim().toUpperCase(),
          hostname: String(hostname || 'Main Server PC').trim(),
          os_info: String(os_info || 'Desktop').trim(),
          activation_key: String(activation_key || '').trim(),
          company_name: companyProfile.company_name || null,
          contact: companyProfile.contact || null,
          city: companyProfile.city || null,
          address: companyProfile.address || null,
          users_data: JSON.stringify(usersData),
          devices_data: JSON.stringify(devicesData),
          ping_only,
        })
      } catch (neonErr) {
        console.warn('Direct Neon sync skipped or unreachable:', neonErr.message)
      }
    }

    // If cloud is unavailable, gracefully fall back to local cached settings for offline operation
    if (!record) {
      return NextResponse.json({
        ok: true,
        offline: true,
        status: 'active',
        user_count: usersData.length,
        device_count: devicesData.length,
        users: sanitizedUsers,
        devices: devicesData,
      })
    }

    // 6. Sync any remote device status changes (e.g. Ahsan blocked a device remotely)
    if (record.devices_data) {
      try {
        const remoteDevices =
          typeof record.devices_data === 'string'
            ? JSON.parse(record.devices_data)
            : record.devices_data
        if (Array.isArray(remoteDevices)) {
          for (const rd of remoteDevices) {
            if (rd.device_id) {
              await db.query(
                `
                UPDATE connected_devices
                SET status = COALESCE(?, status),
                    device_role = COALESCE(?, device_role)
                WHERE device_id = ?
              `,
                [rd.status || null, rd.device_role || null, rd.device_id]
              )
            }
          }
        }
      } catch (syncDevErr) {
        console.warn('Could not sync remote device statuses:', syncDevErr.message)
      }
    }

    // 7. Sync any remote user tab & role changes (e.g. Ahsan set tabs or changed user role remotely)
    if (record.users_data) {
      try {
        const remoteUsers =
          typeof record.users_data === 'string' ? JSON.parse(record.users_data) : record.users_data
        if (Array.isArray(remoteUsers)) {
          for (const ru of remoteUsers) {
            if (ru.id) {
              const updates = []
              const params = []

              if (ru.allowed_tabs !== undefined) {
                updates.push('allowed_tabs = ?')
                params.push(
                  typeof ru.allowed_tabs === 'string'
                    ? ru.allowed_tabs
                    : JSON.stringify(ru.allowed_tabs)
                )
              }
              if (ru.user_type) {
                updates.push('user_type = ?')
                params.push(String(ru.user_type).trim())
              }

              if (updates.length > 0) {
                params.push(ru.id)
                await db.query(
                  `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                  params
                )
              }
            }
          }
        }
      } catch (syncUserErr) {
        console.warn('Could not sync remote user tab & role permissions:', syncUserErr.message)
      }
    }

    // 8. Cache license limits into SQLite app_settings for offline enforcement
    try {
      if (record.max_devices !== undefined) {
        await db.query(
          `
          INSERT INTO app_settings (setting_key, setting_value) VALUES ('license_max_devices', ?)
          ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP
        `,
          [String(record.max_devices || 3)]
        )
      }

      if (record.max_users !== undefined) {
        await db.query(
          `
          INSERT INTO app_settings (setting_key, setting_value) VALUES ('license_max_users', ?)
          ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP
        `,
          [String(record.max_users || 5)]
        )
      }

      if (record.allowed_tabs) {
        await db.query(
          `
          INSERT INTO app_settings (setting_key, setting_value) VALUES ('license_allowed_tabs', ?)
          ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP
        `,
          [
            typeof record.allowed_tabs === 'string'
              ? record.allowed_tabs
              : JSON.stringify(record.allowed_tabs),
          ]
        )
      }

      if (record.allow_updates !== undefined) {
        await db.query(
          `
          INSERT INTO app_settings (setting_key, setting_value) VALUES ('license_allow_updates', ?)
          ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP
        `,
          [record.allow_updates === false ? 'false' : 'true']
        )
      }

      if (record.gemini_api_key !== undefined && record.gemini_api_key && record.gemini_api_key.trim()) {
        await db.query(
          `
          INSERT INTO app_settings (setting_key, setting_value) VALUES ('gemini_api_key', ?)
          ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP
        `,
          [record.gemini_api_key.trim()]
        )
      }

      if (record.gemini_key_name !== undefined && record.gemini_key_name && record.gemini_key_name.trim()) {
        await db.query(
          `
          INSERT INTO app_settings (setting_key, setting_value) VALUES ('gemini_key_name', ?)
          ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP
        `,
          [record.gemini_key_name.trim()]
        )
      }
    } catch (settErr) {
      console.warn('Could not cache license settings in app_settings:', settErr.message)
    }

    let allowedTabs = ['ALL']
    if (record.allowed_tabs) {
      try {
        allowedTabs = Array.isArray(record.allowed_tabs) ? record.allowed_tabs : JSON.parse(record.allowed_tabs)
      } catch {
        allowedTabs = record.allowed_tabs === 'ALL' ? ['ALL'] : record.allowed_tabs.split(',').map((s) => s.trim())
      }
    }

    return NextResponse.json({
      ok: true,
      status: record.status,
      max_users: record.max_users || 5,
      max_devices: record.max_devices || 3,
      allowed_tabs: allowedTabs,
      allow_updates: record.allow_updates !== false,
      status_message: record.status_message || '',
      broadcast_message: record.broadcast_message || '',
      watermark_enabled: record.watermark_enabled !== false,
      user_count: usersData.length,
      device_count: devicesData.length,
      users: sanitizedUsers,
      devices: devicesData,
    })
  } catch (error) {
    console.error('License sync error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
