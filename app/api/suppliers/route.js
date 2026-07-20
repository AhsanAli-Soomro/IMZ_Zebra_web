import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const data = await db.query(`
    SELECT *
    FROM suppliers
    WHERE deleted_at IS NULL OR deleted_at = ''
    ORDER BY created_at DESC
  `)
  return NextResponse.json({ success: true, data })
}

export async function POST(req) {
  const body = await req.json()
  const { name, company_name, email, phone, address, status } = body

  await db.query(
    `INSERT INTO suppliers (name, company_name, email, phone, address, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, company_name, email, phone, address, status]
  )

  return NextResponse.json({ success: true, message: 'Supplier added' })
}

export async function PUT(req) {
  const body = await req.json()
  const { id, name, company_name, email, phone, address, status } = body

  await db.query(
    `UPDATE suppliers
     SET name=?, company_name=?, email=?, phone=?, address=?, status=?
     WHERE id=?`,
    [name, company_name, email, phone, address, status, id]
  )

  return NextResponse.json({ success: true, message: 'Supplier updated' })
}

export async function DELETE(req) {
  const { id } = await req.json()
  await db.query(
    `UPDATE suppliers
     SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id]
  )
  return NextResponse.json({ success: true, message: 'Supplier deleted' })
}
