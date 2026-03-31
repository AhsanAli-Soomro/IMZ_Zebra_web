import db from '@/lib/db'
import { saveImageFile } from '@/lib/saveImage'
import { NextResponse } from 'next/server'


export async function GET() {
  try {
    const rows = await db.query('SELECT * FROM stocks ORDER BY purchase_date DESC')

    const data = rows.map((row) => {
      const qty =
        Number(row.qty || 0) > 0
          ? Number(row.qty || 0)
          : Number(row.quantity || 0)

      const salePrice =
        Number(row.sale_price || 0) > 0
          ? Number(row.sale_price || 0)
          : Number(row.selling_price || 0)

      return {
        ...row,
        qty,
        quantity: qty,
        sale_price: salePrice,
        selling_price: salePrice,
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
  const formData = await req.formData()

  const image = formData.get('image')
  const image_path = image ? await saveImageFile(image) : null

  const stock = {
    item_code: formData.get('item_code'),
    item_name: formData.get('item_name'),
    category: formData.get('category'),
    quantity: formData.get('quantity'),
    purchase_price: formData.get('purchase_price'),
    selling_price: formData.get('selling_price'),
    expire_date: formData.get('expire_date'),
    supplier_name: formData.get('supplier_name'),
    purchase_date: formData.get('purchase_date'),
    status: formData.get('status'),
    image_path
  }

await db.query(`
  INSERT INTO stocks (
    item_code, item_name, category, quantity, qty, purchase_price,
    selling_price, sale_price, expire_date, supplier_name, purchase_date,
    status, image_path
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`, [
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
  stock.image_path
])

  return NextResponse.json({ success: true, message: 'Stock item added' })
}

export async function PUT(req) {
  const formData = await req.formData()

  const image = formData.get('image')
  let image_path = formData.get('existing_image')
  if (image && image.name) {
    image_path = await saveImageFile(image)
  }

  const stock = {
    id: formData.get('id'),
    item_code: formData.get('item_code'),
    item_name: formData.get('item_name'),
    category: formData.get('category'),
    quantity: formData.get('quantity'),
    purchase_price: formData.get('purchase_price'),
    expire_date: formData.get('expire_date'),
    selling_price: formData.get('selling_price'),
    supplier_name: formData.get('supplier_name'),
    purchase_date: formData.get('purchase_date'),
    status: formData.get('status'),
    image_path
  }

await db.query(`
  UPDATE stocks
  SET item_code = ?, item_name = ?, category = ?, quantity = ?, qty = ?, purchase_price = ?,
      selling_price = ?, sale_price = ?, expire_date = ?, supplier_name = ?, purchase_date = ?,
      status = ?, image_path = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`, [
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
  stock.id
])

  return NextResponse.json({ success: true, message: 'Stock item updated' })
}

export async function DELETE(req) {
  const { id } = await req.json()
  await db.query('DELETE FROM stocks WHERE id = ?', [id])
  return NextResponse.json({ success: true, message: 'Stock item deleted' })
}
