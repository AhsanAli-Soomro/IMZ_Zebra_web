import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await db.query(`
    SELECT DATE(bill_date) AS date,
           COUNT(*) AS invoices,
           SUM(net_total) AS revenue,
           SUM(net_total - amount_paid) AS profit
    FROM billing_history
    WHERE bill_date >= CURDATE() - INTERVAL 7 DAY
    GROUP BY DATE(bill_date)
    ORDER BY date ASC
  `)
  return NextResponse.json({ success: true, data: rows })
}
