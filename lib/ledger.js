import db from './db.js'

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
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

  const totals = await getAccountTotals(account.id)
  const previousBalance = toNumber(totals.balance)
  const balanceAfter = previousBalance + safeDebit - safeCredit

  const result = await db.query(
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      account.id,
      entryDate || todayDate(),
      entryType,
      referenceType,
      referenceId,
      safeDebit,
      safeCredit,
      balanceAfter,
      description,
      notes,
      createdBy,
    ]
  )

  return {
    success: true,
    entryId: result.insertId,
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

  const entry = await createLedgerEntry({
    customerId,
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

  await db.query(
    `INSERT INTO cash_transactions (
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
    ) VALUES (?, 'in', 'customer_payment', 'ledger_entry', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,    [
      entryDate || todayDate(),
      entry.entryId,
      safeAmount,
      paymentMethod,
      sourceOfPayment,
      'Customer payment received',
      notes,
      createdBy,
    ]
  )

  await db.query(
    `INSERT INTO audit_logs (
      module_name,
      record_id,
      action,
      old_data,
      new_data,
      action_by,
      action_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      'ledger_entries',
      entry.entryId,
      'create',
      null,
      JSON.stringify({
        customerId,
        entryType: 'payment_received',
        amount: safeAmount,
      }),
      createdBy,
    ]
  )

  return entry
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

  return {
    customer,
    account,
    summary: {
      total_debit: toNumber(summary.total_debit),
      total_credit: toNumber(summary.total_credit),
      balance: toNumber(summary.balance),
    },
    entries: entries.map((row) => ({
      ...row,
      debit: toNumber(row.debit),
      credit: toNumber(row.credit),
      balance_after: toNumber(row.balance_after),
    })),
  }
}

async function getCustomersLedgerSummary() {
  const rows = await db.query(
    `SELECT
      c.id,
      COALESCE(c.name, 'Customer ' || c.id) AS customer_name
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

export {
  ensureCustomerLedgerAccount,
  getLedgerAccountByCustomer,
  createLedgerEntry,
  receiveCustomerPayment,
  addCustomerDebit,
  addCustomerCredit,
  getCustomerLedger,
  getCustomersLedgerSummary,
}