import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { createInvoice } from '@/lib/invoices.js'

export async function POST(req, { params }) {
  try {
    const { id } = await params
    const quotationId = Number(id)

    if (!quotationId) {
      return NextResponse.json({ ok: false, error: 'Valid quotation id is required' }, { status: 400 })
    }

    const qRows = await db.query('SELECT * FROM quotations WHERE id = ? LIMIT 1', [quotationId])
    if (!qRows || !qRows[0]) {
      return NextResponse.json({ ok: false, error: 'Quotation not found' }, { status: 404 })
    }

    const quotation = qRows[0]
    if (quotation.status === 'converted') {
      return NextResponse.json(
        { ok: false, error: `Quotation is already converted to Invoice (Bill #${quotation.converted_invoice_id})` },
        { status: 400 }
      )
    }

    const items = await db.query('SELECT * FROM quotation_items WHERE quotation_id = ?', [quotationId])
    if (!items || items.length === 0) {
      return NextResponse.json({ ok: false, error: 'Quotation has no items to convert' }, { status: 400 })
    }

    // Convert items into standard invoice format
    const invoiceItems = items.map((item) => ({
      stockId: item.product_id,
      stock_id: item.product_id,
      productName: item.product_name,
      qty: Number(item.quantity || 1),
      price: Number(item.unit_price || 0),
    }))

    // Use standard billing transaction logic
    const createdInvoice = await createInvoice({
      customerId: quotation.customer_id,
      invoiceDate: new Date().toISOString().slice(0, 10),
      items: invoiceItems,
      discount: Number(quotation.discount || 0),
      paymentType: 'credit',
      notes: `Converted from Quotation ${quotation.quotation_number}. ${quotation.notes || ''}`.trim(),
    })

    const newInvoiceId = createdInvoice?.invoice?.id || createdInvoice?.id

    // Update quotation status
    await db.query(
      `UPDATE quotations 
       SET status = 'converted', 
           converted_invoice_id = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [newInvoiceId, quotationId]
    )

    return NextResponse.json({
      ok: true,
      message: 'Quotation successfully converted to Sale Invoice!',
      invoice_id: newInvoiceId,
      invoice_no: createdInvoice?.invoice?.invoice_no,
    })
  } catch (err) {
    console.error('Convert quotation error:', err)
    return NextResponse.json({ ok: false, error: err.message || 'Failed to convert quotation' }, { status: 500 })
  }
}
