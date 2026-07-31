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
        sii.stock_id,
        COALESCE(sii.product_name, s.item_name, 'Unknown Product') AS product_name,
        COALESCE(SUM(sii.qty), 0) AS total_qty,
        COALESCE(SUM(COALESCE(NULLIF(sii.amount, 0), sii.qty * CASE WHEN COALESCE(sii.weight, 0) > 0 THEN sii.weight ELSE 1 END * sii.price)), 0) AS total_sales,
        COALESCE(SUM(
          (COALESCE(NULLIF(sii.amount, 0), sii.qty * CASE WHEN COALESCE(sii.weight, 0) > 0 THEN sii.weight ELSE 1 END * sii.price)) - ((CASE WHEN sii.price > 0 THEN COALESCE(NULLIF(sii.amount, 0), sii.qty * CASE WHEN COALESCE(sii.weight, 0) > 0 THEN sii.weight ELSE 1 END * sii.price) / sii.price ELSE sii.qty * CASE WHEN COALESCE(sii.weight, 0) > 0 THEN sii.weight ELSE 1 END END) * COALESCE(
            NULLIF(pc_stock.avg_purchase_price, 0),
            NULLIF(pc_name.avg_purchase_price, 0),
            NULLIF(s.purchase_rate, 0),
            NULLIF(s.purchase_price, 0),
          0
          ))
        ), 0) AS total_profit
      FROM sales_invoice_items sii
      INNER JOIN bills b ON b.id = sii.bill_id
      LEFT JOIN stocks s ON s.id = sii.stock_id
      LEFT JOIN purchase_cost_by_stock pc_stock ON pc_stock.stock_id = sii.stock_id
      LEFT JOIN purchase_cost_by_name pc_name
        ON pc_name.item_key = LOWER(TRIM(COALESCE(sii.item_name, sii.product_name, s.item_name, '')))
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
