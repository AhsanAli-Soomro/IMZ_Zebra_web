import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const data = await db.query(`
      SELECT *
      FROM customers
      WHERE deleted_at IS NULL OR deleted_at = ''
      ORDER BY created_at DESC
    `)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load customers' },
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { name, email, phone, address, status } = body

    await db.query(
      `INSERT INTO customers (name, email, phone, address, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [name, email, phone, address, status]
    )

    return NextResponse.json({ success: true, message: 'Customer added' })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to add customer' },
      { status: 500 }
    )
  }
}

export async function PUT(req) {
  try {
    const body = await req.json()
    const { id, name, email, phone, address, status } = body

    await db.query(
      `UPDATE customers
       SET name = ?, email = ?, phone = ?, address = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, email, phone, address, status, id]
    )

    return NextResponse.json({ success: true, message: 'Customer updated' })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update customer' },
      { status: 500 }
    )
  }
}

export async function DELETE(req) {
  try {
    const { id } = await req.json()

    await db.query(
      `UPDATE customers
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    )

    return NextResponse.json({ success: true, message: 'Customer deleted' })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to delete customer' },
      { status: 500 }
    )
  }
}