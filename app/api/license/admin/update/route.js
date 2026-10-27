import { NextResponse } from 'next/server'
import { updateLicenseStatus } from '@/lib/license-db'

export async function POST(req) {
  try {
    const body = await req.json()
    const { id, status, expires_at, customer_name, notes } = body || {}

    if (!id) {
      return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 })
    }

    const updated = await updateLicenseStatus({
      id: Number(id),
      status,
      expires_at: expires_at !== undefined ? expires_at : undefined,
      customer_name,
      notes,
    })

    return NextResponse.json({ ok: true, data: updated })
  } catch (error) {
    console.error('License update error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to update license' },
      { status: 500 }
    )
  }
}

