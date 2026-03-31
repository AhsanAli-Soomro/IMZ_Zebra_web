import { NextResponse } from 'next/server'
import { getCustomersLedgerSummary } from '@/lib/ledger.js'

export async function GET() {
  try {
    const rows = await getCustomersLedgerSummary()

    return NextResponse.json({
      success: true,
      data: rows,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load summary' },
      { status: 500 }
    )
  }
}