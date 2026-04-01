import db from '@/lib/db'
import { NextResponse } from 'next/server'
import { Parser } from 'json2csv'

export async function POST(req) {
  try {
    const { table } = await req.json()

    if (!table) {
      return NextResponse.json({ error: 'Table name is required' }, { status: 400 })
    }

    const tableRows = await db.query(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
    `)

    const allowedTables = Array.isArray(tableRows) ? tableRows.map((row) => row.name) : []

    if (!allowedTables.includes(table)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 })
    }

    const rows = await db.query(`SELECT * FROM \`${table}\``)

    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response('No data found.', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${table}.csv"`,
        },
      })
    }

    const parser = new Parser()
    const csv = parser.parse(rows)

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${table}.csv"`,
      },
    })
  } catch (err) {
    console.error('Export error:', err)
    return new Response(`Error: ${err.message}`, { status: 500 })
  }
}