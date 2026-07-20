import { NextResponse } from 'next/server'
import { getSupplierLedger } from '@/lib/ledger.js'

export async function GET(_request, context) {
  try {
    const params = await context.params
    const supplierId = Number(params.supplierId)

    if (!supplierId) {
      return NextResponse.json(
        { success: false, message: 'Invalid supplier id' },
        { status: 400 }
      )
    }

    const data = await getSupplierLedger(supplierId)

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load supplier ledger' },
      { status: 500 }
    )
  }
}
