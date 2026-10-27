import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET() {
  let companyName = 'Zebra IMS Server'
  try {
    const rows = await db.query('SELECT company_name FROM company_profile LIMIT 1')
    if (rows && rows[0]?.company_name) {
      companyName = rows[0].company_name
    }
  } catch {}

  return NextResponse.json({
    ok: true,
    status: 'online',
    server: 'Zebra IMS Server',
    companyName,
    timestamp: Date.now(),
  })
}

