import 'dotenv/config'
import mysql from 'mysql2/promise'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { getDatabasePath } from '../lib/db-path.js'

const TABLES = [
  'billing_history',
  'bills',
  'categories',
  'company_profile',
  'customers',
  'stocks',
  'suppliers',
  'users',
]

const SQLITE_PATH = getDatabasePath()
const SQLITE_DIR = path.dirname(SQLITE_PATH)

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function q(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

function sqliteType(mysqlType) {
  const t = mysqlType.toLowerCase()

  if (
    t.includes('int') ||
    t.includes('tinyint') ||
    t.includes('smallint') ||
    t.includes('mediumint') ||
    t.includes('bigint') ||
    t.includes('bit') ||
    t.includes('boolean')
  ) {
    return 'INTEGER'
  }

  if (
    t.includes('decimal') ||
    t.includes('numeric') ||
    t.includes('float') ||
    t.includes('double') ||
    t.includes('real')
  ) {
    return 'REAL'
  }

  if (
    t.includes('date') ||
    t.includes('datetime') ||
    t.includes('timestamp') ||
    t.includes('time') ||
    t.includes('year')
  ) {
    return 'TEXT'
  }

  if (
    t.includes('char') ||
    t.includes('varchar') ||
    t.includes('text') ||
    t.includes('longtext') ||
    t.includes('mediumtext') ||
    t.includes('tinytext') ||
    t.includes('enum') ||
    t.includes('set') ||
    t.includes('json')
  ) {
    return 'TEXT'
  }

  if (
    t.includes('blob') ||
    t.includes('binary') ||
    t.includes('varbinary')
  ) {
    return 'BLOB'
  }

  return 'TEXT'
}

function formatDefaultValue(def) {
  if (def === null || def === undefined) return null

  const val = String(def).trim()

  if (
    val.toUpperCase() === 'CURRENT_TIMESTAMP' ||
    val.toUpperCase().startsWith('CURRENT_TIMESTAMP')
  ) {
    return 'DEFAULT CURRENT_TIMESTAMP'
  }

  if (/^-?\d+(\.\d+)?$/.test(val)) {
    return `DEFAULT ${val}`
  }

  return `DEFAULT '${val.replace(/'/g, "''")}'`
}

async function getColumns(mysqlConn, tableName) {
  const [rows] = await mysqlConn.query(`SHOW FULL COLUMNS FROM \`${tableName}\``)
  return rows
}

async function getIndexes(mysqlConn, tableName) {
  const [rows] = await mysqlConn.query(`SHOW INDEX FROM \`${tableName}\``)
  return rows
}

function buildCreateTableSQL(tableName, columns) {
  const pkColumns = columns.filter(col => col.Key === 'PRI')
  const isSingleIntegerAutoPk =
    pkColumns.length === 1 &&
    columns.find(c => c.Field === pkColumns[0].Field)?.Extra?.toLowerCase().includes('auto_increment') &&
    sqliteType(pkColumns[0].Type) === 'INTEGER'

  const defs = []

  for (const col of columns) {
    const name = col.Field
    const type = sqliteType(col.Type)
    const notNull = col.Null === 'NO' ? 'NOT NULL' : ''
    const defaultVal = formatDefaultValue(col.Default)

    if (isSingleIntegerAutoPk && col.Field === pkColumns[0].Field) {
      defs.push(`${q(name)} INTEGER PRIMARY KEY AUTOINCREMENT`)
      continue
    }

    let def = `${q(name)} ${type}`

    if (notNull) def += ` ${notNull}`
    if (defaultVal) def += ` ${defaultVal}`

    defs.push(def)
  }

  if (!isSingleIntegerAutoPk && pkColumns.length > 0) {
    const pkList = pkColumns.map(c => q(c.Field)).join(', ')
    defs.push(`PRIMARY KEY (${pkList})`)
  }

  return `CREATE TABLE IF NOT EXISTS ${q(tableName)} (\n  ${defs.join(',\n  ')}\n);`
}

function buildIndexesSQL(tableName, indexes) {
  const grouped = {}

  for (const idx of indexes) {
    if (idx.Key_name === 'PRIMARY') continue

    if (!grouped[idx.Key_name]) {
      grouped[idx.Key_name] = {
        unique: idx.Non_unique === 0,
        columns: [],
      }
    }

    grouped[idx.Key_name].columns.push({
      seq: idx.Seq_in_index,
      name: idx.Column_name,
    })
  }

  const sqls = []

  for (const [indexName, info] of Object.entries(grouped)) {
    const cols = info.columns
      .sort((a, b) => a.seq - b.seq)
      .map(c => q(c.name))
      .join(', ')

    const unique = info.unique ? 'UNIQUE ' : ''
    const safeIndexName = `${tableName}_${indexName}`

    sqls.push(
      `CREATE ${unique}INDEX IF NOT EXISTS ${q(safeIndexName)} ON ${q(tableName)} (${cols});`
    )
  }

  return sqls
}

async function fetchRows(mysqlConn, tableName) {
  const [rows] = await mysqlConn.query(`SELECT * FROM \`${tableName}\``)
  return rows
}

function normalizeValue(value) {
  if (value === undefined) return null
  if (value === null) return null

  if (value instanceof Date) {
    return value.toISOString().slice(0, 19).replace('T', ' ')
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }

  if (Buffer.isBuffer(value)) {
    return value
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return value
}

function insertRows(sqlite, tableName, rows) {
  if (!rows.length) {
    console.log(`No rows in ${tableName}`)
    return
  }

  const columns = Object.keys(rows[0])
  const placeholders = columns.map(() => '?').join(', ')
  const insertSQL = `
    INSERT INTO ${q(tableName)} (${columns.map(q).join(', ')})
    VALUES (${placeholders})
  `

  const stmt = sqlite.prepare(insertSQL)

  const tx = sqlite.transaction((data) => {
    for (const row of data) {
      const values = columns.map(col => normalizeValue(row[col]))
      stmt.run(...values)
    }
  })

  tx(rows)
}

async function migrateTable(mysqlConn, sqlite, tableName) {
  console.log(`\nMigrating table: ${tableName}`)

  const columns = await getColumns(mysqlConn, tableName)
  const indexes = await getIndexes(mysqlConn, tableName)

  const createSQL = buildCreateTableSQL(tableName, columns)

  sqlite.exec(`DROP TABLE IF EXISTS ${q(tableName)};`)
  sqlite.exec(createSQL)

  const rows = await fetchRows(mysqlConn, tableName)
  insertRows(sqlite, tableName, rows)

  const indexSQLs = buildIndexesSQL(tableName, indexes)
  for (const sql of indexSQLs) {
    sqlite.exec(sql)
  }

  console.log(`Done: ${tableName} (${rows.length} rows)`)
}

async function main() {
  ensureDir(SQLITE_DIR)

  const mysqlConn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  })

  const sqlite = new Database(SQLITE_PATH)

  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = OFF')

  try {
    for (const table of TABLES) {
      await migrateTable(mysqlConn, sqlite, table)
    }

    sqlite.pragma('foreign_keys = ON')
    console.log('\nAll tables migrated successfully.')
    console.log(`SQLite file: ${SQLITE_PATH}`)
  } catch (error) {
    console.error('\nMigration failed:', error)
  } finally {
    await mysqlConn.end()
    sqlite.close()
  }
}

main()