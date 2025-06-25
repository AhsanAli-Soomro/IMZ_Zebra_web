import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const totals = await db.query(`
    SELECT 
      COUNT(*) AS total_invoices,
      SUM(net_total) AS total_revenue,
      SUM(net_total - amount_paid) AS total_profit
    FROM billing_history
  `)
  const prodCount = await db.query(`
    SELECT SUM(bs.qty) AS total_products_sold
    FROM billing_history bh
    JOIN bills b ON b.invoice_no = bh.invoice_no
    CROSS JOIN JSON_TABLE(b.items, '$[*]'
      COLUMNS(qty INT PATH '$.qty')) AS bs
  `)
  return NextResponse.json({ success: true, data: { ...totals[0], total_products_sold: prodCount[0].total_products_sold } })
}
