import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const data = await db.query('SELECT * FROM users WHERE user_type IN (?, ?)', ['Admin', 'Employee'])
  return NextResponse.json({ success: true, data })
}

export async function POST(req) {
  const body = await req.json()
  const { name, email, password, user_type, salary, dob, date_of_joining, phone } = body

  await db.query(
    `INSERT INTO users (name, email, password, user_type, salary, dob, date_of_joining, phone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, email, password, user_type, salary, dob, date_of_joining, phone]
  )

  return NextResponse.json({ success: true, message: 'Employee added' })
}

export async function PUT(req) {
  const body = await req.json()
  const { id, name, email, password, user_type, salary, dob, date_of_joining, phone } = body

  await db.query(
    `UPDATE users SET name=?, email=?, password=?, user_type=?, salary=?, dob=?, date_of_joining=?, phone=? WHERE id=?`,
    [name, email, password, user_type, salary, dob, date_of_joining, phone, id]
  )

  return NextResponse.json({ success: true, message: 'Employee updated' })
}

export async function DELETE(req) {
  const { id } = await req.json()
  await db.query('DELETE FROM users WHERE id = ?', [id])
  return NextResponse.json({ success: true, message: 'Employee deleted' })
}
