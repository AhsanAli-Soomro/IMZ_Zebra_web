import db from '@/lib/db'
import { saveImageFile } from '@/lib/saveImage'
import { NextResponse } from 'next/server'

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clean(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

export async function GET() {
  try {
    const rows = await db.query(`
      SELECT
        s.*,
        COALESCE(purchased.total_purchased_qty, 0) AS total_purchased_qty,
        COALESCE(sold.total_sold_qty, 0) AS total_sold_qty
      FROM stocks s
      LEFT JOIN (
        SELECT stock_id, SUM(qty) AS total_purchased_qty
        FROM stock_movements
        WHERE movement_type IN ('purchase_in', 'opening_stock', 'adjustment_in')
        GROUP BY stock_id
      ) purchased ON purchased.stock_id = s.id
      LEFT JOIN (
        SELECT stock_id, SUM(qty) AS total_sold_qty
        FROM stock_movements
        WHERE movement_type IN ('sale_out', 'purchase_return_out', 'adjustment_out', 'damage_out')
        GROUP BY stock_id
      ) sold ON sold.stock_id = s.id
      WHERE (s.deleted_at IS NULL OR s.deleted_at = '')
      ORDER BY date(s.purchase_date) DESC, s.id DESC
    `)

    const data = rows.map((row) => {
      const qty =
        Number(row.qty || 0) > 0
          ? Number(row.qty || 0)
          : Number(row.quantity || 0)

      return {
        ...row,
        qty,
        quantity: qty,
        available_stock: qty,
        current_stock_balance: qty,
        total_purchased_qty: Number(row.total_purchased_qty || 0),
        total_sold_qty: Number(row.total_sold_qty || 0),
        purchase_price: Number(row.purchase_price || 0),
        sale_price: Number(row.sale_price || row.selling_price || 0),
        selling_price: Number(row.selling_price || row.sale_price || 0),
        weight: Number(row.weight || 0),
        weight_unit: row.weight_unit || 'kg',
        name: row.name || row.item_name || row.product_name,
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load stocks' },
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData()
    const image = formData.get('image')
    const image_path = image && image.name ? await saveImageFile(image) : null
    const itemName =
      clean(formData.get('item_name')) ||
      clean(formData.get('item_code')) ||
      `Product-${Date.now()}`
    const quantity = toNumber(formData.get('quantity'), 0)
    const entryDate = clean(formData.get('purchase_date'), new Date().toISOString().slice(0, 10))
    const purchasePrice = toNumber(formData.get('purchase_price'), 0)
    const sellingPrice = toNumber(formData.get('selling_price'), 0)
    const weight = toNumber(formData.get('weight'), 0)

    if (quantity < 0) {
      throw new Error('Valid quantity required hai')
    }

    const sqlite = db.getConnection()
    const result = sqlite.transaction(() => {
      const insert = sqlite.prepare(`
        INSERT INTO stocks (
          item_code, item_name, category, quantity, qty, purchase_price,
          selling_price, sale_price, expire_date, supplier_name, purchase_date,
          status, image_path, weight, weight_unit, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        clean(formData.get('item_code'), `STK-${Date.now()}`),
        itemName,
        clean(formData.get('category')),
        quantity,
        quantity,
        purchasePrice,
        sellingPrice,
        sellingPrice,
        clean(formData.get('expire_date')) || null,
        clean(formData.get('supplier_name')),
        entryDate,
        clean(formData.get('status'), 'Active'),
        image_path,
        weight,
        clean(formData.get('weight_unit'), 'kg')
      )

      const stockId = Number(insert.lastInsertRowid)

      if (quantity > 0) {
        sqlite.prepare(`
          INSERT INTO stock_movements (
            stock_id, movement_type, movement_date, reference_type, reference_id, qty, notes, created_at
          )
          VALUES (?, 'opening_stock', ?, 'stock', ?, ?, 'Manual stock entry', CURRENT_TIMESTAMP)
        `).run(stockId, entryDate, stockId, quantity)
      }

      return stockId
    })()

    return NextResponse.json({ success: true, message: 'Stock item added', data: { id: result } })
  } catch (error) {
    console.error('Add stock error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to add stock item',
      },
      { status: 500 }
    )
  }
}

export async function PUT(req) {
  try {
    const formData = await req.formData()
    const image = formData.get('image')
    let image_path = formData.get('existing_image')

    if (image && image.name) {
      image_path = await saveImageFile(image)
    }

    const stock = {
      id: Number(formData.get('id')),
      item_code: clean(formData.get('item_code'), `STK-${Date.now()}`),
      item_name:
        clean(formData.get('item_name')) ||
        clean(formData.get('item_code')) ||
        `Product-${Date.now()}`,
      category: clean(formData.get('category')),
      quantity: toNumber(formData.get('quantity'), 0),
      weight: toNumber(formData.get('weight'), 0),
      weight_unit: clean(formData.get('weight_unit'), 'kg'),
      purchase_price: toNumber(formData.get('purchase_price'), 0),
      selling_price: toNumber(formData.get('selling_price'), 0),
      expire_date: clean(formData.get('expire_date')) || null,
      supplier_name: clean(formData.get('supplier_name')),
      purchase_date: clean(formData.get('purchase_date'), new Date().toISOString().slice(0, 10)),
      status: clean(formData.get('status'), 'Active'),
      image_path,
    }

    if (!stock.id) throw new Error('Invalid stock id')
    if (stock.quantity < 0) {
      throw new Error('Valid quantity required hai')
    }

    const sqlite = db.getConnection()
    sqlite.transaction(() => {
      const existing = sqlite.prepare('SELECT quantity FROM stocks WHERE id = ?').get(stock.id)
      if (!existing) throw new Error('Stock not found')

      const previousQty = Number(existing.quantity || 0)
      const diff = stock.quantity - previousQty

      sqlite.prepare(`
        UPDATE stocks
        SET item_code = ?, item_name = ?, category = ?, quantity = ?, qty = ?,
            purchase_price = ?, selling_price = ?, sale_price = ?, expire_date = ?,
            supplier_name = ?, purchase_date = ?, status = ?, image_path = ?,
            weight = ?, weight_unit = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        stock.item_code,
        stock.item_name,
        stock.category,
        stock.quantity,
        stock.quantity,
        stock.purchase_price,
        stock.selling_price,
        stock.selling_price,
        stock.expire_date,
        stock.supplier_name,
        stock.purchase_date,
        stock.status,
        stock.image_path,
        stock.weight,
        stock.weight_unit,
        stock.id
      )

      if (diff !== 0) {
        sqlite.prepare(`
          INSERT INTO stock_movements (
            stock_id, movement_type, movement_date, reference_type, reference_id, qty, notes, created_at
          )
          VALUES (?, ?, ?, 'stock', ?, ?, 'Manual stock adjustment', CURRENT_TIMESTAMP)
        `).run(
          stock.id,
          diff > 0 ? 'adjustment_in' : 'adjustment_out',
          stock.purchase_date,
          stock.id,
          Math.abs(diff)
        )
      }
    })()

    return NextResponse.json({ success: true, message: 'Stock item updated' })
  } catch (error) {
    console.error('Update stock error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to update stock item',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(req) {
  const { id } = await req.json()
  await db.query(
    'UPDATE stocks SET deleted_at = CURRENT_TIMESTAMP, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['Inactive', id]
  )
  return NextResponse.json({ success: true, message: 'Stock item deleted' })
}
