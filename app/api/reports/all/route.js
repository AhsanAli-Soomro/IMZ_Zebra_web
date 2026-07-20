import { NextResponse } from 'next/server'
import db from '@/lib/db.js'

function num(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n : 0
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)

    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''

    const dateWhere = []
    const dateParams = []

    if (dateFrom) {
      dateWhere.push(`date(b.invoice_date) >= date(?)`)
      dateParams.push(dateFrom)
    }

    if (dateTo) {
      dateWhere.push(`date(b.invoice_date) <= date(?)`)
      dateParams.push(dateTo)
    }

    const salesWhere = [
      `(b.deleted_at IS NULL OR b.deleted_at = '')`,
      ...dateWhere,
    ]

    const whereSql = salesWhere.length
      ? `WHERE ${salesWhere.join(' AND ')}`
      : ''

    const dailySales = await db.query(
      `SELECT
        b.invoice_date AS date,
        COUNT(*) AS invoices,
        COALESCE(SUM(b.total), 0) AS total_sales,
        COALESCE(SUM(b.paid_amount), 0) AS paid,
        COALESCE(SUM(b.remaining_amount), 0) AS remaining
       FROM bills b
       ${whereSql}
       GROUP BY b.invoice_date
       ORDER BY date(b.invoice_date) DESC`,
      dateParams
    )

    const monthlySales = await db.query(
      `SELECT
        strftime('%Y-%m', b.invoice_date) AS month,
        COUNT(*) AS invoices,
        COALESCE(SUM(b.total), 0) AS total_sales,
        COALESCE(SUM(b.paid_amount), 0) AS paid,
        COALESCE(SUM(b.remaining_amount), 0) AS remaining
       FROM bills b
       ${whereSql}
       GROUP BY strftime('%Y-%m', b.invoice_date)
       ORDER BY month DESC`,
      dateParams
    )

    const yearlySales = await db.query(
      `SELECT
        strftime('%Y', b.invoice_date) AS year,
        COUNT(*) AS invoices,
        COALESCE(SUM(b.total), 0) AS total_sales,
        COALESCE(SUM(b.paid_amount), 0) AS paid,
        COALESCE(SUM(b.remaining_amount), 0) AS remaining
       FROM bills b
       ${whereSql}
       GROUP BY strftime('%Y', b.invoice_date)
       ORDER BY year DESC`,
      dateParams
    )

    const purchaseWhere = []
    const purchaseParams = []

    if (dateFrom) {
      purchaseWhere.push(`date(invoice_date) >= date(?)`)
      purchaseParams.push(dateFrom)
    }

    if (dateTo) {
      purchaseWhere.push(`date(invoice_date) <= date(?)`)
      purchaseParams.push(dateTo)
    }

    const purchaseSql = purchaseWhere.length
      ? `WHERE ${purchaseWhere.join(' AND ')}`
      : ''

    const purchaseReports = await db.query(
      `SELECT
        invoice_date AS date,
        COUNT(*) AS invoices,
        COALESCE(SUM(total), 0) AS total_purchase,
        COALESCE(SUM(paid_amount), 0) AS paid,
        COALESCE(SUM(remaining_amount), 0) AS remaining
       FROM purchase_invoices
       ${purchaseSql}
       GROUP BY invoice_date
       ORDER BY date(invoice_date) DESC`,
      purchaseParams
    )

    const totalSalesRows = await db.query(
      `SELECT COALESCE(SUM(b.total), 0) AS total_sales
       FROM bills b
       ${whereSql}`,
      dateParams
    )

    const totalPurchaseRows = await db.query(
      `SELECT COALESCE(SUM(total), 0) AS total_purchases
       FROM purchase_invoices
       ${purchaseSql}`,
      purchaseParams
    )

    const costColumn = 'purchase_invoice_items.price'

    const itemProfit = await db.query(
      `WITH purchase_cost AS (
        SELECT
          stock_id,
          CASE
            WHEN COALESCE(SUM(qty), 0) > 0
            THEN COALESCE(SUM(amount), SUM(qty * price), 0) / SUM(qty)
            ELSE 0
          END AS avg_purchase_price
        FROM purchase_invoice_items
        GROUP BY stock_id
      )
       SELECT
        sii.stock_id,
        COALESCE(sii.item_name, sii.product_name, s.item_name, 'Item') AS item_name,
        COALESCE(SUM(sii.qty), 0) AS qty_sold,
        COALESCE(SUM(COALESCE(sii.amount, sii.qty * sii.price)), 0) AS sales_amount,
        COALESCE(SUM(sii.qty * COALESCE(pc.avg_purchase_price, 0)), 0) AS cost_amount,
        COALESCE(SUM(COALESCE(sii.amount, sii.qty * sii.price)), 0) - COALESCE(SUM(sii.qty * COALESCE(pc.avg_purchase_price, 0)), 0) AS profit_loss
       FROM sales_invoice_items sii
       LEFT JOIN bills b ON b.id = sii.bill_id
       LEFT JOIN stocks s ON s.id = sii.stock_id
       LEFT JOIN purchase_cost pc ON pc.stock_id = sii.stock_id
       ${whereSql}
       GROUP BY
         sii.stock_id,
         COALESCE(sii.item_name, sii.product_name, s.item_name, 'Item')
       ORDER BY profit_loss DESC`,
      dateParams
    )

    const soldSalesAmount = itemProfit.reduce(
      (sum, row) => sum + num(row.sales_amount),
      0
    )

    const soldPurchaseCost = itemProfit.reduce(
      (sum, row) => sum + num(row.cost_amount),
      0
    )

    const soldGrossProfit = itemProfit.reduce(
      (sum, row) => sum + num(row.profit_loss),
      0
    )

    const profitSummary = {
      total_sales: num(totalSalesRows[0]?.total_sales),
      total_purchases: num(totalPurchaseRows[0]?.total_purchases),
      sold_sales: soldSalesAmount,
      sold_purchase_cost: soldPurchaseCost,
      sold_gross_profit: soldGrossProfit,
    }

    const transportRows = await db.query(
      `SELECT
        (SELECT COALESCE(SUM(shipping), 0)
         FROM bills b
         ${whereSql}) AS sales_transport,
        (SELECT COALESCE(SUM(transport_expense), 0)
         FROM purchase_invoices
         ${purchaseSql}) AS purchase_transport`,
      [...dateParams, ...purchaseParams]
    )

    const totalTransport = num(transportRows[0]?.sales_transport) + num(transportRows[0]?.purchase_transport)
    const grossProfit = num(profitSummary.sold_gross_profit)
    const netProfit = grossProfit - totalTransport

    profitSummary.total_transport_expenses = totalTransport
    profitSummary.gross_profit = grossProfit
    profitSummary.net_profit = netProfit
    profitSummary.loss = netProfit < 0 ? Math.abs(netProfit) : 0

    const stockSummary = await db.query(`
      SELECT
        COUNT(*) AS product_count,
        COALESCE(SUM(quantity), 0) AS available_stock,
        COALESCE(SUM(CASE WHEN quantity <= COALESCE(NULLIF(reorder_level, 0), 5) THEN 1 ELSE 0 END), 0) AS low_stock_count
      FROM stocks
      WHERE deleted_at IS NULL OR deleted_at = ''
    `)

    const stockMovements = await db.query(`
      SELECT
        sm.id,
        sm.movement_date,
        sm.movement_type,
        sm.qty,
        s.item_name
      FROM stock_movements sm
      LEFT JOIN stocks s ON s.id = sm.stock_id
      ORDER BY date(sm.movement_date) DESC, sm.id DESC
      LIMIT 20
    `)

    const bankSummary = await db.query(`
      SELECT
        COUNT(*) AS account_count,
        COALESCE(SUM(current_balance), 0) AS bank_balance
      FROM bank_accounts
      WHERE deleted_at IS NULL OR deleted_at = ''
    `)

    const recentTransactions = await db.query(`
      SELECT tx_date AS date, tx_type AS type, category, amount, description
      FROM cash_transactions
      WHERE deleted_at IS NULL OR deleted_at = ''
      UNION ALL
      SELECT tx_date AS date, tx_type AS type, 'bank' AS category, amount, description
      FROM bank_transactions
      WHERE deleted_at IS NULL OR deleted_at = ''
      ORDER BY date DESC
      LIMIT 20
    `)

    return NextResponse.json({
      success: true,
      data: {
        dailySales,
        monthlySales,
        yearlySales,
        purchaseReports,
        profitSummary,
        itemProfit,
        costColumn,
        stockSummary: {
          product_count: num(stockSummary[0]?.product_count),
          available_stock: num(stockSummary[0]?.available_stock),
          low_stock_count: num(stockSummary[0]?.low_stock_count),
        },
        stockMovements,
        bankSummary: {
          account_count: num(bankSummary[0]?.account_count),
          bank_balance: num(bankSummary[0]?.bank_balance),
        },
        recentTransactions,
      },
    })
  } catch (error) {
    console.error('Reports API error:', error)

    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Reports failed',
      },
      { status: 500 }
    )
  }
}
