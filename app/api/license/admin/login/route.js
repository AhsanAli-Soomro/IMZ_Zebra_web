import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/crypto-vault'

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const password = body?.password || ''

    if (!password) {
      return NextResponse.json({ ok: false, error: 'Password is required' }, { status: 400 })
    }

    const mockReq = {
      headers: {
        get: (headerName) => {
          if (headerName && headerName.toLowerCase() === 'x-admin-password') {
            return String(password).trim()
          }
          return null
        },
      },
      url: 'https://localhost/api/license/admin/login',
    }

    const isValid = verifyAdminRequest(mockReq)

    if (!isValid) {
      return NextResponse.json(
        { ok: false, error: 'Invalid admin password. Please try again.' },
        { status: 401 }
      )
    }

    return NextResponse.json({ ok: true, message: 'Authenticated successfully' })
  } catch (error) {
    console.error('Admin login verification error:', error)
    return NextResponse.json({ ok: false, error: 'Server error during authentication' }, { status: 500 })
  }
}
