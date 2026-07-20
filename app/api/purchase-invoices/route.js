import db from '@/lib/db'
import { NextResponse } from 'next/server'
import { ensureSupplierLedgerAccount, recalculateAccountBalances } from '@/lib/ledger.js'

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

export async function GET() {
  try {
    const rows = await db.query(`
      SELECT *
      FROM purchase_invoices
      WHERE deleted_at IS NULL OR deleted_at = ''
      ORDER BY id DESC
    `)

    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load purchase invoices' },
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    const body = await req.json()

    const supplierName = clean(body.supplierName || body.supplier_name)
    let supplierId = toNumber(body.supplierId || body.supplier_id)
    const brokerName = clean(body.brokerName || body.broker_name)
    const warehouseName = clean(body.warehouseName || body.warehouse_name)
    const invoiceType = clean(body.invoiceType || body.invoice_type, 'purchase')
    const purchaseDate = clean(body.purchaseDate || body.purchase_date || body.invoiceDate, today())
    const transportExpense = toNumber(body.transportExpense || body.transport_expense)
    const notes = clean(body.notes)

    const items = Array.isArray(body.items) ? body.items : []

    if (!items.length) {
      throw new Error('Purchase invoice items required hain')
    }

    const safeItems = items.map((item, index) => {
      const itemName = clean(item.itemName || item.item_name || item.productName || item.product_name)
      const qty = toNumber(item.qty || 1)
      const weight = toNumber(item.weight)
      const weightUnit = clean(item.weightUnit || item.weight_unit, 'kg')
      const price = toNumber(item.price || item.cost_price || item.purchase_price)
      const amount = qty * price
      const discount = toNumber(item.discount)
      const tax = toNumber(item.tax)
      const total = amount - discount + tax

      if (!itemName) throw new Error(`Item #${index + 1}: item name required hai`)
      if (qty <= 0) throw new Error(`Item #${index + 1}: qty required hai`)
      if (price < 0) throw new Error(`Item #${index + 1}: price invalid hai`)

      return {
        itemName,
        qty,
        weight,
        weightUnit,
        price,
        amount,
        discount,
        tax,
        total,
      }
    })

    const subtotal = safeItems.reduce((sum, item) => sum + item.amount, 0)
    const itemsDiscount = safeItems.reduce((sum, item) => sum + item.discount, 0)
    const itemsTax = safeItems.reduce((sum, item) => sum + item.tax, 0)
    const total = subtotal - itemsDiscount + itemsTax + transportExpense

    if (!supplierId && supplierName) {
      const supplierRows = await db.query(
        `SELECT id FROM suppliers
         WHERE LOWER(name) = LOWER(?)
           AND (deleted_at IS NULL OR deleted_at = '')
         LIMIT 1`,
        [supplierName]
      )

      supplierId = toNumber(supplierRows[0]?.id)
    }

    let supplierAccount = null
    if (supplierId) {
      supplierAccount = await ensureSupplierLedgerAccount(supplierId)
    }

    const purchaseNo = `PUR-${Date.now()}`
    const sqlite = db.getConnection()

    const result = sqlite.transaction(() => {
      const invoiceInsert = sqlite.prepare(`
        INSERT INTO purchase_invoices (
          invoice_no,
          purchase_no,
          supplier_id,
          supplier_name,
          invoice_type,
          invoice_date,
          subtotal,
          discount,
          tax,
          shipping,
          transport_expense,
          total,
          paid_amount,
          remaining_amount,
          payment_type,
          payment_status,
          broker_name,
          warehouse_name,
          notes,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)

      let paidAmount = toNumber(body.paidAmount || body.paid_amount)
      const paymentType = clean(body.paymentType || body.payment_type, 'credit')

      let paymentStatus = 'unpaid'
      let remainingAmount = total

      if (paymentType === 'cash') {
        paidAmount = total
        paymentStatus = 'paid'
        remainingAmount = 0
      }

      if (paymentType === 'partial') {
        paymentStatus = paidAmount >= total ? 'paid' : 'partial'
        remainingAmount = total - paidAmount
      }

      if (paymentType === 'credit') {
        paymentStatus = 'unpaid'
        remainingAmount = total
      }

      const invoiceResult = invoiceInsert.run(
        purchaseNo,
        purchaseNo,
        supplierId || null,
        supplierName,
        invoiceType,
        purchaseDate,
        subtotal,
        itemsDiscount,
        itemsTax,
        transportExpense,
        transportExpense,
        total,
        paidAmount,
        remainingAmount,
        paymentType,
        paymentStatus,
        brokerName,
        warehouseName,
        notes
      )

      const purchaseInvoiceId = Number(invoiceResult.lastInsertRowid)

      const itemInsert = sqlite.prepare(`
        INSERT INTO purchase_invoice_items (
          purchase_invoice_id,
          stock_id,
          product_name,
          item_name,
          qty,
          weight,
          weight_unit,
          price,
          amount,
          discount,
          tax,
          total,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)

      const findStock = sqlite.prepare(`
        SELECT *
        FROM stocks
        WHERE LOWER(item_name) = LOWER(?)
        LIMIT 1
      `)

      const stockInsert = sqlite.prepare(`
        INSERT INTO stocks (
          item_code,
          item_name,
          category,
          quantity,
          qty,
          purchase_price,
          selling_price,
          sale_price,
          supplier_name,
          purchase_date,
          status,
          weight,
          weight_unit,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)

      const stockUpdate = sqlite.prepare(`
        UPDATE stocks
        SET
          quantity = quantity + ?,
          qty = qty + ?,
          purchase_date = ?,
          supplier_name = '',
          weight = 0,
          weight_unit = 'kg',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)

      const movementInsert = sqlite.prepare(`
        INSERT INTO stock_movements (
          stock_id,
          movement_type,
          movement_date,
          reference_type,
          reference_id,
          qty,
          notes,
          created_at
        )
        VALUES (?, 'purchase_in', ?, 'purchase_invoice', ?, ?, ?, CURRENT_TIMESTAMP)
      `)

      for (const item of safeItems) {
        const existingStock = findStock.get(item.itemName)
        let stockId = null

        if (existingStock) {
          stockId = existingStock.id

          stockUpdate.run(
            item.qty,
            item.qty,
            purchaseDate,
            stockId
          )
        } else {
          const code = `ITM-${Date.now()}-${Math.floor(Math.random() * 1000)}`

          const stockResult = stockInsert.run(
            code,
            item.itemName,
            '',
            item.qty,
            item.qty,
            0,
            0,
            0,
            '',
            purchaseDate,
            0,
            'kg'
          )

          stockId = Number(stockResult.lastInsertRowid)
        }

        itemInsert.run(
          purchaseInvoiceId,
          stockId,
          item.itemName,
          item.itemName,
          item.qty,
          item.weight,
          item.weightUnit,
          item.price,
          item.amount,
          item.discount,
          item.tax,
          item.total
        )

        movementInsert.run(
          stockId,
          purchaseDate,
          purchaseInvoiceId,
          item.qty,
          `Purchase invoice ${purchaseNo}`
        )
      }

      if (supplierAccount && total > 0) {
        sqlite.prepare(`
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
            created_at,
            updated_at
          ) VALUES (?, ?, 'purchase_credit', 'purchase_invoice', ?, 0, ?, 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          supplierAccount.id,
          purchaseDate,
          purchaseInvoiceId,
          total,
          `Purchase invoice ${purchaseNo}`,
          notes
        )

        if (paidAmount > 0) {
          sqlite.prepare(`
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
              created_at,
              updated_at
            ) VALUES (?, ?, 'supplier_payment', 'purchase_invoice', ?, ?, 0, 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run(
            supplierAccount.id,
            purchaseDate,
            purchaseInvoiceId,
            paidAmount,
            `Payment paid against purchase ${purchaseNo}`,
            notes
          )

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
              created_at,
              updated_at
            ) VALUES (?, 'out', 'purchase_payment', 'purchase_invoice', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run(
            purchaseDate,
            purchaseInvoiceId,
            paidAmount,
            paymentType === 'partial' ? 'cash' : paymentType,
            'Business',
            `Purchase payment paid ${purchaseNo}`,
            notes
          )
        }

        recalculateAccountBalances(sqlite, supplierAccount.id, 'credit-debit')
      }

      return {
        id: purchaseInvoiceId,
        purchase_no: purchaseNo,
        invoice_no: purchaseNo,
        supplier_id: supplierId || null,
        total,
      }
    })()

    return NextResponse.json({
      success: true,
      message: 'Purchase invoice saved successfully',
      data: result,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to save purchase invoice' },
      { status: 500 }
    )
  }
}
