import db from '@/lib/db'
import { NextResponse } from 'next/server'

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function GET(_req, context) {
  try {
    const params = await context.params
    const id = Number(params.id)

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Invalid purchase invoice id' },
        { status: 400 }
      )
    }

    const rows = await db.query(
      `
      SELECT *
      FROM purchase_invoices
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    )

    const invoice = rows[0]

    if (!invoice) {
      return NextResponse.json(
        { success: false, message: 'Purchase invoice not found' },
        { status: 404 }
      )
    }

    const items = await db.query(
      `
      SELECT
        pii.*,
        COALESCE(pii.item_name, pii.product_name, s.item_name) AS item_name,
        COALESCE(pii.product_name, pii.item_name, s.item_name) AS product_name
      FROM purchase_invoice_items pii
      LEFT JOIN stocks s ON s.id = pii.stock_id
      WHERE pii.purchase_invoice_id = ?
      ORDER BY pii.id ASC
      `,
      [id]
    )

    return NextResponse.json({
      success: true,
      data: {
        ...invoice,
        invoice_no: invoice.purchase_no || invoice.invoice_no,
        purchase_no: invoice.purchase_no || invoice.invoice_no,
        invoice_date: invoice.invoice_date,
        purchase_date: invoice.invoice_date,
        customer_name: invoice.supplier_name || 'Supplier',
        subtotal: toNumber(invoice.subtotal),
        discount: toNumber(invoice.discount),
        tax: toNumber(invoice.tax),
        shipping: toNumber(invoice.shipping),
        transport_expense: toNumber(invoice.transport_expense || invoice.shipping),
        total: toNumber(invoice.total),
        paid_amount: toNumber(invoice.paid_amount),
        remaining_amount: toNumber(invoice.remaining_amount),
        payment_status: invoice.payment_status || 'unpaid',
        items: items.map((item) => ({
          ...item,
          qty: toNumber(item.qty),
          weight: toNumber(item.weight),
          weight_unit: item.weight_unit || 'kg',
          price: toNumber(item.price || item.cost_price),
          amount: toNumber(item.amount),
          discount: toNumber(item.discount),
          tax: toNumber(item.tax),
          total: toNumber(item.total),
        })),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load purchase invoice' },
      { status: 500 }
    )
  }
}