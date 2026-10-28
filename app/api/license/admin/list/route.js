import { NextResponse } from 'next/server'
import { listLicenses } from '@/lib/license-db'
import { verifyAdminRequest } from '@/lib/crypto-vault'

export async function GET(req) {
  try {
    if (!verifyAdminRequest(req)) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: Admin authentication required.' },
        { status: 401 }
      )
    }

    const list = await listLicenses()
    return NextResponse.json({ ok: true, data: list })
  } catch (error) {
    console.error('License list error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch licenses' },
      { status: 500 }
    )
  }
}
