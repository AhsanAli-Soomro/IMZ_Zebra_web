import db from './db.js'
import { ensureCustomerLedgerAccount } from './ledger.js'

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function cleanText(value, fallback = '') {
  if (value === null || value === undefined) return fallback
  const text = String(value).trim()
  return text || fallback
}

async function getCustomerById(customerId) {
  if (!customerId) return null

  const rows = await db.query(
    `SELECT *
     FROM customers
     WHERE id = ?
     LIMIT 1`,
    [customerId]
  )

  return rows[0] || null
}

async function getStockById(stockId) {
  const rows = await db.query(
    `SELECT *
     FROM stocks
     WHERE id = ?
     LIMIT 1`,
    [stockId]
  )

  return rows[0] || null
}

async function getCustomerLedgerAccount(customerId) {
  await ensureCustomerLedgerAccount(customerId)

  const rows = await db.query(
    `SELECT *
     FROM ledger_accounts
     WHERE owner_type = 'customer' AND owner_id = ?
     LIMIT 1`,
    [customerId]
  )

  return rows[0] || null
}

async function getAccountCurrentBalance(accountId) {
  const rows = await db.query(
    `SELECT
       COALESCE(SUM(debit), 0) AS total_debit,
       COALESCE(SUM(credit), 0) AS total_credit,
       COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) AS balance
     FROM ledger_entries
     WHERE account_id = ? AND deleted_at IS NULL`,
    [accountId]
  )

  return toNumber(rows[0]?.balance, 0)
}

async function generateNextInvoiceNo() {
  const rows = await db.query(
    `SELECT invoice_prefix
     FROM company_profile
     ORDER BY id ASC
     LIMIT 1`
  )

  const prefix = cleanText(rows[0]?.invoice_prefix, 'INV')

  const lastRows = await db.query(
    `SELECT invoice_no
     FROM bills
     WHERE invoice_no IS NOT NULL AND invoice_no != ''
     ORDER BY id DESC
     LIMIT 1`
  )

  const lastInvoiceNo = cleanText(lastRows[0]?.invoice_no)
  let nextNumber = 1

  if (lastInvoiceNo) {
    const match = lastInvoiceNo.match(/(\d+)$/)
    if (match) {
      nextNumber = Number(match[1]) + 1
    }
  }

  return `${prefix}-${String(nextNumber).padStart(5, '0')}`
}

function normalizeInvoiceItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Invoice items are required')
  }

  return items.map((item, index) => {
    const stockId = toNumber(item.stockId || item.stock_id || 0, 0)
    const qty = toNumber(item.qty, 0)
    const price = toNumber(item.price, 0)
    const discount = toNumber(item.discount, 0)
    const tax = toNumber(item.tax, 0)
    const unit = cleanText(item.unit, 'pcs')
    const productName = cleanText(item.productName || item.product_name, '')
    const sku = cleanText(item.sku, '')

    if (!stockId) {
      throw new Error(`Item #${index + 1}: stockId is required`)
    }

    if (qty <= 0) {
      throw new Error(`Item #${index + 1}: valid qty is required`)
    }

    if (price < 0) {
      throw new Error(`Item #${index + 1}: invalid price`)
    }

    const lineSubtotal = qty * price
    const total = lineSubtotal - discount + tax

    return {
      stockId,
      qty,
      price,
      discount,
      tax,
      total,
      unit,
      productName,
      sku,
    }
  })
}

async function validateStocks(items) {
  for (const item of items) {
    const stock = await getStockById(item.stockId)

    if (!stock) {
      throw new Error(`Stock not found for item stockId=${item.stockId}`)
    }

    const availableQty = Number(stock.quantity || 0)

    if (availableQty < item.qty) {
      const stockName = stock.item_name || `Stock ${stock.id}`
      throw new Error(
        `Insufficient stock for "${stockName}". Available: ${availableQty}, Required: ${item.qty}`
      )
    }

    item.stockRow = stock
    item.availableQty = availableQty

    if (!item.productName) {
      item.productName = stock.item_name || `Stock ${stock.id}`
    }

    if (!item.sku) {
      item.sku = cleanText(stock.item_code, '')
    }

    if (!item.unit || item.unit === 'pcs') {
      item.unit = 'pcs'
    }

    if (!item.price || Number(item.price) <= 0) {
      item.price = Number(stock.selling_price || 0)
    }
  }
}

async function createInvoice({
  customerId = null,
  invoiceDate = null,
  dueDate = null,
  items = [],
  discount = 0,
  tax = 0,
  shipping = 0,
  paidAmount = 0,
  paymentType = 'cash',
  notes = '',
  createdBy = null,
}) {
  const safeCustomerId = customerId ? toNumber(customerId, 0) : null
  const safeInvoiceDate = cleanText(invoiceDate, todayDate())
  const safeDueDate = cleanText(dueDate, '')
  const safeDiscount = toNumber(discount, 0)
  const safeTax = toNumber(tax, 0)
  const safeShipping = toNumber(shipping, 0)
  const safePaidAmount = toNumber(paidAmount, 0)
  const safePaymentType = cleanText(paymentType, 'cash').toLowerCase()
  const safeNotes = cleanText(notes, '')

  if (!['cash', 'credit', 'partial'].includes(safePaymentType)) {
    throw new Error('paymentType must be cash, credit, or partial')
  }

  if ((safePaymentType === 'credit' || safePaymentType === 'partial') && !safeCustomerId) {
    throw new Error('customerId is required for credit/partial invoice')
  }

  if (safeCustomerId) {
    const customer = await getCustomerById(safeCustomerId)
    if (!customer) {
      throw new Error('Customer not found')
    }
  }

  const normalizedItems = normalizeInvoiceItems(items)
  await validateStocks(normalizedItems)

  const subtotal = normalizedItems.reduce(
    (sum, item) => sum + toNumber(item.qty) * toNumber(item.price),
    0
  )
  const itemsDiscount = normalizedItems.reduce((sum, item) => sum + toNumber(item.discount), 0)
  const itemsTax = normalizedItems.reduce((sum, item) => sum + toNumber(item.tax), 0)

  const grandDiscount = itemsDiscount + safeDiscount
  const grandTax = itemsTax + safeTax
  const total = subtotal - grandDiscount + grandTax + safeShipping

  if (total < 0) {
    throw new Error('Invoice total cannot be negative')
  }

  let finalPaidAmount = safePaidAmount
  let paymentStatus = 'unpaid'

  if (safePaymentType === 'cash') {
    finalPaidAmount = total
    paymentStatus = total > 0 ? 'paid' : 'unpaid'
  } else if (safePaymentType === 'credit') {
    finalPaidAmount = 0
    paymentStatus = 'unpaid'
  } else if (safePaymentType === 'partial') {
    if (finalPaidAmount <= 0) {
      throw new Error('paidAmount is required for partial payment')
    }

    if (finalPaidAmount > total) {
      throw new Error('paidAmount cannot be greater than invoice total')
    }

    paymentStatus = finalPaidAmount === total ? 'paid' : 'partial'
  }

  const remainingAmount = total - finalPaidAmount
  const invoiceNo = await generateNextInvoiceNo()

  if (safeCustomerId) {
    await getCustomerLedgerAccount(safeCustomerId)
  }

  const sqlite = db.getConnection()

  const tx = sqlite.transaction(() => {
    const billInsert = sqlite.prepare(`
      INSERT INTO bills (
        invoice_no,
        customer_id,
        invoice_date,
        due_date,
        subtotal,
        discount,
        tax,
        shipping,
        total,
        paid_amount,
        remaining_amount,
        payment_type,
        payment_status,
        notes,
        created_by,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)

    const billResult = billInsert.run(
      invoiceNo,
      safeCustomerId,
      safeInvoiceDate,
      safeDueDate || null,
      subtotal,
      grandDiscount,
      grandTax,
      safeShipping,
      total,
      finalPaidAmount,
      remainingAmount,
      safePaymentType,
      paymentStatus,
      safeNotes,
      createdBy
    )

    const invoiceId = Number(billResult.lastInsertRowid)

    const itemInsert = sqlite.prepare(`
      INSERT INTO sales_invoice_items (
        bill_id,
        stock_id,
        product_name,
        sku,
        unit,
        qty,
        price,
        discount,
        tax,
        total,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)

    const stockUpdate = sqlite.prepare(`
      UPDATE stocks
      SET quantity = quantity - ?
      WHERE id = ?
    `)

    const stockMovementInsert = sqlite.prepare(`
      INSERT INTO stock_movements (
        stock_id,
        movement_type,
        movement_date,
        reference_type,
        reference_id,
        qty,
        notes,
        created_by,
        created_at
      ) VALUES (?, 'sale_out', ?, 'invoice', ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)

    for (const item of normalizedItems) {
      const lineTotal =
        toNumber(item.qty) * toNumber(item.price) -
        toNumber(item.discount) +
        toNumber(item.tax)

      itemInsert.run(
        invoiceId,
        item.stockId,
        item.productName,
        item.sku,
        item.unit,
        item.qty,
        item.price,
        item.discount,
        item.tax,
        lineTotal
      )

      stockUpdate.run(item.qty, item.stockId)

      stockMovementInsert.run(
        item.stockId,
        safeInvoiceDate,
        invoiceId,
        item.qty,
        `Invoice ${invoiceNo}`,
        createdBy
      )
    }

    if (finalPaidAmount > 0) {
      const cashInsert = sqlite.prepare(`
        INSERT INTO cash_transactions (
          tx_date,
          tx_type,
          category,
          reference_type,
          reference_id,
          amount,
          payment_method,
          description,
          notes,
          created_by,
          created_at,
          updated_at
        ) VALUES (?, 'in', 'sale_invoice_payment', 'bill', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)

      cashInsert.run(
        safeInvoiceDate,
        invoiceId,
        finalPaidAmount,
        safePaymentType === 'partial' ? 'cash' : safePaymentType,
        `Invoice payment received ${invoiceNo}`,
        safeNotes,
        createdBy
      )
    }

if (safeCustomerId && total > 0) {
  const account = sqlite
    .prepare(
      `SELECT *
       FROM ledger_accounts
       WHERE owner_type = 'customer' AND owner_id = ?
       LIMIT 1`
    )
    .get(safeCustomerId)

  if (!account) {
    throw new Error('Customer ledger account not found')
  }

  const previousBalance = toNumber(
    sqlite
      .prepare(
        `SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) AS balance
         FROM ledger_entries
         WHERE account_id = ? AND deleted_at IS NULL`
      )
      .get(account.id)?.balance,
    0
  )

  const balanceAfter = previousBalance + total

  sqlite
    .prepare(
      `INSERT INTO ledger_entries (
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
      ) VALUES (?, ?, 'sale_credit', 'bill', ?, ?, 0, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
    .run(
      account.id,
      safeInvoiceDate,
      invoiceId,
      total,
      balanceAfter,
      `Invoice ${invoiceNo}`,
      safeNotes,
      createdBy
    )
}

    if (safeCustomerId && finalPaidAmount > 0) {
      const account = sqlite
        .prepare(
          `SELECT *
           FROM ledger_accounts
           WHERE owner_type = 'customer' AND owner_id = ?
           LIMIT 1`
        )
        .get(safeCustomerId)

      if (!account) {
        throw new Error('Customer ledger account not found')
      }

      const previousBalance = toNumber(
        sqlite
          .prepare(
            `SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) AS balance
             FROM ledger_entries
             WHERE account_id = ? AND deleted_at IS NULL`
          )
          .get(account.id)?.balance,
        0
      )

      const balanceAfter = previousBalance - finalPaidAmount

      sqlite
        .prepare(
          `INSERT INTO ledger_entries (
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
          ) VALUES (?, ?, 'payment_received', 'bill', ?, 0, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        )
        .run(
          account.id,
          safeInvoiceDate,
          invoiceId,
          finalPaidAmount,
          balanceAfter,
          `Payment received against invoice ${invoiceNo}`,
          safeNotes,
          createdBy
        )
    }

    return {
      id: invoiceId,
      invoice_no: invoiceNo,
      customer_id: safeCustomerId,
      invoice_date: safeInvoiceDate,
      due_date: safeDueDate || null,
      subtotal,
      discount: grandDiscount,
      tax: grandTax,
      shipping: safeShipping,
      total,
      paid_amount: finalPaidAmount,
      remaining_amount: remainingAmount,
      payment_type: safePaymentType,
      payment_status: paymentStatus,
      notes: safeNotes,
    }
  })

  return tx()
}
async function deleteInvoice(invoiceId) {
  const id = Number(invoiceId)

  if (!id) {
    throw new Error('Invalid invoice id')
  }

  const invoiceRows = await db.query(
    `SELECT id, invoice_no
     FROM bills
     WHERE id = ?
       AND (deleted_at IS NULL OR deleted_at = '')
     LIMIT 1`,
    [id]
  )

  const invoice = Array.isArray(invoiceRows) ? invoiceRows[0] : null

  if (!invoice) {
    throw new Error('Invoice not found')
  }

  await db.query(
    `UPDATE bills
     SET deleted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id]
  )

  return {
    id,
    invoice_no: invoice.invoice_no,
  }
}
async function receiveInvoicePayment({
  invoiceId,
  amount,
  paymentDate = null,
  paymentMethod = 'cash',
  notes = '',
  createdBy = null,
}) {
  const safeInvoiceId = Number(invoiceId || 0)
  const safeAmount = Number(amount || 0)
  const safePaymentDate = paymentDate || todayDate()
  const safePaymentMethod = cleanText(paymentMethod, 'cash')
  const safeNotes = cleanText(notes, '')

  if (!safeInvoiceId) throw new Error('Invalid invoice id')
  if (safeAmount <= 0) throw new Error('Valid payment amount required')

  const invoice = await getInvoiceById(safeInvoiceId)
  if (!invoice) throw new Error('Invoice not found')

  if (Number(invoice.remaining_amount || 0) <= 0) {
    throw new Error('This invoice is already fully paid')
  }

  if (safeAmount > Number(invoice.remaining_amount || 0)) {
    throw new Error('Payment amount cannot be greater than remaining amount')
  }

  const sqlite = db.getConnection()

  const tx = sqlite.transaction(() => {
    const newPaidAmount = Number(invoice.paid_amount || 0) + safeAmount
    const newRemainingAmount = Number(invoice.total || 0) - newPaidAmount

    let newStatus = 'unpaid'
    if (newRemainingAmount <= 0) {
      newStatus = 'paid'
    } else if (newPaidAmount > 0) {
      newStatus = 'partial'
    }

    sqlite
      .prepare(
        `UPDATE bills
         SET paid_amount = ?,
             remaining_amount = ?,
             payment_status = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(newPaidAmount, newRemainingAmount, newStatus, safeInvoiceId)

    sqlite
      .prepare(
        `INSERT INTO cash_transactions (
          tx_date,
          tx_type,
          category,
          reference_type,
          reference_id,
          amount,
          payment_method,
          description,
          notes,
          created_by,
          created_at,
          updated_at
        ) VALUES (?, 'in', 'sale_invoice_payment', 'bill', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
      .run(
        safePaymentDate,
        safeInvoiceId,
        safeAmount,
        safePaymentMethod,
        `Invoice payment received ${invoice.invoice_no}`,
        safeNotes,
        createdBy
      )

    if (invoice.customer_id) {
      const account = sqlite
        .prepare(
          `SELECT *
           FROM ledger_accounts
           WHERE owner_type = 'customer' AND owner_id = ?
           LIMIT 1`
        )
        .get(invoice.customer_id)

      if (account) {
        const previousBalance = toNumber(
          sqlite
            .prepare(
              `SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) AS balance
               FROM ledger_entries
               WHERE account_id = ? AND deleted_at IS NULL`
            )
            .get(account.id)?.balance,
          0
        )

        const balanceAfter = previousBalance - safeAmount

        sqlite
          .prepare(
            `INSERT INTO ledger_entries (
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
            ) VALUES (?, ?, 'payment_received', 'bill', ?, 0, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
          )
          .run(
            account.id,
            safePaymentDate,
            safeInvoiceId,
            safeAmount,
            balanceAfter,
            `Payment received against invoice ${invoice.invoice_no}`,
            safeNotes,
            createdBy
          )
      }
    }

    return {
      invoice_id: safeInvoiceId,
      invoice_no: invoice.invoice_no,
      payment_received: safeAmount,
      paid_amount: newPaidAmount,
      remaining_amount: newRemainingAmount,
      payment_status: newStatus,
    }
  })

  return tx()
}

async function getInvoiceById(invoiceId) {
  const billRows = await db.query(
    `SELECT
       b.*,
       COALESCE(c.name, 'Walk-in Customer') AS customer_name,
       c.phone AS customer_phone
     FROM bills b
     LEFT JOIN customers c ON c.id = b.customer_id
     WHERE b.id = ? AND (b.deleted_at IS NULL OR b.deleted_at = '')
     LIMIT 1`,
    [invoiceId]
  )

  const invoice = billRows[0] || null
  if (!invoice) return null

  const items = await db.query(
    `SELECT
       sii.*,
       COALESCE(
         sii.product_name,
         s.item_name,
         'Stock ' || sii.stock_id
       ) AS product_name
     FROM sales_invoice_items sii
     LEFT JOIN stocks s ON s.id = sii.stock_id
     WHERE sii.bill_id = ?
     ORDER BY sii.id ASC`,
    [invoiceId]
  )

  return {
    ...invoice,
    subtotal: toNumber(invoice.subtotal),
    discount: toNumber(invoice.discount),
    tax: toNumber(invoice.tax),
    shipping: toNumber(invoice.shipping),
    total: toNumber(invoice.total),
    paid_amount: toNumber(invoice.paid_amount),
    remaining_amount: toNumber(invoice.remaining_amount),
    items: items.map((item) => ({
      ...item,
      qty: toNumber(item.qty),
      price: toNumber(item.price),
      discount: toNumber(item.discount),
      tax: toNumber(item.tax),
      total: toNumber(item.total),
    })),
  }
}

async function listInvoices({
  search = '',
  customerId = null,
  paymentStatus = '',
  paymentType = '',
  dateFrom = '',
  dateTo = '',
  limit = 50,
}) {
  const conditions = [`(b.deleted_at IS NULL OR b.deleted_at = '')`]
  const params = []

  if (search) {
    conditions.push(`(
      b.invoice_no LIKE ?
      OR COALESCE(c.name, '') LIKE ?
    )`)
    params.push(`%${search}%`, `%${search}%`)
  }

  if (customerId) {
    conditions.push(`b.customer_id = ?`)
    params.push(customerId)
  }

  if (paymentStatus) {
    conditions.push(`b.payment_status = ?`)
    params.push(paymentStatus)
  }

  if (paymentType) {
    conditions.push(`b.payment_type = ?`)
    params.push(paymentType)
  }

  if (dateFrom) {
    conditions.push(`date(b.invoice_date) >= date(?)`)
    params.push(dateFrom)
  }

  if (dateTo) {
    conditions.push(`date(b.invoice_date) <= date(?)`)
    params.push(dateTo)
  }

  const safeLimit = Math.max(1, Math.min(toNumber(limit, 50), 500))

  const rows = await db.query(
    `SELECT
       b.id,
       b.invoice_no,
       b.invoice_date,
       b.customer_id,
       COALESCE(c.name, 'Walk-in Customer') AS customer_name,
       b.total,
       b.paid_amount,
       b.remaining_amount,
       b.payment_type,
       b.payment_status,
       b.created_at
     FROM bills b
     LEFT JOIN customers c ON c.id = b.customer_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY b.id DESC
     LIMIT ${safeLimit}`,
    params
  )

  return rows.map((row) => ({
    ...row,
    total: toNumber(row.total),
    paid_amount: toNumber(row.paid_amount),
    remaining_amount: toNumber(row.remaining_amount),
  }))
}

export {
  createInvoice,
  getInvoiceById,
  listInvoices,
  receiveInvoicePayment,
  deleteInvoice,
}