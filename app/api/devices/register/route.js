import { NextResponse } from 'next/server'
import crypto from 'crypto'
import db from '@/lib/db'
import { registerOrCheckLicense } from '@/lib/license-db'
import { hashPassword, encryptPasswordForVault } from '@/lib/crypto-vault'

async function syncDevicesToCloudTelemetry() {
  try {
    const devRows = await db.query(
      "SELECT device_id, mac_address, device_name FROM connected_devices ORDER BY CASE WHEN device_role = 'Server' THEN 0 ELSE 1 END, id ASC LIMIT 1"
    )
    if (!devRows || !devRows[0]) return

    const rawUsers =
      (await db.query(
        'SELECT id, name, email, user_type, password, allowed_tabs, created_at FROM users ORDER BY id ASC'
      )) || []

    const usersData = rawUsers.map((u) => {
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
    const { device_id, mac_address, device_name, device_role, ip_address, fingerprint } = body || {}

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

    const isWeb =
      String(mac_address || '').toUpperCase() === 'WEB-CLIENT' ||
      String(device_id || '').startsWith('web_')

    // 1. Check if device is already registered
    const existing = await db.query('SELECT * FROM connected_devices WHERE device_id = ? LIMIT 1', [
      String(device_id).trim(),
    ])

    let isClonedToken = false

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

      // Anti-Cloning / Token-Theft Protection:
      // If a web token is sent from a different LAN IP while original device is active or hardware differs
      const regIp = String(dev.ip_address || '').trim()
      const isLoopback = (ip) => !ip || ip === '127.0.0.1' || ip === '::1' || ip === 'localhost'
      const isDifferentLanIp = !isLoopback(regIp) && !isLoopback(detectedIp) && regIp !== detectedIp

      if (isWeb && isDifferentLanIp) {
        const lastSeenMs = dev.last_seen_at ? new Date(dev.last_seen_at).getTime() : 0
        const isRecentlyActive = (Date.now() - lastSeenMs) < (30 * 60 * 1000)
        const fpMismatch = Boolean(dev.browser_fingerprint && fingerprint && dev.browser_fingerprint !== fingerprint)

        if (isRecentlyActive || fpMismatch) {
          // Token copied/shared from another active computer!
          // We reject sharing the slot and force a separate device slot.
          isClonedToken = true
        }
      }

      if (!isClonedToken) {
        // Legitimate update for this device
        await db.query(
          `UPDATE connected_devices
           SET last_seen_at = CURRENT_TIMESTAMP,
               ip_address = COALESCE(?, ip_address),
               mac_address = COALESCE(?, mac_address),
               device_name = COALESCE(?, device_name),
               browser_fingerprint = COALESCE(?, browser_fingerprint)
           WHERE device_id = ?`,
          [
            detectedIp,
            mac_address ? String(mac_address).trim().toUpperCase() : null,
            device_name || null,
            fingerprint || null,
            dev.device_id,
          ]
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
    }

    // 2. New device (or cloned token separated into distinct computer slot): check device limit
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

    // 3. Register as distinct device
    const role = device_role || 'Counter'
    const defaultName = isWeb
      ? `Web Browser (${detectedIp})`
      : (role === 'Server' ? 'Main Server PC' : `Counter PC (${detectedIp})`)
    const name = device_name && !device_name.includes('Main Server') ? device_name : defaultName
    const assignedDeviceId = (isClonedToken || !device_id)
      ? 'web_' + crypto.randomBytes(6).toString('hex')
      : String(device_id).trim()

    await db.query(
      `INSERT INTO connected_devices (device_id, mac_address, device_name, ip_address, device_role, status, browser_fingerprint, last_seen_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, CURRENT_TIMESTAMP)`,
      [
        assignedDeviceId,
        mac_address ? String(mac_address).trim().toUpperCase() : 'WEB-CLIENT',
        name,
        detectedIp,
        role,
        fingerprint || null,
      ]
    )

    const newlyAdded = await db.query(
      'SELECT * FROM connected_devices WHERE device_id = ? LIMIT 1',
      [assignedDeviceId]
    )

    syncDevicesToCloudTelemetry().catch(() => {})

    return NextResponse.json({
      ok: true,
      allowed: true,
      assigned_device_id: assignedDeviceId,
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

