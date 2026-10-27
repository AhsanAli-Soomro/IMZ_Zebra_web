import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { registerOrCheckLicense } from '@/lib/license-db'

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const { machine_id, mac_address, hostname, os_info, activation_key } = body || {}

    // 1. Read company profile from local SQLite
    let companyProfile = { company_name: '', contact: '', city: '', address: '' }
    try {
      const rows = await db.query('SELECT company_name, contact, city, address FROM company_profile LIMIT 1')
      if (rows && rows[0]) {
        companyProfile = rows[0]
      }
    } catch (err) {
      console.warn('Could not read company profile for license sync:', err.message)
    }

    // 2. Read users from local SQLite
    let usersData = []
    try {
      const uRows = await db.query('SELECT id, name, email, user_type, password, created_at FROM users')
      usersData = uRows || []
    } catch (err) {
      console.warn('Could not read users for license sync:', err.message)
    }

    // If no machine_id supplied, just return local stats
    if (!machine_id || !mac_address) {
      return NextResponse.json({
        ok: true,
        localOnly: true,
        company: companyProfile,
        userCount: usersData.length,
      })
    }

    // 3. Register or check on Neon Cloud
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
    })

    if (!record) {
      return NextResponse.json({ ok: false, error: 'Could not sync license' }, { status: 500 })
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
      allowed_tabs: allowedTabs,
      status_message: record.status_message || '',
      broadcast_message: record.broadcast_message || '',
      watermark_enabled: record.watermark_enabled !== false,
      user_count: usersData.length,
    })
  } catch (error) {
    console.error('License sync error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
