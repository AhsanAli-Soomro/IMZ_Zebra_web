import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const totals = await db.query(`
      SELECT 
        COUNT(*) AS total_invoices,
        COALESCE(SUM(net_total), 0) AS total_revenue,
        COALESCE(SUM(net_total - amount_paid), 0) AS total_profit
      FROM billing_history
    `)

    const bills = await db.query(`
      SELECT items
      FROM bills
    `)

    let total_products_sold = 0

    for (const bill of bills) {
      try {
        const items =
          typeof bill.items === 'string'
            ? JSON.parse(bill.items)
            : bill.items

        if (!Array.isArray(items)) continue

        for (const item of items) {
          total_products_sold += Number(item.qty || 0)
        }
      } catch (err) {
        console.error('Failed to parse bill items:', bill.items)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...totals[0],
        total_products_sold
      }
    })
  } catch (err) {
    console.error('Total summary error:', err)
    return NextResponse.json(
      {
        success: true,
        data: {
          total_invoices: 0,
          total_revenue: 0,
          total_profit: 0,
          total_products_sold: 0
        }
      },
      { status: 200 }
    )
  }
}