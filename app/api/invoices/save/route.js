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
    html
  } = await req.json()

  try {
    // 1. Save invoice data to the database
    await db.query(`
      INSERT INTO bills (
        invoice_no, customer_name, contact, address,
        items, subtotal, discount_percent, discount_amount, net_total, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      invoice_no,
      customer_name,
      contact,
      address,
      JSON.stringify(items),
      subtotal,
      discount_percent,
      discount_amount,
      net_total
    ])

    // 2. Generate invoice PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new', // Use 'new' for Puppeteer v20+
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
      message: 'Server error. Failed to save invoice.'
    }, { status: 500 })
  }
}
