import { NextResponse } from 'next/server'
import { paySupplier } from '@/lib/ledger.js'

export async function POST(request, context) {
  try {
    const params = await context.params
    const supplierId = Number(params.supplierId)
    const body = await request.json()

    if (!supplierId) {
      return NextResponse.json(
        { success: false, message: 'Invalid supplier id' },
        { status: 400 }
      )
    }

    const result = await paySupplier({
      supplierId,
      amount: body.amount,
      entryDate: body.entryDate,
      notes: body.notes || '',
      createdBy: body.createdBy || null,
      paymentMethod: body.paymentMethod || 'cash',
      sourceOfPayment: body.sourceOfPayment || 'Business',
      bankAccountId: body.bankAccountId || null,
    })

    return NextResponse.json({
      success: true,
      message: 'Supplier payment paid successfully',
      data: result,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Supplier payment failed' },
      { status: 500 }
    )
  }
}
