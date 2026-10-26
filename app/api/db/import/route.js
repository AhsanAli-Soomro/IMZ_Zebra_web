import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { parse as csvParse } from 'csv-parse/sync'

export const config = { api: { bodyParser: false } }

function fixDates(record) {
  const fixed = { ...record }
  for (const key in fixed) {
    const value = fixed[key]
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        fixed[key] = d.toISOString().slice(0, 19).replace('T', ' ')
      }
    }
  }
  return fixed
}

export async function POST(req) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const table = formData.get('table')

    if (!file || !table) {
      return NextResponse.json({ error: 'Missing file or table' }, { status: 400 })
    }

    const sqlite = db.getConnection()
    const tableExists = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name = ?"
      )
      .get(table)

    if (!tableExists) {
      return NextResponse.json(
        { error: `Table "${table}" does not exist in database.` },
        { status: 404 }
      )
    }

    const text = await file.text()
    const records = csvParse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    })

    if (records.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty or has no data rows.' },
        { status: 400 }
      )
    }

    const tableCols = sqlite.prepare(`PRAGMA table_info(\`${table}\`)`).all()
    const colMap = new Map(tableCols.map((c) => [c.name, c]))
    const validCols = Object.keys(records[0]).filter((c) => colMap.has(c))

    if (!validCols.length) {
      return NextResponse.json(
        { error: `CSV columns do not match table "${table}".` },
        { status: 400 }
      )
    }

    const placeholders = validCols.map(() => '?').join(', ')
    const quotedColumns = validCols.map((col) => `\`${col}\``).join(', ')

    const hasId = validCols.includes('id')
    const insertSQL = hasId
      ? `INSERT OR REPLACE INTO \`${table}\` (${quotedColumns}) VALUES (${placeholders})`
      : `INSERT INTO \`${table}\` (${quotedColumns}) VALUES (${placeholders})`

    let maxId = 0
    let importedCount = 0

    sqlite.pragma('foreign_keys = OFF')

    try {
      const tx = sqlite.transaction(() => {
        const stmt = sqlite.prepare(insertSQL)
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

          stmt.run(...values)
          if (hasId && Number(row.id) > maxId) maxId = Number(row.id)
          importedCount++
        }

        if (hasId && maxId > 0) {
          sqlite.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(table)
          sqlite.prepare('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)').run(table, maxId)
        }
      })

      tx()
    } finally {
      sqlite.pragma('foreign_keys = ON')
    }

    return NextResponse.json({
      success: true,
      count: importedCount,
      message: `Successfully imported ${importedCount} records to "${table}".`,
    })
  } catch (err) {
    console.error('CSV Import Error:', err)
    return NextResponse.json(
      { error: 'Failed to import CSV', message: err.message },
      { status: 500 }
    )
  }
}
