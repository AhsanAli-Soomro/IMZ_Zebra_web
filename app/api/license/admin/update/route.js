import { NextResponse } from 'next/server'
import { updateLicenseStatus } from '@/lib/license-db'

export async function POST(req) {
  try {
    const body = await req.json()
    const {
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
    } = body || {}

    if (!id) {
      return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 })
    }

    const updated = await updateLicenseStatus({
      id: Number(id),
      status,
      expires_at: expires_at !== undefined ? expires_at : undefined,
      customer_name,
      notes,
      max_users: max_users !== undefined ? Number(max_users) : undefined,
      allowed_tabs: allowed_tabs !== undefined ? (typeof allowed_tabs === 'string' ? allowed_tabs : JSON.stringify(allowed_tabs)) : undefined,
      status_message,
      broadcast_message,
      monthly_invoice_limit: monthly_invoice_limit !== undefined ? Number(monthly_invoice_limit) : undefined,
      watermark_enabled,
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

