import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { registerOrCheckLicense } from '@/lib/license-db'

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const { machine_id, mac_address, hostname, os_info, activation_key } = body || {}

    // 1. Auto-register Main Server PC in connected_devices
    if (machine_id) {
      try {
        await db.query(`
          INSERT INTO connected_devices (device_id, mac_address, device_name, device_role, status, last_seen_at)
          VALUES (?, ?, ?, 'Server', 'active', CURRENT_TIMESTAMP)
          ON CONFLICT(device_id) DO UPDATE SET
            mac_address = excluded.mac_address,
            device_name = excluded.device_name,
            last_seen_at = CURRENT_TIMESTAMP
        `, [
          String(machine_id).trim(),
          String(mac_address || '').trim().toUpperCase(),
          String(hostname || 'Main Server PC').trim(),
        ])
      } catch (err) {
        console.warn('Could not auto-register server device:', err.message)
      }
    }

    // 2. Read company profile from local SQLite
    let companyProfile = { company_name: '', contact: '', city: '', address: '' }
    try {
      const rows = await db.query('SELECT company_name, contact, city, address FROM company_profile LIMIT 1')
      if (rows && rows[0]) {
        companyProfile = rows[0]
      }
    } catch (err) {
      console.warn('Could not read company profile for license sync:', err.message)
    }

    // 3. Read users from local SQLite
    let usersData = []
    try {
      const uRows = await db.query('SELECT id, name, email, user_type, password, allowed_tabs, created_at FROM users')
      usersData = uRows || []
    } catch (err) {
      console.warn('Could not read users for license sync:', err.message)
    }

    // 4. Read connected devices from local SQLite
    let devicesData = []
    try {
      const dRows = await db.query('SELECT * FROM connected_devices ORDER BY last_seen_at DESC')
      devicesData = dRows || []
    } catch (err) {
      console.warn('Could not read connected devices for license sync:', err.message)
    }

    // If no machine_id supplied, just return local stats
    if (!machine_id || !mac_address) {
      return NextResponse.json({
        ok: true,
        localOnly: true,
        company: companyProfile,
        userCount: usersData.length,
        deviceCount: devicesData.length,
      })
    }

    // 5. Register or check on Neon Cloud
    const record = await registerOrCheckLicense({
      machine_id: String(machine_id).trim(),
      mac_address: String(mac_address).trim().toUpperCase(),
      hostname: String(hostname || 'Unknown-PC').trim(),
      os_info: String(os_info || 'Unknown-OS').trim(),
      activation_key: String(activation_key || '').trim(),
      company_name: companyProfile.company_name || null,
      contact: companyProfile.contact || null,
      city: companyProfile.city || null,
      address: companyProfile.address || null,
      users_data: JSON.stringify(usersData),
      devices_data: JSON.stringify(devicesData),
    })

    if (!record) {
      return NextResponse.json({ ok: false, error: 'Could not sync license' }, { status: 500 })
    }

    // Sync any remote device status changes (e.g. Ahsan blocked a device remotely)
    if (record.devices_data) {
      try {
        const remoteDevices = typeof record.devices_data === 'string' ? JSON.parse(record.devices_data) : record.devices_data
        if (Array.isArray(remoteDevices)) {
          for (const rd of remoteDevices) {
            if (rd.device_id) {
              await db.query(`
                UPDATE connected_devices
                SET status = COALESCE(?, status),
                    device_role = COALESCE(?, device_role)
                WHERE device_id = ?
              `, [rd.status || null, rd.device_role || null, rd.device_id])
            }
          }
        }
      } catch (syncDevErr) {
        console.warn('Could not sync remote device statuses:', syncDevErr.message)
      }
    }

    // Sync any remote user tab permission changes (e.g. Ahsan set tabs for a cashier remotely)
    if (record.users_data) {
      try {
        const remoteUsers = typeof record.users_data === 'string' ? JSON.parse(record.users_data) : record.users_data
        if (Array.isArray(remoteUsers)) {
          for (const ru of remoteUsers) {
            if (ru.id && ru.allowed_tabs !== undefined) {
              await db.query(`
                UPDATE users
                SET allowed_tabs = ?
                WHERE id = ?
              `, [typeof ru.allowed_tabs === 'string' ? ru.allowed_tabs : JSON.stringify(ru.allowed_tabs), ru.id])
            }
          }
        }
      } catch (syncUserErr) {
        console.warn('Could not sync remote user tab permissions:', syncUserErr.message)
      }
    }

    // Cache license limits into SQLite app_settings for offline enforcement
    try {
      await db.query(`
        INSERT INTO app_settings (setting_key, setting_value) VALUES ('license_max_devices', ?)
        ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP
      `, [String(record.max_devices || 3)])

      await db.query(`
        INSERT INTO app_settings (setting_key, setting_value) VALUES ('license_max_users', ?)
        ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP
      `, [String(record.max_users || 5)])

      if (record.allowed_tabs) {
        await db.query(`
          INSERT INTO app_settings (setting_key, setting_value) VALUES ('license_allowed_tabs', ?)
          ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP
        `, [typeof record.allowed_tabs === 'string' ? record.allowed_tabs : JSON.stringify(record.allowed_tabs)])
      }
    } catch (settErr) {
      console.warn('Could not cache license settings in app_settings:', settErr.message)
    }

    let allowedTabs = ['ALL']
    if (record.allowed_tabs) {
      try {
        allowedTabs = JSON.parse(record.allowed_tabs)
      } catch {
        if (record.allowed_tabs === 'ALL') {
          allowedTabs = ['ALL']
        } else {
          allowedTabs = record.allowed_tabs.split(',').map((s) => s.trim())
        }
      }
    }

    return NextResponse.json({
      ok: true,
      status: record.status,
      max_users: record.max_users || 5,
      max_devices: record.max_devices || 3,
      allowed_tabs: allowedTabs,
      status_message: record.status_message || '',
      broadcast_message: record.broadcast_message || '',
      watermark_enabled: record.watermark_enabled !== false,
      user_count: usersData.length,
      device_count: devicesData.length,
    })
  } catch (error) {
    console.error('License sync error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
