import db from '@/lib/db'
import { NextResponse } from 'next/server'
import {
  ensureSupplierLedgerAccount,
  recalculateAccountBalances,
} from '@/lib/ledger.js'

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function clean(value, fallback = '') {
  if (value === null || value === undefined) return fallback
  const text = String(value).trim()
  return text || fallback
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export async function POST(request, context) {
  try {
    const params = await context.params
    const invoiceId = Number(params.id)
    const body = await request.json()

    if (!invoiceId) {
      return NextResponse.json(
        { success: false, message: 'Invalid purchase invoice id' },
        { status: 400 }
      )
    }

    const amount = toNumber(body.amount)
    if (amount <= 0) {
      throw new Error('Valid payment amount required')
    }

    const invoiceRows = await db.query(
      `SELECT *
       FROM purchase_invoices
       WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')
       LIMIT 1`,
      [invoiceId]
    )
    const invoice = invoiceRows[0]

    if (!invoice) {
      throw new Error('Purchase invoice not found')
    }

    const remaining = toNumber(invoice.remaining_amount)
    if (remaining <= 0) {
      throw new Error('This purchase invoice is already fully paid')
    }

    if (amount > remaining) {
      throw new Error('Payment amount cannot be greater than remaining amount')
    }

    let supplierId = toNumber(invoice.supplier_id)
    if (!supplierId && invoice.supplier_name) {
      const supplierRows = await db.query(
        `SELECT id FROM suppliers
         WHERE LOWER(name) = LOWER(?)
           AND (deleted_at IS NULL OR deleted_at = '')
         LIMIT 1`,
        [invoice.supplier_name]
      )
      supplierId = toNumber(supplierRows[0]?.id)
    }

    if (!supplierId) {
      throw new Error('Supplier not linked with this purchase invoice')
    }

    const supplierAccount = await ensureSupplierLedgerAccount(supplierId)
    const paymentDate = clean(body.paymentDate || body.entryDate, today())
    const paymentMethod = clean(body.paymentMethod, 'cash')
    const sourceOfPayment = clean(body.sourceOfPayment, 'Business')
    const notes = clean(body.notes)
    const createdBy = body.createdBy || null
    const sqlite = db.getConnection()

    const result = sqlite.transaction(() => {
      const newPaidAmount = toNumber(invoice.paid_amount) + amount
      const newRemainingAmount = toNumber(invoice.total) - newPaidAmount
      const paymentStatus =
        newRemainingAmount <= 0 ? 'paid' : newPaidAmount > 0 ? 'partial' : 'unpaid'

      sqlite.prepare(`
        UPDATE purchase_invoices
        SET paid_amount = ?,
            remaining_amount = ?,
            payment_status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newPaidAmount, newRemainingAmount, paymentStatus, invoiceId)

      sqlite.prepare(`
        INSERT INTO cash_transactions (
          tx_date,
          tx_type,
          category,
          reference_type,
          reference_id,
          amount,
          payment_method,
          source_of_payment,
          description,
          notes,
          created_by,
          created_at,
          updated_at
        ) VALUES (?, 'out', 'purchase_payment', 'purchase_invoice', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        paymentDate,
        invoiceId,
        amount,
        paymentMethod,
        sourceOfPayment,
        `Purchase payment paid ${invoice.purchase_no || invoice.invoice_no || invoiceId}`,
        notes,
        createdBy
      )

      const entryResult = sqlite.prepare(`
        INSERT INTO ledger_entries (
          account_id,
          entry_date,
          entry_type,
          reference_type,
          reference_id,
          debit,
          credit,
          balance_after,
          description,
          notes,
          created_by,
          created_at,
          updated_at
        ) VALUES (?, ?, 'supplier_payment', 'purchase_invoice', ?, ?, 0, 0, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        supplierAccount.id,
        paymentDate,
        invoiceId,
        amount,
        `Payment paid against purchase ${invoice.purchase_no || invoice.invoice_no || invoiceId}`,
        notes,
        createdBy
      )

      recalculateAccountBalances(sqlite, supplierAccount.id, 'credit-debit')

      return {
        invoice_id: invoiceId,
        purchase_no: invoice.purchase_no || invoice.invoice_no,
        payment_entry_id: Number(entryResult.lastInsertRowid || 0),
        payment_paid: amount,
        paid_amount: newPaidAmount,
        remaining_amount: newRemainingAmount,
        payment_status: paymentStatus,
      }
    })()

    return NextResponse.json({
      success: true,
      message: 'Purchase payment paid successfully',
      data: result,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to pay purchase invoice' },
      { status: 500 }
    )
  }
}
