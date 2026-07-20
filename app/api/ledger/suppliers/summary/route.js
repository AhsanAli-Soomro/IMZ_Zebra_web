import { NextResponse } from 'next/server'
import { getSuppliersLedgerSummary } from '@/lib/ledger.js'

export async function GET() {
  try {
    const rows = await getSuppliersLedgerSummary()

    return NextResponse.json({
      success: true,
      data: rows,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load supplier summary' },
      { status: 500 }
    )
  }
}
