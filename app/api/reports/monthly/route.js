import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await db.query(`
    SELECT DATE_FORMAT(bill_date, '%Y-%m') AS month,
           COUNT(*) AS invoices,
           SUM(net_total) AS revenue,
           SUM(amount_paid) AS paid,
           SUM(net_total - amount_paid) AS profit
    FROM billing_history
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `)
  return NextResponse.json({ success: true, data: rows })
}
