import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer'
import db from '@/lib/db'

export async function POST(req) {
  const {
    invoice_no,
    customer_name,
    contact,
    address,
    items,
    subtotal,
    discount_percent,
    discount_amount,
    net_total,
    amount_paid,
    payment_date,
    html
  } = await req.json()

  // ✅ Basic validation
  if (!invoice_no || !customer_name || !contact || !items || !html) {
    return NextResponse.json({
      success: false,
      message: 'Missing required invoice data.'
    }, { status: 400 })
  }

  // ✅ Safe parsing of numbers
  const parsedSubtotal = parseFloat(subtotal ?? 0)
  const parsedDiscountPercent = parseFloat(discount_percent ?? 0)
  const parsedDiscountAmount = parseFloat(discount_amount ?? 0)
  const parsedNetTotal = parseFloat(net_total ?? 0)
  const parsedPaidAmount = parseFloat(amount_paid ?? parsedNetTotal)
  const parsedBalance = parseFloat((parsedNetTotal - parsedPaidAmount).toFixed(2))
  const parsedPaymentDate = payment_date ? new Date(payment_date) : new Date()

  try {
    // ✅ 1. Generate invoice PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const billsDir = path.join(process.cwd(), 'public/bills')
    if (!fs.existsSync(billsDir)) fs.mkdirSync(billsDir, { recursive: true })

    const filename = `invoice_${invoice_no}.pdf`
    const pdfPath = path.join(billsDir, filename)

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true
    })

    await browser.close()

    // ✅ 2. Save to database
    await db.query(`
  INSERT INTO bills (
    invoice_no, customer_name, contact, address,
    items, subtotal, discount_percent, discount_amount, net_total,
    amount_paid, payment_date, pdf_path, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
`, [
      invoice_no,
      customer_name,
      contact,
      address,
      JSON.stringify(items),
      parsedSubtotal,
      parsedDiscountPercent,
      parsedDiscountAmount,
      parsedNetTotal,
      parsedPaidAmount,
      parsedPaymentDate,
      `/bills/${filename}`
    ])


    return NextResponse.json({
      success: true,
      message: 'Invoice saved successfully',
      filename,
      invoice_no
    })

  } catch (error) {
    console.error('Invoice save error:', error)
    return NextResponse.json({
      success: false,
      message: error.message  // Return the real error
    }, { status: 500 })
  }
}
