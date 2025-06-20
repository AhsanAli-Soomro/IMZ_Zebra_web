import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const data = await db.query('SELECT * FROM customers ORDER BY created_at DESC')
  return NextResponse.json({ success: true, data })
}

export async function POST(req) {
  const body = await req.json()
  const { name, email, phone, address, status } = body

  await db.query(
    `INSERT INTO customers (name, email, phone, address, status)
     VALUES (?, ?, ?, ?, ?)`,
    [name, email, phone, address, status]
  )

  return NextResponse.json({ success: true, message: 'Customer added' })
}

export async function PUT(req) {
  const body = await req.json()
  const { id, name, email, phone, address, status } = body

  await db.query(
    `UPDATE customers SET name=?, email=?, phone=?, address=?, status=? WHERE id=?`,
    [name, email, phone, address, status, id]
  )

  return NextResponse.json({ success: true, message: 'Customer updated' })
}

export async function DELETE(req) {
  const { id } = await req.json()
  await db.query('DELETE FROM customers WHERE id = ?', [id])
  return NextResponse.json({ success: true, message: 'Customer deleted' })
}
