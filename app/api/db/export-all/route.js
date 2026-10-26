import db from '@/lib/db'
import { NextResponse } from 'next/server'
import { Parser } from 'json2csv'
import fs from 'fs'
import path from 'path'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'csv'

    const sqlite = db.getConnection()
    const dbPath =
      process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'database', 'ims.sqlite')

    // Always checkpoint WAL so disk file and memory are 100% in sync
    try {
      sqlite.pragma('wal_checkpoint(TRUNCATE)')
    } catch (e) {
      console.warn('WAL checkpoint warning:', e.message)
    }

    const today = new Date().toISOString().slice(0, 10)

    if (format === 'sqlite' || format === 'db') {
      if (!fs.existsSync(dbPath)) {
        return NextResponse.json({ error: 'Database file not found' }, { status: 404 })
      }
      const fileBuffer = fs.readFileSync(dbPath)
      return new Response(fileBuffer, {
        headers: {
          'Content-Type': 'application/x-sqlite3',
          'Content-Disposition': `attachment; filename="database-backup-${today}.sqlite"`,
        },
      })
    }

    // Default: CSV export of all tables
    const tableRows = sqlite
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `)
      .all()

    const tableNames = Array.isArray(tableRows) ? tableRows.map((row) => row.name) : []

    if (!tableNames.length) {
      return NextResponse.json({ error: 'No tables found' }, { status: 400 })
    }

    let csvCombined = ''

    for (const table of tableNames) {
      const cols = sqlite.prepare(`PRAGMA table_info(\`${table}\`)`).all().map((c) => c.name)
      const data = sqlite.prepare(`SELECT * FROM \`${table}\``).all()

      csvCombined += `# TABLE: ${table}\n`

      if (!Array.isArray(data) || data.length === 0) {
        csvCombined += `${cols.join(',')}\n\n`
        continue
      }

      const parser = new Parser({ fields: cols })
      const csv = parser.parse(data)
      csvCombined += `${csv}\n\n`
    }

    return new Response(csvCombined, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="full-database-${today}.csv"`,
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
