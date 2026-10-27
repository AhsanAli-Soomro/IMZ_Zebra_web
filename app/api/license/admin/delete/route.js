import { NextResponse } from 'next/server'
import { deleteLicense } from '@/lib/license-db'

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 })
    }

    const deleted = await deleteLicense(Number(id))
    return NextResponse.json({ ok: true, data: deleted })
  } catch (error) {
    console.error('License delete error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to delete license' },
      { status: 500 }
    )
  }
}

