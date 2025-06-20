import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const result = await db.query('SELECT MAX(invoice_no) AS lastInvoice FROM bills')
  const lastInvoice = result[0]?.lastInvoice || 1000
  return NextResponse.json({ lastInvoice })
}
