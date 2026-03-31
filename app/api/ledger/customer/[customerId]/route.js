import { NextResponse } from 'next/server'
import { getCustomerLedger } from '@/lib/ledger.js'

export async function GET(_request, context) {
  try {
    const params = await context.params
    const customerId = Number(params.customerId)

    if (!customerId) {
      return NextResponse.json(
        { success: false, message: 'Invalid customer id' },
        { status: 400 }
      )
    }

    const data = await getCustomerLedger(customerId)

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load ledger' },
      { status: 500 }
    )
  }
}