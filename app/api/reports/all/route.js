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

    const costColumn = 'purchase_price'

    const itemProfit = await db.query(
      `SELECT
        sii.stock_id,
        COALESCE(sii.item_name, sii.product_name, s.item_name, 'Item') AS item_name,
        COALESCE(SUM(sii.qty), 0) AS qty_sold,
        COALESCE(SUM(sii.total), 0) AS sales_amount,
        COALESCE(SUM(sii.qty * COALESCE(s.purchase_price, 0)), 0) AS cost_amount,
        COALESCE(SUM(sii.total), 0) - COALESCE(SUM(sii.qty * COALESCE(s.purchase_price, 0)), 0) AS profit_loss
       FROM sales_invoice_items sii
       LEFT JOIN bills b ON b.id = sii.bill_id
       LEFT JOIN stocks s ON s.id = sii.stock_id
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