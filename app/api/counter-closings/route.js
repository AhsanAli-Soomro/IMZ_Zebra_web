import { NextResponse } from 'next/server'
import db from '@/lib/db.js'

const number = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

function localToday() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

async function expectedCashOn(date) {
  const rows = await db.query(
    `SELECT COALESCE(SUM(CASE WHEN tx_type = 'in' THEN amount ELSE -amount END), 0) AS amount
     FROM cash_transactions
     WHERE deleted_at IS NULL
       AND LOWER(COALESCE(payment_method, 'cash')) = 'cash'
       AND date(tx_date) <= date(?)`,
    [date]
  )
  return number(rows[0]?.amount)
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const minAmount = searchParams.get('minAmount') || ''
    const maxAmount = searchParams.get('maxAmount') || ''
    const conditions = []
    const params = []

    if (dateFrom) { conditions.push('date(cc.closing_date) >= date(?)'); params.push(dateFrom) }
    if (dateTo) { conditions.push('date(cc.closing_date) <= date(?)'); params.push(dateTo) }
    if (status === 'matched') conditions.push('ABS(cc.variance) < 0.005')
    if (status === 'short') conditions.push('cc.variance < -0.005')
    if (status === 'excess') conditions.push('cc.variance > 0.005')
    if (minAmount !== '') { conditions.push('cc.physical_amount >= ?'); params.push(number(minAmount)) }
    if (maxAmount !== '') { conditions.push('cc.physical_amount <= ?'); params.push(number(maxAmount)) }
    if (search) {
      conditions.push(`(cc.notes LIKE ? OR COALESCE(u.name, u.full_name, '') LIKE ?)`)
      params.push(`%${search}%`, `%${search}%`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = await db.query(
      `SELECT cc.*, COALESCE(u.name, u.full_name, 'Unknown') AS closed_by_name
       FROM counter_closings cc
       LEFT JOIN users u ON u.id = cc.created_by
       ${where}
       ORDER BY date(cc.closing_date) DESC, cc.id DESC`, params
    )

    const totals = rows.reduce((sum, row) => ({
      physical: sum.physical + number(row.physical_amount),
      expected: sum.expected + number(row.expected_amount),
      variance: sum.variance + number(row.variance),
    }), { physical: 0, expected: 0, variance: 0 })

    const previewDate = searchParams.get('previewDate')
    return NextResponse.json({
      success: true,
      data: rows,
      summary: { ...totals, count: rows.length },
      previewExpected: validDate(previewDate) ? await expectedCashOn(previewDate) : null,
    })
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to load Cash in Hand records' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    if (!validDate(body.closing_date)) {
      return NextResponse.json({ success: false, message: 'A valid closing date is required.' }, { status: 400 })
    }
    if (body.closing_date > localToday()) {
      return NextResponse.json({ success: false, message: 'A future date cannot be closed.' }, { status: 400 })
    }
    const physical = Number(body.physical_amount)
    if (!Number.isFinite(physical) || physical < 0) {
      return NextResponse.json({ success: false, message: 'Counter amount must be zero or greater.' }, { status: 400 })
    }
    const existing = await db.query('SELECT id FROM counter_closings WHERE closing_date = ?', [body.closing_date])
    if (existing.length) {
      return NextResponse.json({ success: false, message: 'This date is already closed. Use Edit to update it.' }, { status: 409 })
    }
    const expected = await expectedCashOn(body.closing_date)
    const result = await db.query(
      `INSERT INTO counter_closings
       (closing_date, physical_amount, expected_amount, variance, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [body.closing_date, physical, expected, physical - expected, String(body.notes || '').trim() || null, body.created_by || null]
    )
    return NextResponse.json({ success: true, id: result.insertId, message: 'Cash in Hand saved successfully.' }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to save Cash in Hand' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const body = await request.json()
    const id = Number(body.id)
    const physical = Number(body.physical_amount)
    if (!id || !validDate(body.closing_date) || !Number.isFinite(physical) || physical < 0) {
      return NextResponse.json({ success: false, message: 'Valid closing details are required.' }, { status: 400 })
    }
    if (body.closing_date > localToday()) {
      return NextResponse.json({ success: false, message: 'A future date cannot be closed.' }, { status: 400 })
    }
    const duplicate = await db.query('SELECT id FROM counter_closings WHERE closing_date = ? AND id <> ?', [body.closing_date, id])
    if (duplicate.length) {
      return NextResponse.json({ success: false, message: 'Another closing already exists for this date.' }, { status: 409 })
    }
    const expected = await expectedCashOn(body.closing_date)
    const result = await db.query(
      `UPDATE counter_closings SET closing_date = ?, physical_amount = ?, expected_amount = ?,
       variance = ?, notes = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [body.closing_date, physical, expected, physical - expected, String(body.notes || '').trim() || null, body.updated_by || null, id]
    )
    if (!result.changes) return NextResponse.json({ success: false, message: 'Closing record not found.' }, { status: 404 })
    return NextResponse.json({ success: true, message: 'Cash in Hand updated successfully.' })
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to update Cash in Hand' }, { status: 500 })
  }
}
