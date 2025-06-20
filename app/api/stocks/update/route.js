// app/api/stocks/update/route.js
import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const updates = await req.json() // Expecting [{ id: 1, qty: 2 }, ...]

    for (const item of updates) {
      await db.query(
        'UPDATE stocks SET quantity = quantity - ? WHERE id = ?',
        [item.qty, item.id]
      )
    }

    return NextResponse.json({ success: true, message: 'Stock updated successfully' })
  } catch (error) {
    console.error('Stock update error:', error)
    return NextResponse.json({ success: false, message: 'Failed to update stock' }, { status: 500 })
  }
}
