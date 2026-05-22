import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET() {
  try {
    const invoiceRows = await db.query(`
      SELECT
        COUNT(b.id) AS total_invoices,
        COALESCE(SUM(b.total), 0) AS total_revenue
      FROM bills b
      WHERE (b.deleted_at IS NULL OR b.deleted_at = '')
    `)

    const soldRows = await db.query(`
      SELECT
        COALESCE(SUM(sii.qty), 0) AS total_products_sold
      FROM sales_invoice_items sii
      INNER JOIN bills b ON b.id = sii.bill_id
      WHERE (b.deleted_at IS NULL OR b.deleted_at = '')
    `)

    const stockAmountRows = await db.query(`
      SELECT
        COALESCE(SUM(COALESCE(qty, 0) * COALESCE(purchase_price, 0)), 0) AS total_stock_amount
      FROM stocks
      WHERE (deleted_at IS NULL OR deleted_at = '')
    `)

    const profitRows = await db.query(`
      SELECT
        COALESCE(SUM(
          (sii.qty * sii.price) -
          (sii.qty * COALESCE(s.purchase_price, 0)) -
          COALESCE(sii.discount, 0) +
          COALESCE(sii.tax, 0)
        ), 0) AS total_profit
      FROM sales_invoice_items sii
      INNER JOIN bills b ON b.id = sii.bill_id
      LEFT JOIN stocks s ON s.id = sii.stock_id
      WHERE (b.deleted_at IS NULL OR b.deleted_at = '')
    `)

    const data = {
      total_invoices: Number(invoiceRows[0]?.total_invoices || 0),
      total_revenue: Number(invoiceRows[0]?.total_revenue || 0),
      total_products_sold: Number(soldRows[0]?.total_products_sold || 0),
      total_profit: Number(profitRows[0]?.total_profit || 0),
      total_stock_amount: Number(stockAmountRows[0]?.total_stock_amount || 0),
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Total summary report error:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load total summary' },
      { status: 500 }
    )
  }
}