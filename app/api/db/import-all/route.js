import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { parse } from 'csv-parse/sync'
import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { runMigrations } from '@/lib/migrate.js'

export const config = { api: { bodyParser: false } }

function fixDates(record) {
  const fixed = { ...record }
  for (const key in fixed) {
    const value = fixed[key]
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        fixed[key] = date.toISOString().slice(0, 19).replace('T', ' ')
      }
    }
  }
  return fixed
}

export async function POST(req) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 })
    }

    // Check if the uploaded file is a raw SQLite database file
    const isSQLiteFile =
      buffer.length >= 16 && buffer.slice(0, 16).toString('utf8').startsWith('SQLite format 3')

    const dbPath =
      process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'database', 'ims.sqlite')
    const dir = path.dirname(dbPath)

    if (isSQLiteFile) {
      const tempPath = path.join(dir, `temp_restore_${Date.now()}.sqlite`)
      try {
        fs.writeFileSync(tempPath, buffer)
        const tempDb = new Database(tempPath, { readonly: true })
        const tables = tempDb
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
          )
          .all()
        tempDb.close()

        if (!tables.length) {
          throw new Error('SQLite file contains no tables.')
        }

        // Backup existing database before overwriting
        const backupPath = path.join(dir, `ims_backup_before_restore_${Date.now()}.sqlite`)
        if (fs.existsSync(dbPath)) {
          fs.copyFileSync(dbPath, backupPath)
        }

        // Checkpoint current db connection if open
        const currentDb = db.getConnection()
        try {
          currentDb.pragma('wal_checkpoint(TRUNCATE)')
        } catch (_) {}

        // Replace main db with temp db
        fs.copyFileSync(tempPath, dbPath)
        try {
          fs.unlinkSync(tempPath)
        } catch (_) {}

        // Remove old WAL and SHM files
        const walPath = `${dbPath}-wal`
        const shmPath = `${dbPath}-shm`
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)

        // Run migrations on restored database
        runMigrations()

        return NextResponse.json({
          success: true,
          message: `Database successfully restored from SQLite file (${tables.length} tables verified).`,
          tablesRestored: tables.length,
        })
      } catch (e) {
        if (fs.existsSync(tempPath)) {
          try {
            fs.unlinkSync(tempPath)
          } catch (_) {}
        }
        throw new Error(`Invalid SQLite database file: ${e.message}`)
      }
    }

    // Otherwise handle CSV file (multi-table dump)
    const text = buffer.toString('utf-8')
    const chunks = text.split(/^#\s*TABLE:\s*/gm).filter(Boolean)

    if (!chunks.length) {
      return NextResponse.json(
        { error: 'Invalid backup file. No "# TABLE: [name]" sections found.' },
        { status: 400 }
      )
    }

    // Ensure database schema & all tables exist
    runMigrations()

    const sqlite = db.getConnection()
    let tablesRestored = 0
    let recordsRestored = 0

    sqlite.pragma('foreign_keys = OFF')

    try {
      const restoreTransaction = sqlite.transaction(() => {
        for (const chunk of chunks) {
          const lines = chunk.trim().split('\n')
          const table = lines[0].trim().split('|')[0].trim()
          const csvContent = lines.slice(1).join('\n').trim()

          if (!table) continue

          const tableExists = sqlite
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
            .get(table)
          if (!tableExists) continue

          // Clear existing rows in this table for clean full restore
          sqlite.prepare(`DELETE FROM \`${table}\``).run()

          if (!csvContent || csvContent === 'No data found.') {
            continue
          }

          let records = []
          try {
            records = parse(csvContent, {
              columns: true,
              skip_empty_lines: true,
              relax_column_count: true,
              trim: true,
            })
          } catch (e) {
            console.warn(`Could not parse CSV for table ${table}:`, e.message)
            continue
          }

          if (!records.length) continue

          const tableCols = sqlite.prepare(`PRAGMA table_info(\`${table}\`)`).all()
          const colMap = new Map(tableCols.map((c) => [c.name, c]))
          const validCols = Object.keys(records[0]).filter((c) => colMap.has(c))

          if (!validCols.length) continue

          const quotedCols = validCols.map((c) => `\`${c}\``).join(', ')
          const placeholders = validCols.map(() => '?').join(', ')
          const insertStmt = sqlite.prepare(
            `INSERT INTO \`${table}\` (${quotedCols}) VALUES (${placeholders})`
          )

          let maxId = 0
          const hasId = validCols.includes('id')

          for (const rawRow of records) {
            const row = fixDates(rawRow)
            const values = validCols.map((col) => {
              let val = row[col]
              if (
                val === '' ||
                val === null ||
                val === undefined ||
                val === 'NULL' ||
                val === 'null'
              ) {
                return null
              }
              const colInfo = colMap.get(col)
              const colType = (colInfo.type || '').toUpperCase()
              if (colType.includes('INT')) {
                const num = parseInt(val, 10)
                return isNaN(num) ? null : num
              }
              if (
                colType.includes('REAL') ||
                colType.includes('FLOA') ||
                colType.includes('DOUB') ||
                colType.includes('NUM')
              ) {
                const num = parseFloat(val)
                return isNaN(num) ? null : num
              }
              return val
            })

            insertStmt.run(...values)
            if (hasId && Number(row.id) > maxId) maxId = Number(row.id)
            recordsRestored++
          }

          if (hasId && maxId > 0) {
            sqlite.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(table)
            sqlite.prepare('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)').run(table, maxId)
          }

          tablesRestored++
        }
      })

      restoreTransaction()
    } finally {
      sqlite.pragma('foreign_keys = ON')
    }

    return NextResponse.json({
      success: true,
      message: `Full database successfully imported (${tablesRestored} tables, ${recordsRestored} records restored).`,
      tablesRestored,
      recordsRestored,
    })
  } catch (err) {
    console.error('Full DB Import Error:', err)
    return NextResponse.json(
      { error: 'Failed to import full database', message: err.message },
      { status: 500 }
    )
  }
}
