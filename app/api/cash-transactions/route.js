import { NextResponse } from 'next/server'
import db from '@/lib/db.js'

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)

    const txType = searchParams.get('txType') || ''
    const category = searchParams.get('category') || ''
    const paymentMethod = searchParams.get('paymentMethod') || ''
    const sourceOfPayment = searchParams.get('sourceOfPayment') || ''
    const referenceType = searchParams.get('referenceType') || ''
    const referenceId = searchParams.get('referenceId') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const minAmount = searchParams.get('minAmount') || ''
    const maxAmount = searchParams.get('maxAmount') || ''
    const search = searchParams.get('search') || ''
    const limit = Math.max(1, Math.min(toNumber(searchParams.get('limit'), 500), 1000))

    const conditions = []
    const params = []

    if (txType) {
      conditions.push('ct.tx_type = ?')
      params.push(txType)
    }

    if (category) {
      conditions.push('ct.category = ?')
      params.push(category)
    }

    if (paymentMethod) {
      conditions.push('ct.payment_method = ?')
      params.push(paymentMethod)
    }

    if (sourceOfPayment) {
      conditions.push('ct.source_of_payment = ?')
      params.push(sourceOfPayment)
    }

    if (referenceType) {
      conditions.push('ct.reference_type = ?')
      params.push(referenceType)
    }

    if (referenceId) {
      conditions.push('ct.reference_id = ?')
      params.push(referenceId)
    }

    if (dateFrom) {
      conditions.push('date(ct.tx_date) >= date(?)')
      params.push(dateFrom)
    }

    if (dateTo) {
      conditions.push('date(ct.tx_date) <= date(?)')
      params.push(dateTo)
    }

    if (minAmount) {
      conditions.push('ct.amount >= ?')
      params.push(toNumber(minAmount))
    }

    if (maxAmount) {
      conditions.push('ct.amount <= ?')
      params.push(toNumber(maxAmount))
    }

    if (search) {
      conditions.push(`(
        ct.category LIKE ?
        OR ct.payment_method LIKE ?
        OR ct.source_of_payment LIKE ?
        OR ct.description LIKE ?
        OR ct.notes LIKE ?
        OR ct.reference_type LIKE ?
      )`)
      const like = `%${search}%`
      params.push(like, like, like, like, like, like)
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const rows = await db.query(
      `SELECT
        ct.id,
        ct.tx_date,
        ct.tx_type,
        ct.category,
        ct.reference_type,
        ct.reference_id,
        ct.amount,
        ct.payment_method,
        ct.source_of_payment,
        ct.description,
        ct.notes,
        ct.created_by,
        ct.created_at
       FROM cash_transactions ct
       ${whereSql}
       ORDER BY date(ct.tx_date) DESC, ct.id DESC
       LIMIT ${limit}`,
      params
    )

    return NextResponse.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        amount: toNumber(row.amount),
      })),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to load cash transactions',
      },
      { status: 500 }
    )
  }
}