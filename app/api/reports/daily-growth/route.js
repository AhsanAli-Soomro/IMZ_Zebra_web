import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET() {
  try {
    const rows = await db.query(`
      SELECT
        date(b.invoice_date) AS day,
        COALESCE(SUM(b.total), 0) AS revenue,
        COALESCE(SUM(b.total - (
          SELECT COALESCE(SUM(sii.qty * COALESCE(s.purchase_price, 0)), 0)
          FROM sales_invoice_items sii
          LEFT JOIN stocks s ON s.id = sii.stock_id
          WHERE sii.bill_id = b.id
        )), 0) AS profit,
        COUNT(b.id) AS invoices
      FROM bills b
      WHERE (b.deleted_at IS NULL OR b.deleted_at = '')
      GROUP BY date(b.invoice_date)
      ORDER BY date(b.invoice_date) ASC
    `)

    const data = rows.map((row) => ({
      date: row.day,
      label: row.day,
      revenue: Number(row.revenue || 0),
      profit: Number(row.profit || 0),
      invoices: Number(row.invoices || 0),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Daily growth report error:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load daily growth report' },
      { status: 500 }
    )
  }
}