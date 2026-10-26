import db from '@/lib/db'
import { NextResponse } from 'next/server'
import { Parser } from 'json2csv'

export async function POST(req) {
  try {
    const { table } = await req.json()

    if (!table) {
      return NextResponse.json({ error: 'Table name is required' }, { status: 400 })
    }

    const sqlite = db.getConnection()
    const tableRow = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name = ?"
      )
      .get(table)

    if (!tableRow) {
      return NextResponse.json({ error: `Table "${table}" not found` }, { status: 404 })
    }

    const cols = sqlite.prepare(`PRAGMA table_info(\`${table}\`)`).all().map((c) => c.name)
    const rows = sqlite.prepare(`SELECT * FROM \`${table}\``).all()

    let csv = ''
    if (!rows || rows.length === 0) {
      csv = cols.join(',') + '\n'
    } else {
      const parser = new Parser({ fields: cols })
      csv = parser.parse(rows)
    }

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${table}.csv"`,
      },
    })
  } catch (err) {
    console.error('Export error:', err)
    return NextResponse.json(
      { error: 'Export failed', message: err.message },
      { status: 500 }
    )
  }
}
