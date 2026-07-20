import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET() {
  try {
    const rows = await db.query(`
      WITH purchase_cost AS (
        SELECT
          stock_id,
          CASE WHEN COALESCE(SUM(qty), 0) > 0
            THEN COALESCE(SUM(amount), SUM(qty * price), 0) / SUM(qty)
            ELSE 0
          END AS avg_purchase_price
        FROM purchase_invoice_items
        GROUP BY stock_id
      )
      SELECT
        strftime('%Y-%m', b.invoice_date) AS month_key,
        strftime('%m', b.invoice_date) AS month_no,
        strftime('%Y', b.invoice_date) AS year_no,
        COALESCE(SUM(b.total), 0) AS revenue,
        COALESCE(SUM(b.total - (
          SELECT COALESCE(SUM(sii.qty * COALESCE(pc.avg_purchase_price, 0)), 0)
          FROM sales_invoice_items sii
          LEFT JOIN purchase_cost pc ON pc.stock_id = sii.stock_id
          WHERE sii.bill_id = b.id
        )), 0) AS profit,
        COUNT(b.id) AS invoices
      FROM bills b
      WHERE (b.deleted_at IS NULL OR b.deleted_at = '')
      GROUP BY strftime('%Y-%m', b.invoice_date)
      ORDER BY strftime('%Y-%m', b.invoice_date) ASC
    `)

    const data = rows.map((row) => ({
      month: row.month_key,
      label: row.month_key,
      revenue: Number(row.revenue || 0),
      profit: Number(row.profit || 0),
      invoices: Number(row.invoices || 0),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Monthly report error:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load monthly report' },
      { status: 500 }
    )
  }
}
