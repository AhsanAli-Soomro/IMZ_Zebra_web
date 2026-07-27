import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { getDatabasePath, getSchemaPath } from './db-path.js'

function tableExists(db, tableName) {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`)
    .get(tableName)
  return !!row
}

function columnExists(db, tableName, columnName) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all()
  return rows.some((r) => r.name === columnName)
}
function ensureDefaultAdminUser(db) {
  if (!tableExists(db, 'users')) {
    return
  }

  const userCount = db.prepare(`SELECT COUNT(*) AS count FROM users`).get().count

  // Agar client ne already user banaya/update kiya hai, to kuch overwrite nahi karna
  if (userCount > 0) {
    console.log('Users already exist, skipping default admin creation')
    return
  }

  const columns = db.prepare(`PRAGMA table_info(users)`).all().map((col) => col.name)

  const hasName = columns.includes('name')
  const hasFullName = columns.includes('full_name')
  const hasEmail = columns.includes('email')
  const hasPassword = columns.includes('password')
  const hasPasswordHash = columns.includes('password_hash')
  const hasUserType = columns.includes('user_type')
  const hasRole = columns.includes('role')
  const hasStatus = columns.includes('status')

  if (!hasEmail) {
    console.log('users.email column not found, skipping default admin creation')
    return
  }

  const insertColumns = []
  const placeholders = []
  const values = []

  function add(column, value) {
    insertColumns.push(column)
    placeholders.push('?')
    values.push(value)
  }

  if (hasName) add('name', process.env.DEFAULT_ADMIN_NAME || 'Admin')
  if (hasFullName) add('full_name', process.env.DEFAULT_ADMIN_NAME || 'Admin')

  add('email', process.env.DEFAULT_ADMIN_EMAIL || 'admin@gmail.com')

  // Note: ye plain password tabhi sahi hai agar aapka login plain password compare karta hai.
  if (hasPassword) {
    add('password', process.env.DEFAULT_ADMIN_PASSWORD || '123456')
  }

  // Agar aap password_hash use karte ho, to yahan hashing logic chahiye.
  // Abhi placeholder ke taur par plain value store kar raha hai.
  if (hasPasswordHash) {
    add('password_hash', process.env.DEFAULT_ADMIN_PASSWORD || '123456')
  }

  if (hasUserType) add('user_type', process.env.DEFAULT_ADMIN_USER_TYPE || 'Admin')
  if (hasRole) add('role', process.env.DEFAULT_ADMIN_ROLE || 'admin')
  if (hasStatus) add('status', process.env.DEFAULT_ADMIN_STATUS || 'active')

  const sql = `
    INSERT INTO users (${insertColumns.join(', ')})
    VALUES (${placeholders.join(', ')})
  `

  db.prepare(sql).run(...values)

  console.log('Default admin user created')
}
function addColumnIfNotExists(db, tableName, columnName, definition) {
  if (!tableExists(db, tableName)) return
  if (columnExists(db, tableName, columnName)) return

  const normalized = String(definition).toUpperCase()

  const hasNonConstantDefault =
    normalized.includes('DEFAULT CURRENT_TIMESTAMP') ||
    normalized.includes("DEFAULT (CURRENT_TIMESTAMP)") ||
    normalized.includes("DEFAULT DATETIME('NOW')") ||
    normalized.includes('DEFAULT (DATETIME(\'NOW\'))')

  if (hasNonConstantDefault) {
    const cleanDefinition = definition
      .replace(/DEFAULT\s+CURRENT_TIMESTAMP/gi, '')
      .replace(/DEFAULT\s+\(CURRENT_TIMESTAMP\)/gi, '')
      .replace(/DEFAULT\s+datetime\('now'\)/gi, '')
      .replace(/DEFAULT\s+\(datetime\('now'\)\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim()

    db.prepare(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${cleanDefinition}`
    ).run()

    db.prepare(
      `UPDATE ${tableName} SET ${columnName} = CURRENT_TIMESTAMP WHERE ${columnName} IS NULL`
    ).run()

    console.log(`Added column without default and backfilled timestamp: ${tableName}.${columnName}`)
    return
  }

  db.prepare(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`
  ).run()

  console.log(`Added column: ${tableName}.${columnName}`)
}

function createTableIfNotExists(db, sql, tableName) {
  if (!tableExists(db, tableName)) {
    db.exec(sql)
    console.log(`Created table: ${tableName}`)
  }
}

function createIndexIfNotExists(db, sql) {
  db.exec(sql)
}

export function runMigrations(dbPathFromElectron, schemaPathFromElectron) {
  const dbPath =
    dbPathFromElectron ||
    process.env.SQLITE_DB_PATH ||
    process.env.DATABASE_URL ||
    getDatabasePath()

  const schemaPath =
    schemaPathFromElectron ||
    process.env.SQLITE_SCHEMA_PATH ||
    getSchemaPath()

  console.log('Migration DB path:', dbPath)
  console.log('Migration schema path:', schemaPath)

  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  try {
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8')
      db.exec(schema)
      console.log('Base schema applied')
    }

    // =========================
    // EXISTING TABLES UPGRADE
    // =========================

    // categories
    addColumnIfNotExists(db, 'categories', 'description', 'TEXT')
    addColumnIfNotExists(db, 'categories', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP')
    addColumnIfNotExists(db, 'categories', 'deleted_at', 'TEXT')

    // customers
    addColumnIfNotExists(db, 'customers', 'phone', 'TEXT')
    addColumnIfNotExists(db, 'customers', 'email', 'TEXT')
    addColumnIfNotExists(db, 'customers', 'address', 'TEXT')
    addColumnIfNotExists(db, 'customers', 'city', 'TEXT')
    addColumnIfNotExists(db, 'customers', 'opening_balance', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'customers', 'credit_limit', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'customers', 'status', `TEXT NOT NULL DEFAULT 'active'`)
    addColumnIfNotExists(db, 'customers', 'notes', 'TEXT')
    addColumnIfNotExists(db, 'customers', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP')
    addColumnIfNotExists(db, 'customers', 'deleted_at', 'TEXT')

    // suppliers
    addColumnIfNotExists(db, 'suppliers', 'phone', 'TEXT')
    addColumnIfNotExists(db, 'suppliers', 'email', 'TEXT')
    addColumnIfNotExists(db, 'suppliers', 'address', 'TEXT')
    addColumnIfNotExists(db, 'suppliers', 'city', 'TEXT')
    addColumnIfNotExists(db, 'suppliers', 'opening_balance', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'suppliers', 'status', `TEXT NOT NULL DEFAULT 'active'`)
    addColumnIfNotExists(db, 'suppliers', 'notes', 'TEXT')
    addColumnIfNotExists(db, 'suppliers', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP')
    addColumnIfNotExists(db, 'suppliers', 'deleted_at', 'TEXT')

    // stocks
    addColumnIfNotExists(db, 'stocks', 'sku', 'TEXT')
    addColumnIfNotExists(db, 'stocks', 'barcode', 'TEXT')
    addColumnIfNotExists(db, 'stocks', 'category_id', 'INTEGER')
    addColumnIfNotExists(db, 'stocks', 'supplier_id', 'INTEGER')
    addColumnIfNotExists(db, 'stocks', 'unit', `TEXT DEFAULT 'pcs'`)
    addColumnIfNotExists(db, 'stocks', 'purchase_rate', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'stocks', 'purchase_price', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'stocks', 'selling_rate', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'stocks', 'sale_price', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'stocks', 'wholesale_price', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'stocks', 'qty', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'stocks', 'min_qty', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'stocks', 'reorder_level', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'stocks', 'location', 'TEXT')
    addColumnIfNotExists(db, 'stocks', 'expiry_date', 'TEXT')
    addColumnIfNotExists(db, 'stocks', 'weight', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'stocks', 'weight_unit', `TEXT DEFAULT 'kg'`)
    addColumnIfNotExists(db, 'stocks', 'status', `TEXT NOT NULL DEFAULT 'active'`)
    addColumnIfNotExists(db, 'stocks', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP')
    addColumnIfNotExists(db, 'stocks', 'deleted_at', 'TEXT')

    // bills
    addColumnIfNotExists(db, 'bills', 'invoice_no', 'TEXT')
    addColumnIfNotExists(db, 'bills', 'customer_id', 'INTEGER')
    addColumnIfNotExists(db, 'bills', 'customer_name', 'TEXT')
    addColumnIfNotExists(db, 'bills', 'contact', 'TEXT')
    addColumnIfNotExists(db, 'bills', 'address', 'TEXT')
    addColumnIfNotExists(db, 'bills', 'items', 'TEXT')
    addColumnIfNotExists(db, 'bills', 'invoice_date', 'TEXT')
    addColumnIfNotExists(db, 'bills', 'subtotal', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'bills', 'discount_percent', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'bills', 'discount_amount', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'bills', 'discount', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'bills', 'tax', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'bills', 'shipping', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'bills', 'net_total', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'bills', 'total', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'bills', 'amount_paid', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'bills', 'paid_amount', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'bills', 'remaining_amount', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'bills', 'payment_type', `TEXT NOT NULL DEFAULT 'cash'`)
    addColumnIfNotExists(db, 'bills', 'payment_status', `TEXT NOT NULL DEFAULT 'unpaid'`)
    addColumnIfNotExists(db, 'bills', 'payment_date', 'TEXT')
    addColumnIfNotExists(db, 'bills', 'due_date', 'TEXT')
    addColumnIfNotExists(db, 'bills', 'pdf_path', 'TEXT')
    addColumnIfNotExists(db, 'bills', 'notes', 'TEXT')
    addColumnIfNotExists(db, 'bills', 'created_by', 'INTEGER')
    addColumnIfNotExists(db, 'bills', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP')
    addColumnIfNotExists(db, 'bills', 'deleted_at', 'TEXT')

    // billing_history
    addColumnIfNotExists(db, 'billing_history', 'bill_id', 'INTEGER')
    addColumnIfNotExists(db, 'billing_history', 'action', 'TEXT')
    addColumnIfNotExists(db, 'billing_history', 'old_data', 'TEXT')
    addColumnIfNotExists(db, 'billing_history', 'new_data', 'TEXT')
    addColumnIfNotExists(db, 'billing_history', 'action_by', 'INTEGER')
    addColumnIfNotExists(db, 'billing_history', 'action_at', 'TEXT DEFAULT CURRENT_TIMESTAMP')

    // purchase_invoices
    addColumnIfNotExists(db, 'purchase_invoices', 'invoice_no', 'TEXT')
    addColumnIfNotExists(db, 'purchase_invoices', 'purchase_no', 'TEXT')
    addColumnIfNotExists(db, 'purchase_invoices', 'supplier_id', 'INTEGER')
    addColumnIfNotExists(db, 'purchase_invoices', 'supplier_name', 'TEXT')
    addColumnIfNotExists(db, 'purchase_invoices', 'invoice_type', `TEXT DEFAULT 'purchase'`)
    addColumnIfNotExists(db, 'purchase_invoices', 'invoice_date', 'TEXT')
    addColumnIfNotExists(db, 'purchase_invoices', 'purchase_date', 'TEXT')
    addColumnIfNotExists(db, 'purchase_invoices', 'transport_expense', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'purchase_invoices', 'payment_type', `TEXT NOT NULL DEFAULT 'credit'`)
    addColumnIfNotExists(db, 'purchase_invoices', 'payment_status', `TEXT NOT NULL DEFAULT 'unpaid'`)
    addColumnIfNotExists(db, 'purchase_invoices', 'broker_name', 'TEXT')
    addColumnIfNotExists(db, 'purchase_invoices', 'warehouse_name', 'TEXT')
    addColumnIfNotExists(db, 'purchase_invoices', 'deleted_at', 'TEXT')

    // invoice item compatibility
    addColumnIfNotExists(db, 'sales_invoice_items', 'item_name', 'TEXT')
    addColumnIfNotExists(db, 'sales_invoice_items', 'weight', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'sales_invoice_items', 'amount', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'purchase_invoice_items', 'item_name', 'TEXT')
    addColumnIfNotExists(db, 'purchase_invoice_items', 'weight', 'REAL NOT NULL DEFAULT 0')
    addColumnIfNotExists(db, 'purchase_invoice_items', 'weight_unit', `TEXT DEFAULT 'kg'`)
    addColumnIfNotExists(db, 'purchase_invoice_items', 'amount', 'REAL NOT NULL DEFAULT 0')

    // cash_transactions
    addColumnIfNotExists(db, 'cash_transactions', 'source_of_payment', 'TEXT')
    addColumnIfNotExists(db, 'cash_transactions', 'deleted_at', 'TEXT')

    // users
    addColumnIfNotExists(db, 'users', 'full_name', 'TEXT')
    addColumnIfNotExists(db, 'users', 'phone', 'TEXT')
    addColumnIfNotExists(db, 'users', 'last_login_at', 'TEXT')
    addColumnIfNotExists(db, 'users', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP')
    addColumnIfNotExists(db, 'users', 'deleted_at', 'TEXT')

    // company_profile
    addColumnIfNotExists(db, 'company_profile', 'company_name', 'TEXT')
    addColumnIfNotExists(db, 'company_profile', 'phone', 'TEXT')
    addColumnIfNotExists(db, 'company_profile', 'email', 'TEXT')
    addColumnIfNotExists(db, 'company_profile', 'address', 'TEXT')
    addColumnIfNotExists(db, 'company_profile', 'logo', 'TEXT')
    addColumnIfNotExists(db, 'company_profile', 'ntn', 'TEXT')
    addColumnIfNotExists(db, 'company_profile', 'strn', 'TEXT')
    addColumnIfNotExists(db, 'company_profile', 'currency', `TEXT DEFAULT 'PKR'`)
    addColumnIfNotExists(db, 'company_profile', 'invoice_prefix', `TEXT DEFAULT 'INV'`)
    addColumnIfNotExists(db, 'company_profile', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP')

    // =========================
    // NEW TABLES
    // =========================

    createTableIfNotExists(
      db,
      `
      CREATE TABLE ledger_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_type TEXT NOT NULL CHECK(owner_type IN ('customer', 'supplier')),
        owner_id INTEGER NOT NULL,
        account_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(owner_type, owner_id)
      )
      `,
      'ledger_accounts'
    )

    createTableIfNotExists(
      db,
      `
      CREATE TABLE ledger_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        entry_date TEXT NOT NULL,
        entry_type TEXT NOT NULL,
        reference_type TEXT,
        reference_id INTEGER,
        debit REAL NOT NULL DEFAULT 0,
        credit REAL NOT NULL DEFAULT 0,
        balance_after REAL NOT NULL DEFAULT 0,
        description TEXT,
        notes TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT,
        FOREIGN KEY (account_id) REFERENCES ledger_accounts(id)
      )
      `,
      'ledger_entries'
    )

    createTableIfNotExists(
      db,
      `
      CREATE TABLE cash_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tx_date TEXT NOT NULL,
        tx_type TEXT NOT NULL CHECK(tx_type IN ('in', 'out')),
        category TEXT,
        reference_type TEXT,
        reference_id INTEGER,
        amount REAL NOT NULL DEFAULT 0,
        payment_method TEXT DEFAULT 'cash',
        description TEXT,
        notes TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT
      )
      `,
      'cash_transactions'
    )

    createTableIfNotExists(
      db,
      `
      CREATE TABLE counter_closings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        closing_date TEXT NOT NULL UNIQUE,
        physical_amount REAL NOT NULL DEFAULT 0 CHECK (physical_amount >= 0),
        expected_amount REAL NOT NULL DEFAULT 0,
        variance REAL NOT NULL DEFAULT 0,
        notes TEXT,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
      `,
      'counter_closings'
    )

    createTableIfNotExists(
      db,
      `
      CREATE TABLE bank_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_name TEXT NOT NULL,
        bank_name TEXT,
        account_number TEXT,
        opening_balance REAL NOT NULL DEFAULT 0,
        current_balance REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Active',
        notes TEXT,
        deleted_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
      `,
      'bank_accounts'
    )

    createTableIfNotExists(
      db,
      `
      CREATE TABLE bank_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        to_account_id INTEGER,
        tx_date TEXT NOT NULL,
        tx_type TEXT NOT NULL CHECK(tx_type IN ('deposit', 'withdrawal', 'transfer_in', 'transfer_out')),
        amount REAL NOT NULL DEFAULT 0,
        balance_after REAL NOT NULL DEFAULT 0,
        reference_type TEXT,
        reference_id INTEGER,
        description TEXT,
        notes TEXT,
        created_by INTEGER,
        deleted_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES bank_accounts(id)
      )
      `,
      'bank_transactions'
    )

    createTableIfNotExists(
      db,
      `
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_date TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        payment_method TEXT DEFAULT 'cash',
        vendor_name TEXT,
        reference_no TEXT,
        notes TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT
      )
      `,
      'expenses'
    )

    createTableIfNotExists(
      db,
      `
      CREATE TABLE sales_invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id INTEGER NOT NULL,
        stock_id INTEGER,
        product_name TEXT NOT NULL,
        sku TEXT,
        qty REAL NOT NULL DEFAULT 0,
        unit TEXT DEFAULT 'pcs',
        price REAL NOT NULL DEFAULT 0,
        discount REAL NOT NULL DEFAULT 0,
        tax REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bill_id) REFERENCES bills(id)
      )
      `,
      'sales_invoice_items'
    )

    createTableIfNotExists(
      db,
      `
      CREATE TABLE purchase_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_no TEXT,
        supplier_id INTEGER,
        purchase_date TEXT NOT NULL,
        subtotal REAL NOT NULL DEFAULT 0,
        discount REAL NOT NULL DEFAULT 0,
        tax REAL NOT NULL DEFAULT 0,
        shipping REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        paid_amount REAL NOT NULL DEFAULT 0,
        remaining_amount REAL NOT NULL DEFAULT 0,
        payment_type TEXT NOT NULL DEFAULT 'cash',
        payment_status TEXT NOT NULL DEFAULT 'unpaid',
        due_date TEXT,
        notes TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT
      )
      `,
      'purchase_invoices'
    )

    createTableIfNotExists(
      db,
      `
      CREATE TABLE purchase_invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_invoice_id INTEGER NOT NULL,
        stock_id INTEGER,
        product_name TEXT NOT NULL,
        sku TEXT,
        qty REAL NOT NULL DEFAULT 0,
        unit TEXT DEFAULT 'pcs',
        cost_price REAL NOT NULL DEFAULT 0,
        discount REAL NOT NULL DEFAULT 0,
        tax REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices(id)
      )
      `,
      'purchase_invoice_items'
    )

    createTableIfNotExists(
      db,
      `
      CREATE TABLE stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id INTEGER NOT NULL,
        movement_date TEXT NOT NULL,
        movement_type TEXT NOT NULL CHECK(
          movement_type IN (
            'purchase_in',
            'sale_out',
            'sale_return_in',
            'purchase_return_out',
            'adjustment_in',
            'adjustment_out',
            'damage_out',
            'opening_stock'
          )
        ),
        qty REAL NOT NULL DEFAULT 0,
        unit_cost REAL NOT NULL DEFAULT 0,
        reference_type TEXT,
        reference_id INTEGER,
        notes TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stock_id) REFERENCES stocks(id)
      )
      `,
      'stock_movements'
    )

    createTableIfNotExists(
      db,
      `
      CREATE TABLE employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        designation TEXT,
        basic_salary REAL NOT NULL DEFAULT 0,
        overtime_rate REAL NOT NULL DEFAULT 0,
        joining_date TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT
      )
      `,
      'employees'
    )

    createTableIfNotExists(
      db,
      `
      CREATE TABLE employee_attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        attend_date TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'leave', 'half_day')),
        check_in TEXT,
        check_out TEXT,
        overtime_hours REAL NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
      `,
      'employee_attendance'
    )

    createTableIfNotExists(
      db,
      `
      CREATE TABLE salary_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        month_label TEXT NOT NULL,
        basic_salary REAL NOT NULL DEFAULT 0,
        overtime_amount REAL NOT NULL DEFAULT 0,
        bonus REAL NOT NULL DEFAULT 0,
        deduction REAL NOT NULL DEFAULT 0,
        advance_amount REAL NOT NULL DEFAULT 0,
        net_salary REAL NOT NULL DEFAULT 0,
        paid_amount REAL NOT NULL DEFAULT 0,
        payment_status TEXT NOT NULL DEFAULT 'unpaid',
        payment_date TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
      `,
      'salary_transactions'
    )

    createTableIfNotExists(
      db,
      `
      CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_name TEXT NOT NULL,
        record_id INTEGER,
        action TEXT NOT NULL,
        old_data TEXT,
        new_data TEXT,
        action_by INTEGER,
        action_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
      `,
      'audit_logs'
    )

    createTableIfNotExists(
      db,
      `
      CREATE TABLE app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT NOT NULL UNIQUE,
        setting_value TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
      `,
      'app_settings'
    )

    createTableIfNotExists(
      db,
      `
      CREATE TABLE payment_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_type TEXT NOT NULL CHECK(account_type IN ('customer', 'supplier')),
        account_id INTEGER NOT NULL,
        reminder_date TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        message TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        sent_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
      `,
      'payment_reminders'
    )

    // =========================
    // INDEXES
    // =========================
    createIndexIfNotExists(db, `CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_id ON ledger_entries(account_id);`)
    createIndexIfNotExists(db, `CREATE INDEX IF NOT EXISTS idx_ledger_entries_entry_date ON ledger_entries(entry_date);`)
    createIndexIfNotExists(db, `CREATE INDEX IF NOT EXISTS idx_cash_transactions_tx_date ON cash_transactions(tx_date);`)
    createIndexIfNotExists(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_counter_closings_date ON counter_closings(closing_date);`)
    createIndexIfNotExists(db, `CREATE INDEX IF NOT EXISTS idx_bank_transactions_account_id ON bank_transactions(account_id);`)
    createIndexIfNotExists(db, `CREATE INDEX IF NOT EXISTS idx_bank_transactions_tx_date ON bank_transactions(tx_date);`)
    createIndexIfNotExists(db, `CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);`)
    createIndexIfNotExists(db, `CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_bill_id ON sales_invoice_items(bill_id);`)
    createIndexIfNotExists(db, `CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier_id ON purchase_invoices(supplier_id);`)
    createIndexIfNotExists(db, `CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_invoice_id ON purchase_invoice_items(purchase_invoice_id);`)
    createIndexIfNotExists(db, `CREATE INDEX IF NOT EXISTS idx_stock_movements_stock_id ON stock_movements(stock_id);`)
    createIndexIfNotExists(db, `CREATE INDEX IF NOT EXISTS idx_employee_attendance_employee_id ON employee_attendance(employee_id);`)
    createIndexIfNotExists(db, `CREATE INDEX IF NOT EXISTS idx_salary_transactions_employee_id ON salary_transactions(employee_id);`)

    // =========================
    // DEFAULT SETTINGS
    // =========================
    const insertSetting = db.prepare(`
      INSERT OR IGNORE INTO app_settings (setting_key, setting_value)
      VALUES (?, ?)
    `)

    const settings = [
      ['currency', 'PKR'],
      ['invoice_prefix', 'INV'],
      ['purchase_prefix', 'PUR'],
      ['low_stock_alert', '1'],
      ['backup_enabled', '1'],
    ]

    const settingsTx = db.transaction(() => {
      for (const [k, v] of settings) {
        insertSetting.run(k, v)
      }
    })
    settingsTx()

    // =========================
    // LEDGER ACCOUNT AUTO CREATE
    // =========================
    if (tableExists(db, 'customers') && tableExists(db, 'ledger_accounts')) {
      const customers = db.prepare(`SELECT id, name FROM customers WHERE deleted_at IS NULL OR deleted_at IS NULL`).all()
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO ledger_accounts (owner_type, owner_id, account_name)
        VALUES ('customer', ?, ?)
      `)
      for (const c of customers) {
        stmt.run(c.id, c.name || `Customer ${c.id}`)
      }
    }

    if (tableExists(db, 'suppliers') && tableExists(db, 'ledger_accounts')) {
      const suppliers = db.prepare(`SELECT id, name FROM suppliers WHERE deleted_at IS NULL OR deleted_at IS NULL`).all()
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO ledger_accounts (owner_type, owner_id, account_name)
        VALUES ('supplier', ?, ?)
      `)
      for (const s of suppliers) {
        stmt.run(s.id, s.name || `Supplier ${s.id}`)
      }
    }
    ensureDefaultAdminUser(db)
    console.log('All migrations completed successfully')
  } finally {
    db.close()
  }
}
