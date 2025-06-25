import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { parse } from 'csv-parse/sync'

export const config = { api: { bodyParser: false } }

// 🔧 Convert ISO date to MySQL DATETIME
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

// 🔍 Infer MySQL column types
function inferMySQLType(value) {
    if (value === '') return 'TEXT'
    if (!isNaN(Number(value))) {
        const num = Number(value)
        if (Number.isInteger(num) && String(num).length < 10) return 'INT'
        return 'VARCHAR(50)'
    }
    if (/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)) return 'DATETIME'
    return 'TEXT'
}

// 🏗️ Create table if it doesn't exist
async function createTableIfMissing(table, records) {
    const sample = records[0]
    const columns = Object.keys(sample)
    const columnDefs = columns.map(col => `\`${col}\` ${inferMySQLType(sample[col])}`).join(', ')
    const createSQL = `CREATE TABLE IF NOT EXISTS \`${table}\` (${columnDefs})`
    await db.query(createSQL)
}

// ✅ Auto-generate ON DUPLICATE KEY UPDATE clause
function generateUpsertSQL(table, columns) {
    const placeholders = columns.map(() => '?').join(', ')
    const updateClause = columns.map(col => `\`${col}\`=VALUES(\`${col}\`)`).join(', ')
    return `INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(', ')})
    VALUES (${placeholders})
    ON DUPLICATE KEY UPDATE ${updateClause}`
}

// 📥 Handle full DB import from combined CSV
export async function POST(req) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const text = await file.text()
    const chunks = text.split(/^# TABLE: /gm).filter(Boolean)
    if (!chunks.length) return NextResponse.json({ error: 'No table sections found in CSV' }, { status: 400 })

    for (const chunk of chunks) {
      const [headerLine, ...csvLines] = chunk.trim().split('\n')

      const [table, uniqueKey] = headerLine.trim().split('|') // 📌 support `# TABLE: table|uniqueKey`
      const csvText = csvLines.join('\n')

      const records = parse(csvText, { columns: true, skip_empty_lines: true })
      if (!records.length) continue

      const fixedRecords = records.map(fixDates)

      const columns = Object.keys(fixedRecords[0])
      const placeholders = columns.map(() => '?').join(', ')

      // 🏗️ Include UNIQUE constraint if provided
      const sample = fixedRecords[0]
      const columnDefs = columns.map(col => {
        const type = inferMySQLType(sample[col])
        const unique = uniqueKey === col ? 'UNIQUE' : ''
        return `\`${col}\` ${type} ${unique}`.trim()
      }).join(', ')

      const createSQL = `CREATE TABLE IF NOT EXISTS \`${table}\` (${columnDefs})`
      await db.query(createSQL)

      const updateClause = columns.map(col => `\`${col}\`=VALUES(\`${col}\`)`).join(', ')
      const insertSQL = `INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`

      for (const row of fixedRecords) {
        const values = columns.map(col => row[col])
        await db.query(insertSQL, values)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Full DB Import Error:', err)
    return NextResponse.json({ error: 'Failed to import full database', message: err.message }, { status: 500 })
  }
}

