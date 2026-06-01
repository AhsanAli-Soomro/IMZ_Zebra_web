// app/api/users/count/route.js

import { NextResponse } from 'next/server'
import db from '../../../../lib/db'

export async function GET() {
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get()

    return NextResponse.json({
      success: true,
      count: row?.count || 0,
    })
  } catch (error) {
    console.error('Users count error:', error)

    return NextResponse.json(
      {
        success: false,
        count: 0,
        message: 'Failed to check users count',
      },
      { status: 500 }
    )
  }
}