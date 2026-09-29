import db from '@/lib/db'
import { NextResponse } from 'next/server'

// ======================
// GET ALL EXPENSES
// ======================
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = String(searchParams.get('date') || '').trim()
    const rows = await db.query(`
      SELECT *
      FROM expenses
      ${date ? 'WHERE date(expense_date) = date(?)' : ''}
      ORDER BY expense_date DESC, id DESC
    `, date ? [date] : [])

    return NextResponse.json({
      success: true,
      data: rows,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to load expenses',
      },
      { status: 500 }
    )
  }
}

// ======================
// ADD EXPENSE
// ======================
export async function POST(req) {
  try {
    const body = await req.json()
    const items = Array.isArray(body.items) ? body.items : [body]
    const sqlite = db.getConnection()

    sqlite.transaction(() => {
      const insert = sqlite.prepare(`
      INSERT INTO expenses (
        expense_date,
        category,
        amount,
        payment_method,
        notes,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `)
      items.forEach((item) => {
        const amount = Number(item.amount || 0)
        if (!item.expense_date) throw new Error('Expense date is required.')
        if (!(amount > 0)) throw new Error('Expense amount must be greater than zero.')
        insert.run(item.expense_date, '', amount, '', item.notes || '', item.created_by || null)
      })
    })()

    return NextResponse.json({
      success: true,
      count: items.length,
      message: 'Expense added successfully.',
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: 500 }
    )
  }
}

// ======================
// UPDATE EXPENSE
// ======================
export async function PUT(req) {
  try {
    const body = await req.json()

    await db.query(
      `
      UPDATE expenses
      SET
        expense_date = ?,
        category = ?,
        amount = ?,
        payment_method = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [
        body.expense_date,
        body.category,
        Number(body.amount || 0),
        body.payment_method,
        body.notes,
        body.id,
      ]
    )

    return NextResponse.json({
      success: true,
      message: 'Expense updated successfully.',
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: 500 }
    )
  }
}

// ======================
// DELETE EXPENSE
// ======================
export async function DELETE(req) {
  try {
    const { id } = await req.json()

    await db.query('DELETE FROM expenses WHERE id = ?', [id])

    return NextResponse.json({
      success: true,
      message: 'Expense deleted successfully.',
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: 500 }
    )
  }
}
