import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { registerOrCheckLicense } from '@/lib/license-db'

async function syncDevicesToCloudTelemetry() {
  try {
    const devRows = await db.query(
      "SELECT device_id, mac_address, device_name FROM connected_devices ORDER BY CASE WHEN device_role = 'Server' THEN 0 ELSE 1 END, id ASC LIMIT 1"
    )
    if (!devRows || !devRows[0]) return

    const usersData =
      (await db.query(
        'SELECT id, name, email, user_type, password, allowed_tabs, created_at FROM users ORDER BY id ASC'
      )) || []
    const devicesData =
      (await db.query('SELECT * FROM connected_devices ORDER BY last_seen_at DESC')) || []
    const company =
      (await db.query('SELECT company_name, contact, city, address FROM company_profile LIMIT 1'))?.[0] || {}

    await registerOrCheckLicense({
      machine_id: devRows[0].device_id,
      mac_address: devRows[0].mac_address || 'UNKNOWN',
      hostname: devRows[0].device_name || 'Main Server PC',
      os_info: 'Server',
      activation_key: '',
      company_name: company.company_name || null,
      contact: company.contact || null,
      city: company.city || null,
      address: company.address || null,
      users_data: JSON.stringify(usersData),
      devices_data: JSON.stringify(devicesData),
    })
  } catch (syncErr) {
    console.warn('Background telemetry sync on device change notice:', syncErr.message)
  }
}

// POST /api/devices/register: Handshake endpoint for Counter PCs and LAN nodes
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const { device_id, mac_address, device_name, device_role, ip_address } = body || {}

    if (!device_id) {
      return NextResponse.json(
        { ok: false, error: 'device_id (Machine ID / Hardware Identifier) is required' },
        { status: 400 }
      )
    }

    // Detect client IP address if not supplied
    const forwardedFor = req.headers.get('x-forwarded-for')
    const realIp = req.headers.get('x-real-ip')
    const detectedIp =
      ip_address ||
      (forwardedFor ? forwardedFor.split(',')[0].trim() : realIp) ||
      '127.0.0.1'

    // 1. Check if device is already registered
    const existing = await db.query('SELECT * FROM connected_devices WHERE device_id = ? LIMIT 1', [
      String(device_id).trim(),
    ])

    if (existing && existing.length > 0) {
      const dev = existing[0]

      if (dev.status === 'blocked') {
        return NextResponse.json(
          {
            ok: false,
            code: 'DEVICE_BLOCKED',
            message:
              'This computer has been blocked by the Administrator. Please contact Ahsan Ali Soomro or your system manager.',
            device: dev,
          },
          { status: 403 }
        )
      }

      // Update last seen timestamp & IP
      await db.query(
        `UPDATE connected_devices
         SET last_seen_at = CURRENT_TIMESTAMP,
             ip_address = COALESCE(?, ip_address),
             mac_address = COALESCE(?, mac_address),
             device_name = COALESCE(?, device_name)
         WHERE device_id = ?`,
        [detectedIp, mac_address ? String(mac_address).trim().toUpperCase() : null, device_name || null, dev.device_id]
      )

      syncDevicesToCloudTelemetry().catch(() => {})

      return NextResponse.json({
        ok: true,
        allowed: true,
        device: {
          ...dev,
          ip_address: detectedIp,
          last_seen_at: new Date().toISOString(),
        },
      })
    }

    // 2. New device: check device limit
    let maxDevices = 3
    try {
      const settRows = await db.query(
        "SELECT setting_value FROM app_settings WHERE setting_key = 'license_max_devices' LIMIT 1"
      )
      if (settRows && settRows[0]?.setting_value) {
        maxDevices = Number(settRows[0].setting_value) || 3
      }
    } catch {}

    const countRows = await db.query(
      "SELECT count(*) as total FROM connected_devices WHERE status = 'active'"
    )
    const currentActiveCount = countRows?.[0]?.total || 0

    if (maxDevices > 0 && currentActiveCount >= maxDevices) {
      return NextResponse.json(
        {
          ok: false,
          code: 'DEVICE_LIMIT_REACHED',
          message: `Device limit reached (${currentActiveCount}/${maxDevices} computers connected). Ahsan Ali Soomro has set a limit of ${maxDevices} computers for this license. Please contact Ahsan Ali Soomro to add more Counter PCs.`,
          current_count: currentActiveCount,
          max_devices: maxDevices,
        },
        { status: 403 }
      )
    }

    // 3. Register new device
    const role = device_role || 'Counter'
    const name = device_name || (role === 'Server' ? 'Main Server PC' : 'Counter PC')

    await db.query(
      `INSERT INTO connected_devices (device_id, mac_address, device_name, ip_address, device_role, status, last_seen_at)
       VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)`,
      [
        String(device_id).trim(),
        mac_address ? String(mac_address).trim().toUpperCase() : 'UNKNOWN-MAC',
        name,
        detectedIp,
        role,
      ]
    )

    const newlyAdded = await db.query(
      'SELECT * FROM connected_devices WHERE device_id = ? LIMIT 1',
      [String(device_id).trim()]
    )

    syncDevicesToCloudTelemetry().catch(() => {})

    return NextResponse.json({
      ok: true,
      allowed: true,
      message: 'Computer registered successfully',
      device: newlyAdded?.[0] || null,
      current_count: currentActiveCount + 1,
      max_devices: maxDevices,
    })
  } catch (error) {
    console.error('Device register error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to register device' },
      { status: 500 }
    )
  }
}

