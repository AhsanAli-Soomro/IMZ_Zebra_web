import { NextResponse } from 'next/server'
import { createInvoice, listInvoices } from '@/lib/invoices.js'

export async function POST(request) {
  try {
    const body = await request.json()

    const result = await createInvoice({
      customerId: body.customerId || null,
      invoiceDate: body.invoiceDate || null,
      dueDate: body.dueDate || null,
      items: body.items || [],
      discount: body.discount || 0,
      tax: body.tax || 0,
      shipping: body.shipping || 0,
      paidAmount: body.paidAmount || 0,
      paymentType: body.paymentType || 'cash',
      notes: body.notes || '',
      createdBy: body.createdBy || null,
    })

    return NextResponse.json({
      success: true,
      message: 'Invoice created successfully',
      data: result,
    })
  } catch (error) {
    console.error('Create invoice error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to create invoice',
      },
      { status: 500 }
    )
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)

    const rows = await listInvoices({
      search: searchParams.get('search') || '',
      customerId: searchParams.get('customerId') || null,
      paymentStatus: searchParams.get('paymentStatus') || '',
      paymentType: searchParams.get('paymentType') || '',
      dateFrom: searchParams.get('dateFrom') || '',
      dateTo: searchParams.get('dateTo') || '',
      limit: searchParams.get('limit') || 50,
    })

    return NextResponse.json({
      success: true,
      data: rows,
    })
  } catch (error) {
    console.error('List invoices error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to load invoices',
      },
      { status: 500 }
    )
  }
}