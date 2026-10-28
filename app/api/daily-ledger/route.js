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
        { success: false, message: 'A valid ledger date is required.' },
        { status: 400 }
      )
    }

    const [
      cashRows,
      cashBalanceRows,
      expenses,
      closingRows,
      priorClosingRows,
      currentCashRows,
      billCashRows,
      expenseCashRows,
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
        `SELECT id, expense_date, amount, notes
         FROM expenses
         WHERE date(expense_date) = date(?)
         ORDER BY id DESC`,
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
        `SELECT *
         FROM counter_closings
         WHERE date(closing_date) <= date(?)
         ORDER BY date(closing_date) DESC, id DESC
         LIMIT 1`,
        [date]
      ),
      db.query(
        `SELECT
           COALESCE(SUM(CASE WHEN tx_type = 'in' THEN amount ELSE -amount END), 0) AS current_cash
         FROM cash_transactions
         WHERE deleted_at IS NULL OR deleted_at = ''`,
        []
      ),
      db.query(
        `SELECT COALESCE(SUM(paid_amount), 0) AS bill_cash
         FROM bills
         WHERE date(invoice_date) <= date(?)
           AND (deleted_at IS NULL OR deleted_at = '')
           AND id NOT IN (
             SELECT reference_id FROM cash_transactions
             WHERE reference_type = 'bill' AND (deleted_at IS NULL OR deleted_at = '')
           )`,
        [date]
      ),
      db.query(
        `SELECT COALESCE(SUM(amount), 0) AS expense_cash
         FROM expenses
         WHERE date(expense_date) <= date(?)
           AND id NOT IN (
             SELECT reference_id FROM cash_transactions
             WHERE reference_type = 'expense' AND (deleted_at IS NULL OR deleted_at = '')
           )`,
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

    // 1. Party Ledger Activity (Customers & Suppliers)
    const customerDebits = partyEntries
      .filter((row) => row.owner_type === 'customer')
      .reduce((sum, row) => sum + number(row.debit), 0)
    const customerCredits = partyEntries
      .filter((row) => row.owner_type === 'customer')
      .reduce((sum, row) => sum + number(row.credit), 0)

    const supplierDebits = partyEntries
      .filter((row) => row.owner_type === 'supplier')
      .reduce((sum, row) => sum + number(row.debit), 0)
    const supplierCredits = partyEntries
      .filter((row) => row.owner_type === 'supplier')
      .reduce((sum, row) => sum + number(row.credit), 0)

    // 2. Cash & Bank Activity
    const cashIn = cashRows
      .filter((row) => row.tx_type === 'in')
      .reduce((sum, row) => sum + number(row.amount), 0)
    const cashOut = cashRows
      .filter((row) => row.tx_type === 'out')
      .reduce((sum, row) => sum + number(row.amount), 0)

    // 3. Invoices Activity (Sales & Purchases)
    const cashRefIds = new Set(
      cashRows.map((r) => `${r.reference_type}_${r.reference_id}`)
    )
    const extraBillCashIn = sales
      .filter((s) => number(s.paid_amount) > 0 && !cashRefIds.has(`bill_${s.id}`))
      .reduce((sum, s) => sum + number(s.paid_amount), 0)
    const extraPurchaseCashOut = purchases
      .filter((p) => number(p.paid_amount) > 0 && !cashRefIds.has(`purchase_${p.id}`))
      .reduce((sum, p) => sum + number(p.paid_amount), 0)

    // 4. Expenses & Invoices Activity
    const expenseTotal = expenses.reduce((sum, row) => sum + number(row.amount), 0)
    const salesTotal = sales.reduce((sum, row) => sum + number(row.total), 0)
    const purchaseTotal = purchases.reduce((sum, row) => sum + number(row.total), 0)

    // Total Day Debit: All debit activity on this date
    // Customers Debit + Supplier Debits + Cash/Bank Out + Extra Purchase Cash + Expenses
    const totalDayDebit = customerDebits + supplierDebits + cashOut + extraPurchaseCashOut + expenseTotal

    // Total Day Credit: All credit activity on this date
    // Customers Credit + Supplier Credits + Cash/Bank In + Extra Bill Cash
    const totalDayCredit = customerCredits + supplierCredits + cashIn + extraBillCashIn

    // Cash in Hand as of date:
    // A) If counter closing exists on this exact date:
    // B) Else if counter closing exists on or prior: baseline physical + net cash
    // C) Else cumulative cash in - cash out
    const cumulativeIn = number(cashBalanceRows[0]?.cash_in)
    const cumulativeOut = number(cashBalanceRows[0]?.cash_out)
    const unrecordedBillCash = number(billCashRows[0]?.bill_cash)
    const unrecordedExpenseCash = number(expenseCashRows[0]?.expense_cash)

    let calculatedCashInHand = 0
    if (closingRows[0] && closingRows[0].physical_amount !== null && closingRows[0].physical_amount !== undefined) {
      calculatedCashInHand = number(closingRows[0].physical_amount)
    } else if (priorClosingRows[0] && priorClosingRows[0].physical_amount !== null && priorClosingRows[0].physical_amount !== undefined) {
      calculatedCashInHand = number(priorClosingRows[0].physical_amount) + (cumulativeIn - cumulativeOut)
    } else {
      calculatedCashInHand = (cumulativeIn - cumulativeOut) + unrecordedBillCash - unrecordedExpenseCash
    }

    const currentStoreCash = number(currentCashRows[0]?.current_cash)

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
          cash_in_hand: calculatedCashInHand,
          current_cash_in_hand: currentStoreCash,
          day_credit: totalDayCredit,
          day_debit: totalDayDebit,
          day_net_cash: totalDayCredit - totalDayDebit,
          sales_total: salesTotal,
          purchase_total: purchaseTotal,
          expense_total: expenseTotal,
          customer_debit: customerDebits,
          customer_credit: customerCredits,
          supplier_debit: supplierDebits,
          supplier_credit: supplierCredits,
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
        expenses: expenses.map((row) => ({ ...row, amount: number(row.amount) })),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Daily ledger could not be loaded.' },
      { status: 500 }
    )
  }
}
