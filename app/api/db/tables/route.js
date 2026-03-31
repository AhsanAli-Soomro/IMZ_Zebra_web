import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const result = await db.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `)

    // clean response (sirf table names)
    const tables = result.map(t => t.name)

    return NextResponse.json({ tables })
  
  } catch (err) {
    console.error('Error fetching tables:', err)
    return NextResponse.json({ tables: [] }, { status: 500 })
  }
}