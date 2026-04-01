import db from '@/lib/db'
import { NextResponse } from 'next/server'
import { Parser } from 'json2csv'

export async function GET() {
  try {
    const tableRows = await db.query(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `)

    const tableNames = Array.isArray(tableRows) ? tableRows.map((row) => row.name) : []

    if (!tableNames.length) {
      return NextResponse.json({ error: 'No tables found' }, { status: 400 })
    }

    let csvCombined = ''

    for (const table of tableNames) {
      const data = await db.query(`SELECT * FROM \`${table}\``)

      csvCombined += `# TABLE: ${table}\n`

      if (!Array.isArray(data) || data.length === 0) {
        csvCombined += 'No data found.\n\n'
        continue
      }

      const parser = new Parser()
      const csv = parser.parse(data)
      csvCombined += `${csv}\n\n`
    }

    return new Response(csvCombined, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="full-database.csv"',
      },
    })
  } catch (err) {
    console.error('Export all error:', err)
    return NextResponse.json(
      { error: 'Export failed', message: err.message },
      { status: 500 }
    )
  }
}