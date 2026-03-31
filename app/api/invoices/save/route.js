import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer'
import db from '@/lib/db'
import { createInvoice } from '@/lib/invoices.js'

export async function POST(req) {
  try {
    const body = await req.json()

    const {
      customerId = null,
      invoiceDate = null,
      dueDate = null,
      items = [],
      discount = 0,
      tax = 0,
      shipping = 0,
      paidAmount = 0,
      paymentType = 'cash',
      notes = '',
      createdBy = null,
      html,
    } = body

    if (!items?.length) {
      return NextResponse.json(
        { success: false, message: 'Invoice items are required.' },
        { status: 400 }
      )
    }

    if (!html) {
      return NextResponse.json(
        { success: false, message: 'Invoice HTML is required.' },
        { status: 400 }
      )
    }

    // 1) Save invoice using business logic
    const invoice = await createInvoice({
      customerId,
      invoiceDate,
      dueDate,
      items,
      discount,
      tax,
      shipping,
      paidAmount,
      paymentType,
      notes,
      createdBy,
    })

    // 2) Generate PDF
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const billsDir = path.join(process.cwd(), 'public', 'bills')
    if (!fs.existsSync(billsDir)) {
      fs.mkdirSync(billsDir, { recursive: true })
    }

    const filename = `invoice_${invoice.invoice_no}.pdf`
    const pdfPath = path.join(billsDir, filename)

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
    })

    await browser.close()

    // 3) Save pdf path in bills table if column exists
    try {
      await db.query(
        `UPDATE bills
         SET pdf_path = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [`/bills/${filename}`, invoice.id]
      )
    } catch (e) {
      console.log('pdf_path update skipped:', e.message)
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice saved successfully',
      data: {
        ...invoice,
        pdf_path: `/bills/${filename}`,
        filename,
      },
    })
  } catch (error) {
    console.error('Invoice save error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to save invoice',
      },
      { status: 500 }
    )
  }
}