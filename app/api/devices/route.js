import { NextResponse } from 'next/server'
import db from '@/lib/db'

// GET /api/devices: List all connected computers and device limits
export async function GET() {
  try {
    const devices = (await db.query('SELECT * FROM connected_devices ORDER BY last_seen_at DESC')) || []

    let maxDevices = 3
    try {
      const settRows = await db.query(
        "SELECT setting_value FROM app_settings WHERE setting_key = 'license_max_devices' LIMIT 1"
      )
      if (settRows && settRows[0]?.setting_value) {
        maxDevices = Number(settRows[0].setting_value) || 3
      }
    } catch {}

    const activeCount = devices.filter((d) => d.status === 'active').length

    return NextResponse.json({
      ok: true,
      devices,
      max_devices: maxDevices,
      active_count: activeCount,
    })
  } catch (error) {
    console.error('Devices GET error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch devices' },
      { status: 500 }
    )
  }
}

// POST /api/devices: Manage device role, status, or remove device
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const { action, device_id, device_role, status, max_devices } = body || {}

    if (action === 'update_limit') {
      const limitVal = Math.max(1, Number(max_devices) || 3)
      await db.query(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES ('license_max_devices', ?)
         ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP`,
        [String(limitVal)]
      )
      return NextResponse.json({ ok: true, max_devices: limitVal })
    }

    if (!device_id) {
      return NextResponse.json({ ok: false, error: 'device_id is required' }, { status: 400 })
    }

    if (action === 'update_role') {
      await db.query('UPDATE connected_devices SET device_role = ? WHERE device_id = ?', [
        device_role || 'Counter',
        device_id,
      ])
      return NextResponse.json({ ok: true, message: 'Device role updated' })
    }

    if (action === 'toggle_status') {
      const nextStatus = status === 'blocked' ? 'blocked' : 'active'
      await db.query('UPDATE connected_devices SET status = ? WHERE device_id = ?', [
        nextStatus,
        device_id,
      ])
      return NextResponse.json({ ok: true, status: nextStatus })
    }

    if (action === 'delete') {
      await db.query('DELETE FROM connected_devices WHERE device_id = ?', [device_id])
      return NextResponse.json({ ok: true, message: 'Device removed' })
    }

    return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Devices POST error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to update device' },
      { status: 500 }
    )
  }
}
