import { NextResponse } from 'next/server'
import db from '@/lib/db.js'

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (!['customer', 'supplier'].includes(type)) {
      return NextResponse.json(
        { success: false, message: 'Ledger type customer ya supplier hona chahiye' },
        { status: 400 }
      )
    }

    const isCustomer = type === 'customer'
    const partyTable = isCustomer ? 'customers' : 'suppliers'
    const partyName = isCustomer
      ? `COALESCE(p.name, 'Customer ' || p.id)`
      : `COALESCE(NULLIF(p.company_name, ''), p.name, 'Supplier ' || p.id)`

    const entries = await db.query(`
      SELECT
        le.id,
        le.account_id,
        la.owner_id AS party_id,
        ${partyName} AS party_name,
        le.entry_date,
        le.entry_type,
        le.reference_type,
        le.reference_id,
        le.debit,
        le.credit,
        le.balance_after,
        le.description,
        le.notes,
        le.created_at,
        (SELECT ct.payment_method
         FROM cash_transactions ct
         WHERE ct.reference_type = 'ledger_entry'
           AND ct.reference_id = le.id
           AND ct.deleted_at IS NULL
         ORDER BY ct.id DESC LIMIT 1) AS payment_method,
        (SELECT ct.source_of_payment
         FROM cash_transactions ct
         WHERE ct.reference_type = 'ledger_entry'
           AND ct.reference_id = le.id
           AND ct.deleted_at IS NULL
         ORDER BY ct.id DESC LIMIT 1) AS source_of_payment
      FROM ledger_entries le
      INNER JOIN ledger_accounts la ON la.id = le.account_id
      INNER JOIN ${partyTable} p ON p.id = la.owner_id
      WHERE la.owner_type = ?
        AND le.deleted_at IS NULL
        AND (p.deleted_at IS NULL OR p.deleted_at = '')
      ORDER BY le.entry_date ASC, le.id ASC
    `, [type])

    const normalizedEntries = entries.map((entry) => ({
      ...entry,
      debit: number(entry.debit),
      credit: number(entry.credit),
      balance_after: number(entry.balance_after),
    }))
    const totalDebit = normalizedEntries.reduce((sum, entry) => sum + entry.debit, 0)
    const totalCredit = normalizedEntries.reduce((sum, entry) => sum + entry.credit, 0)

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_debit: totalDebit,
          total_credit: totalCredit,
          balance: isCustomer ? totalDebit - totalCredit : totalCredit - totalDebit,
        },
        entries: normalizedEntries,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Ledger history load nahi hui' },
      { status: 500 }
    )
  }
}
