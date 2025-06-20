import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(req) {
  const body = await req.json()
  const {
    invoice_no,
    customer_name,
    contact,
    address,
    items,
    subtotal,
    discount_percent,
    discount_amount,
    net_total
  } = body

  await db.query(`
    INSERT INTO bills
    (invoice_no, customer_name, contact, address, items, subtotal, discount_percent, discount_amount, net_total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [invoice_no, customer_name, contact, address, JSON.stringify(items), subtotal, discount_percent, discount_amount, net_total]
  )

  return NextResponse.json({ success: true, message: 'Invoice saved' })
}
