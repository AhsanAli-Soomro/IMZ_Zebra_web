import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const paginate = searchParams.get('paginate') === '1'
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.max(1, Math.min(Number(searchParams.get('limit')) || 50, 200))
    const search = String(searchParams.get('search') || '').trim()
    const params = []
    let searchSql = ''
    if (search) {
      searchSql = 'AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR address LIKE ?)'
      const like = `%${search}%`
      params.push(like, like, like, like)
    }
    const pagingSql = paginate ? `LIMIT ${limit} OFFSET ${(page - 1) * limit}` : ''
    const data = await db.query(`
      SELECT *
      FROM customers
      WHERE (deleted_at IS NULL OR deleted_at = '')
      ${searchSql}
      ORDER BY created_at DESC
      ${pagingSql}
    `, params)

    let pagination = null
    if (paginate) {
      const count = await db.query(`SELECT COUNT(*) AS total FROM customers WHERE (deleted_at IS NULL OR deleted_at = '') ${searchSql}`, params)
      const total = Number(count[0]?.total || 0)
      pagination = { page, limit, total, totalPages: Math.ceil(total / limit) }
    }
    return NextResponse.json({ success: true, data, pagination })
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
    const items = Array.isArray(body.items) ? body.items : [body]
    const sqlite = db.getConnection()

    sqlite.transaction(() => {
      const insert = sqlite.prepare(
        `INSERT INTO customers (name, email, phone, address, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
      items.forEach(({ name, email, phone, address, status }) => {
        if (!String(name || '').trim()) throw new Error('Customer name is required.')
        insert.run(name, email || '', phone || '', address || '', status || 'Active')
      })
    })()

    return NextResponse.json({ success: true, message: `${items.length} customer(s) added` })
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
