import { NextResponse } from 'next/server'
import { receiveCustomerPayment } from '@/lib/ledger.js'

export async function POST(request, context) {
  try {
    const params = await context.params
    const customerId = Number(params.customerId)
    const body = await request.json()

    if (!customerId) {
      return NextResponse.json(
        { success: false, message: 'Invalid customer id' },
        { status: 400 }
      )
    }

    const result = await receiveCustomerPayment({
      customerId,
      amount: body.amount,
      entryDate: body.entryDate,
      notes: body.notes || '',
      createdBy: body.createdBy || null,
      paymentMethod: body.paymentMethod || 'cash',
      sourceOfPayment: body.sourceOfPayment || 'Customer',
      bankAccountId: body.bankAccountId || null,
    })

    return NextResponse.json({
      success: true,
      message: 'Payment received successfully',
      data: result,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Payment failed' },
      { status: 500 }
    )
  }
}
