import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET() {
  try {
    const rows = await db.query(`
      WITH purchase_cost_by_stock AS (
        SELECT
          stock_id,
          CASE WHEN COALESCE(SUM(qty), 0) > 0
            THEN SUM(qty * price) / SUM(qty)
            ELSE 0
          END AS avg_purchase_price
        FROM purchase_invoice_items
        WHERE stock_id IS NOT NULL
        GROUP BY stock_id
      ),
      purchase_cost_by_name AS (
        SELECT
          LOWER(TRIM(COALESCE(item_name, product_name, ''))) AS item_key,
          SUM(qty * price) / NULLIF(SUM(qty), 0)
            AS avg_purchase_price
        FROM purchase_invoice_items
        GROUP BY LOWER(TRIM(COALESCE(item_name, product_name, '')))
      )
      SELECT
        strftime('%Y', b.invoice_date) AS year_key,
        COALESCE(SUM(b.total), 0) AS revenue,
        COALESCE(SUM((
          SELECT COALESCE(SUM(
            (COALESCE(NULLIF(sii.amount, 0), sii.qty * CASE WHEN COALESCE(sii.weight, 0) > 0 THEN sii.weight ELSE 1 END * sii.price)) - ((CASE WHEN sii.price > 0 THEN COALESCE(NULLIF(sii.amount, 0), sii.qty * CASE WHEN COALESCE(sii.weight, 0) > 0 THEN sii.weight ELSE 1 END * sii.price) / sii.price ELSE sii.qty * CASE WHEN COALESCE(sii.weight, 0) > 0 THEN sii.weight ELSE 1 END END) * COALESCE(
              NULLIF(pc_stock.avg_purchase_price, 0),
              NULLIF(pc_name.avg_purchase_price, 0),
              NULLIF(s.purchase_rate, 0),
              NULLIF(s.purchase_price, 0),
          0
            ))
          ), 0)
          FROM sales_invoice_items sii
          LEFT JOIN stocks s ON s.id = sii.stock_id
          LEFT JOIN purchase_cost_by_stock pc_stock ON pc_stock.stock_id = sii.stock_id
          LEFT JOIN purchase_cost_by_name pc_name
            ON pc_name.item_key = LOWER(TRIM(COALESCE(sii.item_name, sii.product_name, s.item_name, '')))
          WHERE sii.bill_id = b.id
        )), 0) AS profit,
        COUNT(b.id) AS invoices
      FROM bills b
      WHERE (b.deleted_at IS NULL OR b.deleted_at = '')
      GROUP BY strftime('%Y', b.invoice_date)
      ORDER BY strftime('%Y', b.invoice_date) ASC
    `)

    const data = rows.map((row) => ({
      year: row.year_key,
      label: row.year_key,
      revenue: Number(row.revenue || 0),
      profit: Number(row.profit || 0),
      invoices: Number(row.invoices || 0),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Yearly report error:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load yearly report' },
      { status: 500 }
    )
  }
}
