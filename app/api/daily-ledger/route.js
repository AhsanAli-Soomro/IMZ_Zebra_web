import { NextResponse } from 'next/server'
import db from '@/lib/db.js'

function number(value) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (!validDate(date)) {
      return NextResponse.json(
        { success: false, message: 'Valid ledger date required hai' },
        { status: 400 }
      )
    }

    const [
      cashRows,
      cashBalanceRows,
      closingRows,
      sales,
      purchases,
      partyEntries,
    ] = await Promise.all([
      db.query(
        `SELECT *
         FROM cash_transactions
         WHERE date(tx_date) = date(?)
           AND (deleted_at IS NULL OR deleted_at = '')
         ORDER BY id DESC`,
        [date]
      ),
      db.query(
        `SELECT
           COALESCE(SUM(CASE WHEN tx_type = 'in' THEN amount ELSE 0 END), 0) AS cash_in,
           COALESCE(SUM(CASE WHEN tx_type = 'out' THEN amount ELSE 0 END), 0) AS cash_out
         FROM cash_transactions
         WHERE date(tx_date) <= date(?)
           AND (deleted_at IS NULL OR deleted_at = '')`,
        [date]
      ),
      db.query(
        `SELECT *
         FROM counter_closings
         WHERE date(closing_date) = date(?)
         LIMIT 1`,
        [date]
      ),
      db.query(
        `SELECT id, invoice_no, customer_id, customer_name, total, paid_amount,
                remaining_amount, payment_type, payment_status, invoice_date
         FROM bills
         WHERE date(invoice_date) = date(?)
           AND (deleted_at IS NULL OR deleted_at = '')
         ORDER BY id DESC`,
        [date]
      ),
      db.query(
        `SELECT id, COALESCE(purchase_no, invoice_no) AS invoice_no,
                supplier_id, supplier_name, total, paid_amount, remaining_amount,
                payment_type, payment_status,
                COALESCE(purchase_date, invoice_date) AS invoice_date
         FROM purchase_invoices
         WHERE date(COALESCE(purchase_date, invoice_date)) = date(?)
           AND (deleted_at IS NULL OR deleted_at = '')
         ORDER BY id DESC`,
        [date]
      ),
      db.query(
        `SELECT
           le.id, le.entry_date, le.entry_type, le.reference_type, le.reference_id,
           le.debit, le.credit, le.balance_after, le.description, le.notes,
           la.owner_type, la.owner_id,
           CASE
             WHEN la.owner_type = 'customer' THEN COALESCE(c.name, la.account_name)
             WHEN la.owner_type = 'supplier' THEN COALESCE(s.name, la.account_name)
             ELSE la.account_name
           END AS party_name
         FROM ledger_entries le
         INNER JOIN ledger_accounts la ON la.id = le.account_id
         LEFT JOIN customers c ON la.owner_type = 'customer' AND c.id = la.owner_id
         LEFT JOIN suppliers s ON la.owner_type = 'supplier' AND s.id = la.owner_id
         WHERE date(le.entry_date) = date(?)
           AND (le.deleted_at IS NULL OR le.deleted_at = '')
         ORDER BY le.id DESC`,
        [date]
      ),
    ])

    const dayCredit = cashRows
      .filter((row) => row.tx_type === 'in')
      .reduce((sum, row) => sum + number(row.amount), 0)
    const dayDebit = cashRows
      .filter((row) => row.tx_type === 'out')
      .reduce((sum, row) => sum + number(row.amount), 0)
    const cumulativeIn = number(cashBalanceRows[0]?.cash_in)
    const cumulativeOut = number(cashBalanceRows[0]?.cash_out)

    const normalizeInvoices = (rows) => rows.map((row) => ({
      ...row,
      total: number(row.total),
      paid_amount: number(row.paid_amount),
      remaining_amount: number(row.remaining_amount),
    }))

    return NextResponse.json({
      success: true,
      data: {
        date,
        summary: {
          cash_in_hand: cumulativeIn - cumulativeOut,
          day_credit: dayCredit,
          day_debit: dayDebit,
          day_net_cash: dayCredit - dayDebit,
          sales_total: sales.reduce((sum, row) => sum + number(row.total), 0),
          purchase_total: purchases.reduce((sum, row) => sum + number(row.total), 0),
        },
        closing: closingRows[0] || null,
        cashTransactions: cashRows.map((row) => ({ ...row, amount: number(row.amount) })),
        sales: normalizeInvoices(sales),
        purchases: normalizeInvoices(purchases),
        customerEntries: partyEntries
          .filter((row) => row.owner_type === 'customer')
          .map((row) => ({
            ...row,
            debit: number(row.debit),
            credit: number(row.credit),
            balance_after: number(row.balance_after),
          })),
        supplierEntries: partyEntries
          .filter((row) => row.owner_type === 'supplier')
          .map((row) => ({
            ...row,
            debit: number(row.debit),
            credit: number(row.credit),
            balance_after: number(row.balance_after),
          })),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Daily ledger load nahi ho saka' },
      { status: 500 }
    )
  }
}
