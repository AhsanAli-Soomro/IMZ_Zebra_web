import { NextResponse } from 'next/server'
import { addSupplierDebit, addSupplierCredit } from '@/lib/ledger.js'

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

    const side = String(body.side || '').toLowerCase()
    let result

    if (side === 'debit') {
      result = await addSupplierDebit({
        supplierId,
        amount: body.amount,
        entryDate: body.entryDate,
        notes: body.notes || '',
        createdBy: body.createdBy || null,
        entryType: body.entryType || 'supplier_adjustment_debit',
        description: body.description || 'Manual supplier debit entry',
      })
    } else if (side === 'credit') {
      result = await addSupplierCredit({
        supplierId,
        amount: body.amount,
        entryDate: body.entryDate,
        notes: body.notes || '',
        createdBy: body.createdBy || null,
        entryType: body.entryType || 'supplier_adjustment_credit',
        description: body.description || 'Manual supplier credit entry',
      })
    } else {
      return NextResponse.json(
        { success: false, message: 'side must be debit or credit' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Supplier ledger entry added successfully',
      data: result,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to add supplier entry' },
      { status: 500 }
    )
  }
}
