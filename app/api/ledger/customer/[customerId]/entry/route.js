import { NextResponse } from 'next/server'
import { addCustomerDebit, addCustomerCredit } from '@/lib/ledger.js'

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

    const side = String(body.side || '').toLowerCase()
    let result

    if (side === 'debit') {
      result = await addCustomerDebit({
        customerId,
        amount: body.amount,
        entryDate: body.entryDate,
        notes: body.notes || '',
        createdBy: body.createdBy || null,
        entryType: body.entryType || 'adjustment_debit',
        description: body.description || 'Manual debit entry',
      })
    } else if (side === 'credit') {
      result = await addCustomerCredit({
        customerId,
        amount: body.amount,
        entryDate: body.entryDate,
        notes: body.notes || '',
        createdBy: body.createdBy || null,
        entryType: body.entryType || 'adjustment_credit',
        description: body.description || 'Manual credit entry',
      })
    } else {
      return NextResponse.json(
        { success: false, message: 'side must be debit or credit' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Ledger entry added successfully',
      data: result,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to add entry' },
      { status: 500 }
    )
  }
}