import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { registerOrCheckLicense } from '@/lib/license-db'
import { APP_LICENSE_SECRET } from '@/lib/license-config'

function signPayload(payload) {
  return crypto
    .createHmac('sha256', APP_LICENSE_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex')
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { machine_id, mac_address, hostname, os_info, activation_key } = body || {}

    if (!machine_id || !mac_address) {
      return NextResponse.json(
        { ok: false, error: 'machine_id and mac_address are required' },
        { status: 400 }
      )
    }

    const record = await registerOrCheckLicense({
      machine_id: String(machine_id).trim(),
      mac_address: String(mac_address).trim().toUpperCase(),
      hostname: String(hostname || 'Unknown-PC').trim(),
      os_info: String(os_info || 'Unknown-OS').trim(),
      activation_key: String(activation_key || '').trim(),
    })

    if (!record) {
      return NextResponse.json(
        { ok: false, error: 'Failed to process license' },
        { status: 500 }
      )
    }

    let signature = null
    let licensePayload = null

    if (record.status === 'active') {
      licensePayload = {
        activated: true,
        machineId: record.machine_id,
        macAddress: record.mac_address,
        activationKey: record.activation_key,
        customerName: record.customer_name || '',
        expiresAt: record.expires_at || null,
        activatedAt: record.activated_at || new Date().toISOString(),
      }
      signature = signPayload(licensePayload)
    }

    return NextResponse.json({
      ok: true,
      status: record.status, // 'pending', 'active', 'rejected', 'expired'
      machineId: record.machine_id,
      macAddress: record.mac_address,
      hostname: record.hostname,
      activationKey: record.activation_key,
      customerName: record.customer_name,
      expiresAt: record.expires_at,
      activatedAt: record.activated_at,
      licensePayload,
      signature,
    })
  } catch (error) {
    console.error('License register-or-check error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Server error' },
      { status: 500 }
    )
  }
}

