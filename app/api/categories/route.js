import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const data = await db.query('SELECT * FROM categories ORDER BY created_at DESC')
  return NextResponse.json({ success: true, data })
}

export async function POST(req) {
  const body = await req.json()
  const { name, status } = body

  await db.query(
    `INSERT INTO categories (name, status)
     VALUES (?, ?)`,
    [name, status]
  )

  return NextResponse.json({ success: true, message: 'Category added' })
}

export async function PUT(req) {
  const body = await req.json()
  const { id, name, status } = body

  await db.query(
    `UPDATE categories SET name=?, status=? WHERE id=?`,
    [name, status, id]
  )

  return NextResponse.json({ success: true, message: 'Category updated' })
}

export async function DELETE(req) {
  const { id } = await req.json()
  await db.query('DELETE FROM categories WHERE id = ?', [id])
  return NextResponse.json({ success: true, message: 'Category deleted' })
}
