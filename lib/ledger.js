import db from './db.js'

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function insertLedgerEntry(sqlite, {
  accountId,
  entryDate,
  entryType,
  debit = 0,
  credit = 0,
  description = '',
  notes = '',
  referenceType = null,
  referenceId = null,
  createdBy = null,
}) {
  const result = sqlite.prepare(`
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    accountId,
    entryDate || todayDate(),
    entryType,
    referenceType,
    referenceId,
    debit,
    credit,
    description,
    notes,
    createdBy
  )

  return Number(result.lastInsertRowid || 0)
}

function recalculateAccountBalances(sqlite, accountId, balanceMode = 'debit-credit') {
  const entries = sqlite.prepare(`
    SELECT id, debit, credit
    FROM ledger_entries
    WHERE account_id = ? AND deleted_at IS NULL
    ORDER BY entry_date ASC, id ASC
  `).all(accountId)

  const updateBalance = sqlite.prepare(`
    UPDATE ledger_entries
    SET balance_after = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)

  let runningBalance = 0

  for (const entry of entries) {
    if (balanceMode === 'credit-debit') {
      runningBalance += toNumber(entry.credit) - toNumber(entry.debit)
    } else {
      runningBalance += toNumber(entry.debit) - toNumber(entry.credit)
    }

    updateBalance.run(runningBalance, entry.id)
  }

  return runningBalance
}

async function getCustomerById(customerId) {
  const rows = await db.query(
    `SELECT * FROM customers WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '') LIMIT 1`,
    [customerId]
  )
  return rows[0] || null
}

async function ensureCustomerLedgerAccount(customerId) {
  const customer = await getCustomerById(customerId)
  if (!customer) {
    throw new Error('Customer not found')
  }

  const existing = await db.query(
    `SELECT * FROM ledger_accounts
     WHERE owner_type = 'customer' AND owner_id = ?
     LIMIT 1`,
    [customerId]
  )

  if (existing.length) return existing[0]

  const accountName =
    customer.full_name ||
    customer.name ||
    customer.customer_name ||
    `Customer ${customerId}`

  const result = await db.query(
    `INSERT INTO ledger_accounts (owner_type, owner_id, account_name, created_at, updated_at)
     VALUES ('customer', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [customerId, accountName]
  )

  const inserted = await db.query(
    `SELECT * FROM ledger_accounts WHERE id = ? LIMIT 1`,
    [result.insertId]
  )

  return inserted[0]
}

async function getSupplierById(supplierId) {
  const rows = await db.query(
    `SELECT * FROM suppliers WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '') LIMIT 1`,
    [supplierId]
  )
  return rows[0] || null
}

async function ensureSupplierLedgerAccount(supplierId) {
  const supplier = await getSupplierById(supplierId)
  if (!supplier) {
    throw new Error('Supplier not found')
  }

  const existing = await db.query(
    `SELECT * FROM ledger_accounts
     WHERE owner_type = 'supplier' AND owner_id = ?
     LIMIT 1`,
    [supplierId]
  )

  if (existing.length) return existing[0]

  const accountName =
    supplier.company_name ||
    supplier.name ||
    supplier.supplier_name ||
    `Supplier ${supplierId}`

  const result = await db.query(
    `INSERT INTO ledger_accounts (owner_type, owner_id, account_name, created_at, updated_at)
     VALUES ('supplier', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [supplierId, accountName]
  )

  const inserted = await db.query(
    `SELECT * FROM ledger_accounts WHERE id = ? LIMIT 1`,
    [result.insertId]
  )

  return inserted[0]
}

async function getLedgerAccountByCustomer(customerId) {
  await ensureCustomerLedgerAccount(customerId)

  const rows = await db.query(
    `SELECT * FROM ledger_accounts
     WHERE owner_type = 'customer' AND owner_id = ?
     LIMIT 1`,
    [customerId]
  )

  return rows[0] || null
}

async function getLedgerAccountBySupplier(supplierId) {
  await ensureSupplierLedgerAccount(supplierId)

  const rows = await db.query(
    `SELECT * FROM ledger_accounts
     WHERE owner_type = 'supplier' AND owner_id = ?
     LIMIT 1`,
    [supplierId]
  )

  return rows[0] || null
}

async function getAccountTotals(accountId) {
  const rows = await db.query(
    `SELECT
        COALESCE(SUM(debit), 0) AS total_debit,
        COALESCE(SUM(credit), 0) AS total_credit,
        COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) AS balance
     FROM ledger_entries
     WHERE account_id = ? AND deleted_at IS NULL`,
    [accountId]
  )

  return rows[0] || {
    total_debit: 0,
    total_credit: 0,
    balance: 0,
  }
}

async function createLedgerEntry({
  customerId,
  entryDate,
  entryType,
  debit = 0,
  credit = 0,
  description = '',
  notes = '',
  referenceType = null,
  referenceId = null,
  createdBy = null,
}) {
  const account = await getLedgerAccountByCustomer(customerId)
  if (!account) throw new Error('Ledger account not found')

  const safeDebit = toNumber(debit, 0)
  const safeCredit = toNumber(credit, 0)

  if (safeDebit <= 0 && safeCredit <= 0) {
    throw new Error('Debit or credit amount required')
  }

  if (safeDebit > 0 && safeCredit > 0) {
    throw new Error('Only one side allowed: debit or credit')
  }

  const sqlite = db.getConnection()
  let entryId = 0
  let balanceAfter = 0

  const tx = sqlite.transaction(() => {
    entryId = insertLedgerEntry(sqlite, {
      accountId: account.id,
      entryDate: entryDate || todayDate(),
      entryType,
      debit: safeDebit,
      credit: safeCredit,
      description,
      notes,
      referenceType,
      referenceId,
      createdBy,
    })

    recalculateAccountBalances(sqlite, account.id)

    balanceAfter = toNumber(
      sqlite.prepare(`SELECT balance_after FROM ledger_entries WHERE id = ?`).get(entryId)
        ?.balance_after,
      0
    )
  })

  tx()

  return {
    success: true,
    entryId,
    balanceAfter,
  }
}

async function createSupplierLedgerEntry({
  supplierId,
  entryDate,
  entryType,
  debit = 0,
  credit = 0,
  description = '',
  notes = '',
  referenceType = null,
  referenceId = null,
  createdBy = null,
}) {
  const account = await getLedgerAccountBySupplier(supplierId)
  if (!account) throw new Error('Supplier ledger account not found')

  const safeDebit = toNumber(debit, 0)
  const safeCredit = toNumber(credit, 0)

  if (safeDebit <= 0 && safeCredit <= 0) {
    throw new Error('Debit or credit amount required')
  }

  if (safeDebit > 0 && safeCredit > 0) {
    throw new Error('Only one side allowed: debit or credit')
  }

  const sqlite = db.getConnection()
  let entryId = 0
  let balanceAfter = 0

  const tx = sqlite.transaction(() => {
    entryId = insertLedgerEntry(sqlite, {
      accountId: account.id,
      entryDate: entryDate || todayDate(),
      entryType,
      debit: safeDebit,
      credit: safeCredit,
      description,
      notes,
      referenceType,
      referenceId,
      createdBy,
    })

    recalculateAccountBalances(sqlite, account.id, 'credit-debit')

    balanceAfter = toNumber(
      sqlite.prepare(`SELECT balance_after FROM ledger_entries WHERE id = ?`).get(entryId)
        ?.balance_after,
      0
    )
  })

  tx()

  return {
    success: true,
    entryId,
    balanceAfter,
  }
}

async function receiveCustomerPayment({
  customerId,
  amount,
  entryDate,
  notes = '',
  createdBy = null,
  paymentMethod = 'cash',
  sourceOfPayment = 'Customer',
}) {
  const safeAmount = toNumber(amount, 0)
  if (safeAmount <= 0) {
    throw new Error('Valid payment amount required')
  }

  const account = await getLedgerAccountByCustomer(customerId)
  if (!account) throw new Error('Ledger account not found')

  const sqlite = db.getConnection()
  let entryId = 0
  let balanceAfter = 0

  const tx = sqlite.transaction(() => {
    entryId = insertLedgerEntry(sqlite, {
      accountId: account.id,
      entryDate: entryDate || todayDate(),
      entryType: 'payment_received',
      debit: 0,
      credit: safeAmount,
      description: 'Customer payment received',
      notes,
      referenceType: 'payment',
      referenceId: null,
      createdBy,
    })

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
      ) VALUES (?, 'in', 'customer_payment', 'ledger_entry', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      entryDate || todayDate(),
      entryId,
      safeAmount,
      paymentMethod,
      sourceOfPayment,
      'Customer payment received',
      notes,
      createdBy
    )

    sqlite.prepare(`
      INSERT INTO audit_logs (
        module_name,
        record_id,
        action,
        old_data,
        new_data,
        action_by,
        action_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      'ledger_entries',
      entryId,
      'create',
      null,
      JSON.stringify({
        customerId,
        entryType: 'payment_received',
        amount: safeAmount,
      }),
      createdBy
    )

    recalculateAccountBalances(sqlite, account.id)

    balanceAfter = toNumber(
      sqlite.prepare(`SELECT balance_after FROM ledger_entries WHERE id = ?`).get(entryId)
        ?.balance_after,
      0
    )
  })

  tx()

  return {
    success: true,
    entryId,
    balanceAfter,
  }
}

async function paySupplier({
  supplierId,
  amount,
  entryDate,
  notes = '',
  createdBy = null,
  paymentMethod = 'cash',
  sourceOfPayment = 'Business',
  referenceType = 'payment',
  referenceId = null,
  description = 'Supplier payment paid',
}) {
  const safeAmount = toNumber(amount, 0)
  if (safeAmount <= 0) {
    throw new Error('Valid payment amount required')
  }

  const account = await getLedgerAccountBySupplier(supplierId)
  if (!account) throw new Error('Supplier ledger account not found')

  const sqlite = db.getConnection()
  let entryId = 0
  let balanceAfter = 0

  const tx = sqlite.transaction(() => {
    entryId = insertLedgerEntry(sqlite, {
      accountId: account.id,
      entryDate: entryDate || todayDate(),
      entryType: 'supplier_payment',
      debit: safeAmount,
      credit: 0,
      description,
      notes,
      referenceType,
      referenceId,
      createdBy,
    })

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
      ) VALUES (?, 'out', 'supplier_payment', 'ledger_entry', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      entryDate || todayDate(),
      entryId,
      safeAmount,
      paymentMethod,
      sourceOfPayment,
      description,
      notes,
      createdBy
    )

    recalculateAccountBalances(sqlite, account.id, 'credit-debit')

    balanceAfter = toNumber(
      sqlite.prepare(`SELECT balance_after FROM ledger_entries WHERE id = ?`).get(entryId)
        ?.balance_after,
      0
    )
  })

  tx()

  return {
    success: true,
    entryId,
    balanceAfter,
  }
}

async function addSupplierDebit({
  supplierId,
  amount,
  entryDate,
  notes = '',
  createdBy = null,
  entryType = 'supplier_adjustment_debit',
  description = 'Manual supplier debit entry',
}) {
  const safeAmount = toNumber(amount, 0)
  if (safeAmount <= 0) {
    throw new Error('Valid debit amount required')
  }

  return createSupplierLedgerEntry({
    supplierId,
    entryDate: entryDate || todayDate(),
    entryType,
    debit: safeAmount,
    credit: 0,
    description,
    notes,
    createdBy,
  })
}

async function addSupplierCredit({
  supplierId,
  amount,
  entryDate,
  notes = '',
  createdBy = null,
  entryType = 'supplier_adjustment_credit',
  description = 'Manual supplier credit entry',
}) {
  const safeAmount = toNumber(amount, 0)
  if (safeAmount <= 0) {
    throw new Error('Valid credit amount required')
  }

  return createSupplierLedgerEntry({
    supplierId,
    entryDate: entryDate || todayDate(),
    entryType,
    debit: 0,
    credit: safeAmount,
    description,
    notes,
    createdBy,
  })
}

async function addCustomerDebit({
  customerId,
  amount,
  entryDate,
  notes = '',
  createdBy = null,
  entryType = 'adjustment_debit',
  description = 'Manual debit entry',
}) {
  const safeAmount = toNumber(amount, 0)
  if (safeAmount <= 0) {
    throw new Error('Valid debit amount required')
  }

  return createLedgerEntry({
    customerId,
    entryDate: entryDate || todayDate(),
    entryType,
    debit: safeAmount,
    credit: 0,
    description,
    notes,
    createdBy,
  })
}

async function addCustomerCredit({
  customerId,
  amount,
  entryDate,
  notes = '',
  createdBy = null,
  entryType = 'adjustment_credit',
  description = 'Manual credit entry',
}) {
  const safeAmount = toNumber(amount, 0)
  if (safeAmount <= 0) {
    throw new Error('Valid credit amount required')
  }

  return createLedgerEntry({
    customerId,
    entryDate: entryDate || todayDate(),
    entryType,
    debit: 0,
    credit: safeAmount,
    description,
    notes,
    createdBy,
  })
}

async function getCustomerLedger(customerId) {
  const customer = await getCustomerById(customerId)
  if (!customer) {
    throw new Error('Customer not found')
  }

  const account = await getLedgerAccountByCustomer(customerId)
  if (!account) {
    return {
      customer,
      account: null,
      summary: {
        total_debit: 0,
        total_credit: 0,
        balance: 0,
      },
      entries: [],
    }
  }

  const summary = await getAccountTotals(account.id)

  const entries = await db.query(
    `SELECT
      id,
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
     FROM ledger_entries
     WHERE account_id = ? AND deleted_at IS NULL
     ORDER BY entry_date ASC, id ASC`,
    [account.id]
  )

  let runningBalance = 0

  return {
    customer,
    account,
    summary: {
      total_debit: toNumber(summary.total_debit),
      total_credit: toNumber(summary.total_credit),
      balance: toNumber(summary.balance),
    },
    entries: entries.map((row) => {
      const debit = toNumber(row.debit)
      const credit = toNumber(row.credit)
      runningBalance += debit - credit

      return {
        ...row,
        debit,
        credit,
        balance_after: runningBalance,
      }
    }),
  }
}

async function getCustomersLedgerSummary() {
  const rows = await db.query(
    `SELECT
      c.id,
      COALESCE(c.name, 'Customer ' || c.id) AS customer_name,
      c.phone,
      c.city,
      la.id AS account_id,
      COALESCE(SUM(le.debit), 0) AS total_debit,
      COALESCE(SUM(le.credit), 0) AS total_credit,
      COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) AS balance
     FROM customers c
     LEFT JOIN ledger_accounts la
       ON la.owner_type = 'customer' AND la.owner_id = c.id
     LEFT JOIN ledger_entries le
       ON le.account_id = la.id AND le.deleted_at IS NULL
     WHERE c.deleted_at IS NULL OR c.deleted_at = ''
     GROUP BY c.id, la.id
     ORDER BY c.id DESC`
  )

  return rows.map((row) => ({
    ...row,
    total_debit: toNumber(row.total_debit),
    total_credit: toNumber(row.total_credit),
    balance: toNumber(row.balance),
  }))
}

async function getSupplierLedger(supplierId) {
  const supplier = await getSupplierById(supplierId)
  if (!supplier) {
    throw new Error('Supplier not found')
  }

  const account = await getLedgerAccountBySupplier(supplierId)
  if (!account) {
    return {
      supplier,
      account: null,
      summary: {
        total_debit: 0,
        total_credit: 0,
        balance: 0,
      },
      entries: [],
    }
  }

  const sqlite = db.getConnection()
  const syncPurchaseInvoices = sqlite.transaction(() => {
    const invoices = sqlite.prepare(`
      SELECT *
      FROM purchase_invoices
      WHERE (deleted_at IS NULL OR deleted_at = '')
        AND (
          supplier_id = ?
          OR (
            (supplier_id IS NULL OR supplier_id = 0)
            AND supplier_name = ?
          )
        )
      ORDER BY invoice_date ASC, id ASC
    `).all(supplierId, supplier.name || '')

    const existingEntry = sqlite.prepare(`
      SELECT id
      FROM ledger_entries
      WHERE reference_type = 'purchase_invoice'
        AND reference_id = ?
        AND entry_type = ?
        AND deleted_at IS NULL
      LIMIT 1
    `)

    const linkSupplier = sqlite.prepare(`
      UPDATE purchase_invoices
      SET supplier_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND (supplier_id IS NULL OR supplier_id = 0)
    `)

    for (const invoice of invoices) {
      const invoiceDate = invoice.invoice_date || invoice.purchase_date || invoice.created_at || todayDate()
      const total = toNumber(invoice.total)
      const paidAmount = toNumber(invoice.paid_amount)
      const invoiceNo = invoice.purchase_no || invoice.invoice_no || invoice.id

      linkSupplier.run(supplierId, invoice.id)

      if (total > 0 && !existingEntry.get(invoice.id, 'purchase_credit')) {
        insertLedgerEntry(sqlite, {
          accountId: account.id,
          entryDate: invoiceDate,
          entryType: 'purchase_credit',
          credit: total,
          referenceType: 'purchase_invoice',
          referenceId: invoice.id,
          description: `Purchase invoice ${invoiceNo}`,
          notes: invoice.notes || '',
          createdBy: invoice.created_by || null,
        })
      }

      if (paidAmount > 0 && !existingEntry.get(invoice.id, 'supplier_payment')) {
        insertLedgerEntry(sqlite, {
          accountId: account.id,
          entryDate: invoiceDate,
          entryType: 'supplier_payment',
          debit: paidAmount,
          referenceType: 'purchase_invoice',
          referenceId: invoice.id,
          description: `Payment paid against purchase ${invoiceNo}`,
          notes: invoice.notes || '',
          createdBy: invoice.created_by || null,
        })
      }
    }

    recalculateAccountBalances(sqlite, account.id, 'credit-debit')
  })

  syncPurchaseInvoices()

  const summaryRows = await db.query(
    `SELECT
        COALESCE(SUM(debit), 0) AS total_debit,
        COALESCE(SUM(credit), 0) AS total_credit,
        COALESCE(SUM(credit), 0) - COALESCE(SUM(debit), 0) AS balance
     FROM ledger_entries
     WHERE account_id = ? AND deleted_at IS NULL`,
    [account.id]
  )
  const summary = summaryRows[0] || {}

  const entries = await db.query(
    `SELECT
      id,
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
     FROM ledger_entries
     WHERE account_id = ? AND deleted_at IS NULL
     ORDER BY entry_date ASC, id ASC`,
    [account.id]
  )

  let runningBalance = 0

  return {
    supplier,
    account,
    summary: {
      total_debit: toNumber(summary.total_debit),
      total_credit: toNumber(summary.total_credit),
      balance: toNumber(summary.balance),
    },
    entries: entries.map((row) => {
      const debit = toNumber(row.debit)
      const credit = toNumber(row.credit)
      runningBalance += credit - debit

      return {
        ...row,
        debit,
        credit,
        balance_after: runningBalance,
      }
    }),
  }
}

async function getSuppliersLedgerSummary() {
  const rows = await db.query(
    `SELECT
      s.id,
      COALESCE(s.name, 'Supplier ' || s.id) AS supplier_name,
      s.company_name,
      s.phone,
      s.city,
      la.id AS account_id,
      COALESCE(SUM(le.debit), 0) AS total_debit,
      COALESCE(SUM(le.credit), 0) AS total_credit,
      COALESCE(SUM(le.credit), 0) - COALESCE(SUM(le.debit), 0) AS balance
     FROM suppliers s
     LEFT JOIN ledger_accounts la
       ON la.owner_type = 'supplier' AND la.owner_id = s.id
     LEFT JOIN ledger_entries le
       ON le.account_id = la.id AND le.deleted_at IS NULL
     WHERE s.deleted_at IS NULL OR s.deleted_at = ''
     GROUP BY s.id, la.id
     ORDER BY s.id DESC`
  )

  return rows.map((row) => ({
    ...row,
    total_debit: toNumber(row.total_debit),
    total_credit: toNumber(row.total_credit),
    balance: toNumber(row.balance),
  }))
}

export {
  ensureCustomerLedgerAccount,
  ensureSupplierLedgerAccount,
  getLedgerAccountByCustomer,
  getLedgerAccountBySupplier,
  createLedgerEntry,
  createSupplierLedgerEntry,
  receiveCustomerPayment,
  paySupplier,
  addCustomerDebit,
  addCustomerCredit,
  addSupplierDebit,
  addSupplierCredit,
  getCustomerLedger,
  getCustomersLedgerSummary,
  getSupplierLedger,
  getSuppliersLedgerSummary,
  recalculateAccountBalances,
}
