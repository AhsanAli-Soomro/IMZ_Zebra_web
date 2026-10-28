import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'inventory'

    if (type === 'inventory') {
      const rows = await db.query(`
        SELECT 
          p.id as Product_ID,
          p.name as Item_Name,
          COALESCE(c.name, 'General') as Category,
          COALESCE(s.name, 'Main Store') as Store,
          p.quantity as Current_Quantity,
          COALESCE(p.unit, 'Units') as Unit,
          p.purchase_price as Cost_Price,
          p.sale_price as Sale_Price,
          (COALESCE(p.quantity, 0) * COALESCE(p.sale_price, 0)) as Total_Value
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN stores s ON p.store_id = s.id
        WHERE p.status = 'active'
        ORDER BY p.id ASC
      `)
      return NextResponse.json({ ok: true, type: 'inventory', data: rows || [] })
    }

    if (type === 'customers') {
      const rows = await db.query(`
        SELECT 
          id as Customer_ID,
          name as Customer_Name,
          phone as Phone,
          city as City,
          opening_balance as Opening_Balance,
          balance as Net_Current_Balance
        FROM customers
        ORDER BY balance DESC
      `)
      return NextResponse.json({ ok: true, type: 'customers', data: rows || [] })
    }

    if (type === 'suppliers') {
      const rows = await db.query(`
        SELECT 
          id as Supplier_ID,
          name as Supplier_Name,
          phone as Phone,
          city as City,
          opening_balance as Opening_Balance,
          balance as Net_Payable_Balance
        FROM suppliers
        ORDER BY balance DESC
      `)
      return NextResponse.json({ ok: true, type: 'suppliers', data: rows || [] })
    }

    return NextResponse.json({ ok: false, error: 'Invalid export type' }, { status: 400 })
  } catch (err) {
    console.error('Excel sync export error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

// POST /api/excel-sync: Bulk Stock Import
export async function POST(req) {
  try {
    const body = await req.json()
    const { items } = body || {}

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: false, error: 'No items provided for import' }, { status: 400 })
    }

    let addedCount = 0
    let updatedCount = 0

    for (const row of items) {
      const name = String(row.Item_Name || row.name || '').trim()
      if (!name) continue

      const qty = Number(row.Quantity || row.quantity || 0)
      const cost = Number(row.Cost_Price || row.purchase_price || 0)
      const sale = Number(row.Sale_Price || row.sale_price || 0)
      const unit = String(row.Unit || row.unit || 'Bags').trim()

      const existing = await db.query('SELECT id, quantity FROM products WHERE LOWER(name) = LOWER(?) LIMIT 1', [name])

      if (existing && existing.length > 0) {
        await db.query(
          `UPDATE products 
           SET quantity = quantity + ?, 
               purchase_price = CASE WHEN ? > 0 THEN ? ELSE purchase_price END,
               sale_price = CASE WHEN ? > 0 THEN ? ELSE sale_price END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [qty, cost, cost, sale, sale, existing[0].id]
        )
        updatedCount++
      } else {
        await db.query(
          `INSERT INTO products (name, quantity, purchase_price, sale_price, unit, status)
           VALUES (?, ?, ?, ?, ?, 'active')`,
          [name, qty, cost, sale, unit]
        )
        addedCount++
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Bulk import complete: ${addedCount} new items created, ${updatedCount} existing items updated!`,
      added_count: addedCount,
      updated_count: updatedCount,
    })
  } catch (err) {
    console.error('Excel bulk import error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
