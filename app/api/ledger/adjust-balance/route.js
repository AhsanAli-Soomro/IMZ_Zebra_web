import { NextResponse } from 'next/server'
import { adjustPartyBalance } from '@/lib/ledger.js'

export async function POST(request) {
  try {
    const body = await request.json()
    const { type, partyId, mode, targetBalance, side, amount, entryDate, notes, createdBy } = body

    if (!type || !partyId) {
      return NextResponse.json(
        { success: false, message: 'type (customer/supplier) and partyId are required.' },
        { status: 400 }
      )
    }

    const result = await adjustPartyBalance({
      type,
      partyId,
      mode: mode || 'direct_balance',
      targetBalance,
      side,
      amount,
      entryDate,
      notes,
      createdBy: createdBy || 1,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Adjust balance error:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to adjust balance' },
      { status: 500 }
    )
  }
}

