import db from '@/lib/db'
import { NextResponse } from 'next/server'

function clean(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = clean(searchParams.get('search'))
    const params = []
    let searchSql = ''

    if (search) {
      searchSql = 'AND (store_code LIKE ? OR name LIKE ? OR address LIKE ?)'
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    const data = await db.query(
      `SELECT * FROM stores
       WHERE (deleted_at IS NULL OR deleted_at = '') ${searchSql}
       ORDER BY name COLLATE NOCASE, id DESC`,
      params
    )

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Stores could not be loaded.' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const items = Array.isArray(body.items) ? body.items : [body]

    if (!items.length) throw new Error('At least one store is required.')

    const stores = items.map((item) => ({
      store_code: clean(item.store_code),
      name: clean(item.name),
      address: clean(item.address),
      status: clean(item.status, 'Active'),
    }))

    if (stores.some((store) => !store.store_code || !store.name)) {
      throw new Error('Store code and store name are required.')
    }

    const sqlite = db.getConnection()
    const insert = sqlite.prepare(`
      INSERT INTO stores (store_code, name, address, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)

    sqlite.transaction(() => {
      for (const store of stores) {
        insert.run(store.store_code, store.name, store.address, store.status)
      }
    })()

    return NextResponse.json({ success: true, message: `${stores.length} store(s) added.` })
  } catch (error) {
    const duplicate = String(error.message).includes('UNIQUE constraint failed')
    return NextResponse.json(
      { success: false, message: duplicate ? 'Store code already exists.' : error.message || 'Stores could not be added.' },
      { status: 400 }
    )
  }
}

export async function PUT(request) {
  try {
    const body = await request.json()
    const store = {
      id: Number(body.id),
      store_code: clean(body.store_code),
      name: clean(body.name),
      address: clean(body.address),
      status: clean(body.status, 'Active'),
    }

    if (!store.id) throw new Error('Invalid store id.')
    if (!store.store_code || !store.name) throw new Error('Store code and store name are required.')

    await db.query(
      `UPDATE stores
       SET store_code = ?, name = ?, address = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
      [store.store_code, store.name, store.address, store.status, store.id]
    )

    return NextResponse.json({ success: true, message: 'Store updated.' })
  } catch (error) {
    const duplicate = String(error.message).includes('UNIQUE constraint failed')
    return NextResponse.json(
      { success: false, message: duplicate ? 'Store code already exists.' : error.message || 'Store could not be updated.' },
      { status: 400 }
    )
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json()
    if (!Number(id)) throw new Error('Invalid store id.')

    await db.query(
      `UPDATE stores
       SET status = 'Inactive', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [Number(id)]
    )

    return NextResponse.json({ success: true, message: 'Store deleted.' })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Store could not be deleted.' },
      { status: 400 }
    )
  }
}
