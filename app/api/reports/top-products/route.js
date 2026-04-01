import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET() {
  try {
    const rows = await db.query(`
      SELECT
        sii.stock_id,
        COALESCE(sii.product_name, s.item_name, 'Unknown Product') AS product_name,
        COALESCE(SUM(sii.qty), 0) AS total_qty,
        COALESCE(SUM(sii.total), 0) AS total_sales,
        COALESCE(SUM(
          sii.total - (sii.qty * COALESCE(s.purchase_price, 0))
        ), 0) AS total_profit
      FROM sales_invoice_items sii
      INNER JOIN bills b ON b.id = sii.bill_id
      LEFT JOIN stocks s ON s.id = sii.stock_id
      WHERE (b.deleted_at IS NULL OR b.deleted_at = '')
      GROUP BY sii.stock_id, COALESCE(sii.product_name, s.item_name, 'Unknown Product')
      ORDER BY total_qty DESC, total_sales DESC
      LIMIT 10
    `)

    const data = rows.map((row) => ({
      stock_id: Number(row.stock_id || 0),
      product_name: row.product_name,
      total_qty: Number(row.total_qty || 0),
      total_sales: Number(row.total_sales || 0),
      total_profit: Number(row.total_profit || 0),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Top products report error:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load top products report' },
      { status: 500 }
    )
  }
}