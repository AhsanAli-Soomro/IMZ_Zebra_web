import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const paginate = searchParams.get('paginate') === '1'
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.max(1, Math.min(Number(searchParams.get('limit')) || 50, 200))
  const search = String(searchParams.get('search') || '').trim()
  const params = []
  let searchSql = ''
  if (search) {
    searchSql = 'AND (name LIKE ? OR company_name LIKE ? OR email LIKE ? OR phone LIKE ? OR address LIKE ?)'
    const like = `%${search}%`
    params.push(like, like, like, like, like)
  }
  const pagingSql = paginate ? `LIMIT ${limit} OFFSET ${(page - 1) * limit}` : ''
  const data = await db.query(`
    SELECT *
    FROM suppliers
    WHERE (deleted_at IS NULL OR deleted_at = '')
    ${searchSql}
    ORDER BY created_at DESC
    ${pagingSql}
  `, params)
  let pagination = null
  if (paginate) {
    const count = await db.query(`SELECT COUNT(*) AS total FROM suppliers WHERE (deleted_at IS NULL OR deleted_at = '') ${searchSql}`, params)
    const total = Number(count[0]?.total || 0)
    pagination = { page, limit, total, totalPages: Math.ceil(total / limit) }
  }
  return NextResponse.json({ success: true, data, pagination })
}

export async function POST(req) {
  const body = await req.json()
  const items = Array.isArray(body.items) ? body.items : [body]
  const sqlite = db.getConnection()

  sqlite.transaction(() => {
    const insert = sqlite.prepare(
      `INSERT INTO suppliers (name, company_name, email, phone, address, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    items.forEach(({ name, company_name, email, phone, address, status }) => {
      if (!String(name || '').trim()) throw new Error('Supplier name is required.')
      insert.run(name, company_name || '', email || '', phone || '', address || '', status || 'Active')
    })
  })()

  return NextResponse.json({ success: true, message: `${items.length} supplier(s) added` })
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
