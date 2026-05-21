import { NextResponse } from 'next/server'
import { receiveInvoicePayment } from '@/lib/invoices.js'

export async function POST(request, context) {
  try {
    const params = await context.params
    const invoiceId = Number(params.id)
    const body = await request.json()

    if (!invoiceId) {
      return NextResponse.json(
        { success: false, message: 'Invalid invoice id' },
        { status: 400 }
      )
    }

    const result = await receiveInvoicePayment({
      invoiceId,
      amount: body.amount,
      paymentDate: body.paymentDate || null,
      paymentMethod: body.paymentMethod || 'cash',
      sourceOfPayment: body.sourceOfPayment || 'Customer',
      notes: body.notes || '',
      createdBy: body.createdBy || null,
    })

    return NextResponse.json({
      success: true,
      message: 'Invoice payment received successfully',
      data: result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to receive invoice payment',
      },
      { status: 500 }
    )
  }
}