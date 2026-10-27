import db from '@/lib/db'
import { NextResponse } from 'next/server'

function formatDateOnly(value) {
  if (!value) return null

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const date = new Date(value)
  if (isNaN(date.getTime())) return null

  return date.toISOString().split('T')[0]
}

export async function GET() {
  try {
    const data = await db.query(
      'SELECT * FROM users WHERE user_type IN (?, ?)',
      ['Admin', 'Employee']
    )
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('Employees GET error:', err)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const {
      name,
      email,
      password,
      user_type,
      salary,
      dob,
      date_of_joining,
      phone
    } = body

    // 1. Enforce max user limit
    const countRows = await db.query('SELECT count(*) as total FROM users')
    const totalUsers = countRows?.[0]?.total || 0

    let maxUsers = 5
    try {
      const settRows = await db.query("SELECT value FROM app_settings WHERE key = 'license_max_users' LIMIT 1")
      if (settRows && settRows[0]?.value) {
        maxUsers = Number(settRows[0].value) || 5
      }
    } catch {}

    if (maxUsers > 0 && totalUsers >= maxUsers) {
      return NextResponse.json(
        {
          success: false,
          message: `User limit reached (${totalUsers}/${maxUsers} allowed). Please contact Ahsan Ali Soomro to upgrade your license.`
        },
        { status: 403 }
      )
    }

    await db.query(
      `INSERT INTO users (name, email, password, user_type, salary, dob, date_of_joining, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        email,
        password,
        user_type,
        salary,
        formatDateOnly(dob),
        formatDateOnly(date_of_joining),
        phone
      ]
    )

    return NextResponse.json({ success: true, message: 'Employee added' })
  } catch (err) {
    console.error('Employees POST error:', err)
    return NextResponse.json(
      { success: false, message: 'Failed to add employee' },
      { status: 500 }
    )
  }
}

export async function PUT(req) {
  try {
    const body = await req.json()
    const {
      id,
      name,
      email,
      password,
      user_type,
      salary,
      dob,
      date_of_joining,
      phone
    } = body

    await db.query(
      `UPDATE users
       SET name=?, email=?, password=?, user_type=?, salary=?, dob=?, date_of_joining=?, phone=?
       WHERE id=?`,
      [
        name,
        email,
        password,
        user_type,
        salary,
        formatDateOnly(dob),
        formatDateOnly(date_of_joining),
        phone,
        id
      ]
    )

    return NextResponse.json({ success: true, message: 'Employee updated' })
  } catch (err) {
    console.error('Employees PUT error:', err)
    return NextResponse.json(
      { success: false, message: 'Failed to update employee' },
      { status: 500 }
    )
  }
}

export async function DELETE(req) {
  try {
    const { id } = await req.json()
    await db.query('DELETE FROM users WHERE id = ?', [id])
    return NextResponse.json({ success: true, message: 'Employee deleted' })
  } catch (err) {
    console.error('Employees DELETE error:', err)
    return NextResponse.json(
      { success: false, message: 'Failed to delete employee' },
      { status: 500 }
    )
  }
}