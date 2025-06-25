import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await db.query(`
    SELECT DATE_FORMAT(bill_date, '%Y') AS year,
           COUNT(*) AS invoices,
           SUM(net_total) AS revenue,
           SUM(net_total - amount_paid) AS profit
    FROM billing_history
    GROUP BY year
    ORDER BY year DESC
    LIMIT 5
  `)
  return NextResponse.json({ success: true, data: rows })
}
