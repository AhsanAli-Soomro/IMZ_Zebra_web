import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { parse as csvParse } from 'csv-parse/sync'

export const config = { api: { bodyParser: false } }

// 🔧 Fix ISO date to MySQL DATETIME
function fixDates(record) {
  const fixed = { ...record }
  for (const key in fixed) {
    const value = fixed[key]
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const d = new Date(value)
      if (!isNaN(d)) {
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

    const text = await file.text()
    const records = csvParse(text, {
      columns: true,
      skip_empty_lines: true,
    })

    if (records.length === 0) {
      return NextResponse.json({ error: 'CSV is empty' }, { status: 400 })
    }

    const fixedRecords = records.map(fixDates)
    const columns = Object.keys(fixedRecords[0])
    const placeholders = columns.map(() => '?').join(', ')
    const updateClause = columns.map(col => `\`${col}\`=VALUES(\`${col}\`)`).join(', ')

    const insertSQL = `INSERT INTO \`${table}\` (${columns.map(col => `\`${col}\``).join(', ')})
      VALUES (${placeholders})
      ON DUPLICATE KEY UPDATE ${updateClause}`

    for (const row of fixedRecords) {
      const values = columns.map(col => row[col])
      await db.query(insertSQL, values)
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('CSV Import Error:', err)
    return NextResponse.json({ error: 'Failed to import CSV', message: err.message }, { status: 500 })
  }
}
