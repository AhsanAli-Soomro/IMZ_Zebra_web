import { NextResponse } from 'next/server'
import { decryptPasswordFromVault, VALID_ADMIN_PASSWORDS } from '@/lib/crypto-vault.js'

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const { admin_password, user_codeID } = body || {}

    if (!admin_password || !VALID_ADMIN_PASSWORDS.includes(String(admin_password).trim())) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: Invalid admin password.' },
        { status: 403 }
      )
    }

    if (!user_codeID) {
      return NextResponse.json(
        { ok: false, error: 'user_codeID is required.' },
        { status: 400 }
      )
    }

    const originalPassword = decryptPasswordFromVault(user_codeID, admin_password)

    if (originalPassword === null) {
      return NextResponse.json(
        { ok: false, error: 'Could not decrypt password. Malformed or invalid token.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      original_password: originalPassword,
    })
  } catch (error) {
    console.error('Reveal password error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to reveal password' },
      { status: 500 }
    )
  }
}
