import db from '@/lib/db'
import { saveImageFile } from '@/lib/saveImage'
import { NextResponse } from 'next/server'

export async function GET() {
  const data = await db.query('SELECT * FROM stocks ORDER BY purchase_date DESC')
  return NextResponse.json({ success: true, data })
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
    supplier_name: formData.get('supplier_name'),
    purchase_date: formData.get('purchase_date'),
    status: formData.get('status'),
    image_path
  }

  await db.query(`
    INSERT INTO stocks (item_code, item_name, category, quantity, purchase_price, selling_price, supplier_name, purchase_date, status, image_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, Object.values(stock))

  return NextResponse.json({ success: true, message: 'Stock item added' })
}

export async function PUT(req) {
  const formData = await req.formData()

  const image = formData.get('image')
  let image_path = formData.get('existing_image')

  if (image && typeof image === 'object') {
    image_path = await saveImageFile(image)
  }

  const stock = {
    id: formData.get('id'),
    item_code: formData.get('item_code'),
    item_name: formData.get('item_name'),
    category: formData.get('category'),
    quantity: formData.get('quantity'),
    purchase_price: formData.get('purchase_price'),
    selling_price: formData.get('selling_price'),
    supplier_name: formData.get('supplier_name'),
    purchase_date: formData.get('purchase_date'),
    status: formData.get('status'),
    image_path
  }

  await db.query(`
    UPDATE stocks SET item_code=?, item_name=?, category=?, quantity=?, purchase_price=?, selling_price=?, supplier_name=?, purchase_date=?, status=?, image_path=?
    WHERE id=?
  `, [
    stock.item_code, stock.item_name, stock.category, stock.quantity,
    stock.purchase_price, stock.selling_price, stock.supplier_name,
    stock.purchase_date, stock.status, stock.image_path, stock.id
  ])

  return NextResponse.json({ success: true, message: 'Stock item updated' })
}

export async function DELETE(req) {
  const { id } = await req.json()
  await db.query('DELETE FROM stocks WHERE id = ?', [id])
  return NextResponse.json({ success: true, message: 'Stock item deleted' })
}
