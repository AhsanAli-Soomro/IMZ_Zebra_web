import db from '@/lib/db'
import { NextResponse } from 'next/server'
import { Parser } from 'json2csv'

export async function POST(req) {
  try {
    const { table } = await req.json()

    if (!table) {
      return NextResponse.json({ error: 'Table name is required' }, { status: 400 })
    }

    // 🚫 DON'T use ?? in this context. Instead, validate and inject table name safely:
    const allowedTables = ['stocks', 'customers', 'bills', 'billing_history', 'categories', 'payment_history', 'suppliers', 'users', 'company_profile']
    if (!allowedTables.includes(table)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 })
    }

    // Safe query
    const rows = await db.query(`SELECT * FROM \`${table}\``)

    if (!rows || rows.length === 0) {
      return new Response('No data found.', { status: 404 })
    }

    const parser = new Parser()
    const csv = parser.parse(rows)

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${table}.csv"`,
      },
    })
  } catch (err) {
    console.error('Export error:', err)
    return new Response(`Error: ${err.message}`, { status: 500 })
  }
}
