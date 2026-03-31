import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { parse } from 'csv-parse/sync'

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

function inferSQLiteType(value) {
  if (value === '' || value == null) return 'TEXT'

  if (!isNaN(Number(value))) {
    const num = Number(value)
    if (Number.isInteger(num)) return 'INTEGER'
    return 'REAL'
  }

  if (/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)) return 'TEXT'

  return 'TEXT'
}

export async function POST(req) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const text = await file.text()
    const chunks = text.split(/^# TABLE: /gm).filter(Boolean)

    if (!chunks.length) {
      return NextResponse.json(
        { error: 'No table sections found in CSV' },
        { status: 400 }
      )
    }

    for (const chunk of chunks) {
      const [headerLine, ...csvLines] = chunk.trim().split('\n')
      const [table, uniqueKey] = headerLine.trim().split('|')
      const csvText = csvLines.join('\n')

      const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
      })

      if (!records.length) continue

      const fixedRecords = records.map(fixDates)
      const columns = Object.keys(fixedRecords[0])

      const sample = fixedRecords[0]
      const columnDefs = columns
        .map(col => {
          const type = inferSQLiteType(sample[col])

          if (col === 'id') {
            return `\`${col}\` INTEGER PRIMARY KEY`
          }

          if (uniqueKey === col) {
            return `\`${col}\` ${type} UNIQUE`
          }

          return `\`${col}\` ${type}`
        })
        .join(', ')

      const createSQL = `CREATE TABLE IF NOT EXISTS \`${table}\` (${columnDefs})`
      await db.query(createSQL)

      const placeholders = columns.map(() => '?').join(', ')
      const quotedColumns = columns.map(c => `\`${c}\``).join(', ')

      const canReplace = columns.includes('id') || (uniqueKey && columns.includes(uniqueKey))

      const insertSQL = canReplace
        ? `INSERT OR REPLACE INTO \`${table}\` (${quotedColumns}) VALUES (${placeholders})`
        : `INSERT INTO \`${table}\` (${quotedColumns}) VALUES (${placeholders})`

      for (const row of fixedRecords) {
        const values = columns.map(col => row[col])
        await db.query(insertSQL, values)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Full DB Import Error:', err)
    return NextResponse.json(
      { error: 'Failed to import full database', message: err.message },
      { status: 500 }
    )
  }
}