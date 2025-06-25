import db from '@/lib/db'
import { NextResponse } from 'next/server'
import { Parser } from 'json2csv'

export async function GET() {
  try {
    const rows = await db.query(`SHOW TABLES`)

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No tables found' }, { status: 400 })
    }

    const key = Object.keys(rows[0])[0]
    const tableNames = rows.map(row => row[key])

    let csvCombined = ''

    for (const table of tableNames) {
      const data = await db.query(`SELECT * FROM \`${table}\``)
      if (!data || data.length === 0) continue

      const parser = new Parser()
      const csv = parser.parse(data)

      csvCombined += `# TABLE: ${table}\n${csv}\n\n`
    }

    return new Response(csvCombined, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="full-database.csv"',
      },
    })
  } catch (err) {
    console.error('Export error:', err)
    return NextResponse.json({ error: 'Export failed', message: err.message }, { status: 500 })
  }
}
