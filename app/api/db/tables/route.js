import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const result = await db.query(`SHOW TABLES`)
    console.log(result)
     return NextResponse.json({ tables: result || [] })
  
  } catch (err) {
    console.error('Error fetching tables:', err)
    return NextResponse.json({ tables: [] }, { status: 500 })
  }
}
