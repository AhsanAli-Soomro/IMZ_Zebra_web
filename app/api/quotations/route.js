import { NextResponse } from 'next/server'
import db from '@/lib/db'

// GET /api/quotations: Fetch all quotations
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    let query = `
      SELECT q.*, 
        COUNT(qi.id) as total_items
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
    `
    const conditions = []
    const params = []

    if (status && status !== 'all') {
      conditions.push('q.status = ?')
      params.push(status)
    }

    if (search) {
      conditions.push('(q.quotation_number LIKE ? OR q.customer_name LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }

    query += ` GROUP BY q.id ORDER BY q.id DESC LIMIT 100`

    const quotations = await db.query(query, params)

    return NextResponse.json({ ok: true, data: quotations || [] })
  } catch (err) {
    console.error('Fetch quotations error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

// POST /api/quotations: Create a new quotation
export async function POST(req) {
  try {
    const body = await req.json()
    const { customer_id, customer_name, items, discount, notes } = body || {}

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: false, error: 'At least one product item is required' }, { status: 400 })
    }

    // Generate clean unique quotation number: QTN-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.floor(1000 + Math.random() * 9000)
    const quotationNumber = `QTN-${dateStr}-${rand}`

    let totalAmount = 0
    items.forEach((item) => {
      const lineTotal = Number(item.quantity || 1) * Number(item.unit_price || 0)
      totalAmount += lineTotal
    })

    const disc = Number(discount || 0)
    const netAmount = Math.max(0, totalAmount - disc)

    const insertRes = await db.query(
      `INSERT INTO quotations (quotation_number, customer_id, customer_name, total_amount, discount, net_amount, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [
        quotationNumber,
        customer_id ? Number(customer_id) : null,
        customer_name || 'Walk-in Customer',
        totalAmount,
        disc,
        netAmount,
        notes || null,
      ]
    )

    const quotationId = insertRes?.lastInsertRowid || insertRes?.insertId

    for (const item of items) {
      const lineTotal = Number(item.quantity || 1) * Number(item.unit_price || 0)
      await db.query(
        `INSERT INTO quotation_items (quotation_id, product_id, product_name, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          quotationId,
          item.product_id ? Number(item.product_id) : null,
          item.product_name || 'Item',
          Number(item.quantity || 1),
          Number(item.unit_price || 0),
          lineTotal,
        ]
      )
    }

    return NextResponse.json({
      ok: true,
      message: 'Quotation created successfully',
      quotation_id: quotationId,
      quotation_number: quotationNumber,
    })
  } catch (err) {
    console.error('Create quotation error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
