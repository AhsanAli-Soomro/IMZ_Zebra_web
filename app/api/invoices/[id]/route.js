import { NextResponse } from 'next/server'
import { deleteInvoice, getInvoiceById } from '@/lib/invoices.js'

export async function GET(_request, context) {
  try {
    const params = await context.params
    const id = Number(params.id)

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Invalid invoice id' },
        { status: 400 }
      )
    }

    const invoice = await getInvoiceById(id)

    if (!invoice) {
      return NextResponse.json(
        { success: false, message: 'Invoice not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: invoice,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load invoice' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request, context) {
  try {
    const params = await context.params
    const id = Number(params.id)

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Invalid invoice id' },
        { status: 400 }
      )
    }

    const result = await deleteInvoice(id)

    return NextResponse.json({
      success: true,
      message: 'Invoice deleted successfully',
      data: result,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to delete invoice' },
      { status: 500 }
    )
  }
}