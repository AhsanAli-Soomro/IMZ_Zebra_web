import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET() {
  try {
    const rows = await db.query(`
      SELECT invoice_no
      FROM bills
      WHERE invoice_no IS NOT NULL AND invoice_no != ''
      ORDER BY id DESC
      LIMIT 1
    `)

    const lastInvoice = rows[0]?.invoice_no || 'INV-00000'

    return NextResponse.json({
      success: true,
      lastInvoice,
    })
  } catch (error) {
    console.error('Last invoice error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to load last invoice',
      },
      { status: 500 }
    )
  }
}