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

    const stockRows = await db.query(`
      SELECT
        COUNT(*) AS product_count,
        COALESCE(SUM(COALESCE(quantity, qty, 0)), 0) AS available_stock,
        COALESCE(SUM(CASE WHEN COALESCE(quantity, qty, 0) <= COALESCE(NULLIF(reorder_level, 0), 5) THEN 1 ELSE 0 END), 0) AS low_stock_count
      FROM stocks
      WHERE (deleted_at IS NULL OR deleted_at = '')
    `)

    const profitRows = await db.query(`
      WITH purchase_cost_by_stock AS (
        SELECT
          stock_id,
          CASE
            WHEN COALESCE(SUM(qty), 0) > 0
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
      SELECT COALESCE(SUM(
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
      WHERE b.deleted_at IS NULL OR b.deleted_at = ''
    `)

    const purchaseRows = await db.query(`
      SELECT
        COALESCE(SUM(total), 0) AS total_purchase_amount,
        COALESCE(SUM(transport_expense), 0) AS purchase_transport
      FROM purchase_invoices
      WHERE deleted_at IS NULL OR deleted_at = ''
    `)

    const salesTransportRows = await db.query(`
      SELECT COALESCE(SUM(shipping), 0) AS sales_transport
      FROM bills
      WHERE deleted_at IS NULL OR deleted_at = ''
    `)

    const bankRows = await db.query(`
      SELECT COALESCE(SUM(current_balance), 0) AS bank_balance
      FROM bank_accounts
      WHERE deleted_at IS NULL OR deleted_at = ''
    `)

    const totalTransport =
      Number(purchaseRows[0]?.purchase_transport || 0) +
      Number(salesTransportRows[0]?.sales_transport || 0)
    const grossProfit = Number(profitRows[0]?.total_profit || 0)
    const netProfit = grossProfit - totalTransport

    const data = {
      total_invoices: Number(invoiceRows[0]?.total_invoices || 0),
      total_revenue: Number(invoiceRows[0]?.total_revenue || 0),
      total_products_sold: Number(soldRows[0]?.total_products_sold || 0),
      total_profit: grossProfit,
      gross_profit: grossProfit,
      net_profit: netProfit,
      loss: netProfit < 0 ? Math.abs(netProfit) : 0,
      total_purchase_amount: Number(purchaseRows[0]?.total_purchase_amount || 0),
      total_transport_expenses: totalTransport,
      available_stock: Number(stockRows[0]?.available_stock || 0),
      stock_count: Number(stockRows[0]?.product_count || 0),
      low_stock_count: Number(stockRows[0]?.low_stock_count || 0),
      bank_balance: Number(bankRows[0]?.bank_balance || 0),
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
