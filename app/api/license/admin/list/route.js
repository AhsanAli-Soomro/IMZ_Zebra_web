import { NextResponse } from 'next/server'
import { listLicenses } from '@/lib/license-db'

export async function GET() {
  try {
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

