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
    const data = await db.query('SELECT * FROM users ORDER BY id ASC')
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
      phone,
      allowed_tabs,
    } = body

    // 1. Enforce max user limit
    const countRows = await db.query('SELECT count(*) as total FROM users')
    const totalUsers = countRows?.[0]?.total || 0

    let maxUsers = 5
    try {
      const settRows = await db.query(
        "SELECT setting_value FROM app_settings WHERE setting_key = 'license_max_users' LIMIT 1"
      )
      if (settRows && settRows[0]?.setting_value) {
        maxUsers = Number(settRows[0].setting_value) || 5
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

    const tabsVal = allowed_tabs
      ? (typeof allowed_tabs === 'string' ? allowed_tabs : JSON.stringify(allowed_tabs))
      : (user_type === 'Admin' ? 'ALL' : 'ALL')

    await db.query(
      `INSERT INTO users (name, email, password, user_type, salary, dob, date_of_joining, phone, allowed_tabs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        email,
        password,
        user_type || 'Employee',
        salary ? Number(salary) : 0,
        formatDateOnly(dob),
        formatDateOnly(date_of_joining),
        phone,
        tabsVal,
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

    if (body.allowed_tabs !== undefined) {
      await db.query('UPDATE users SET allowed_tabs = ? WHERE id = ?', [
        typeof body.allowed_tabs === 'string' ? body.allowed_tabs : JSON.stringify(body.allowed_tabs),
        id,
      ])
    }

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