import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/crypto-vault'

export async function POST(req) {
  try {
    if (!verifyAdminRequest(req)) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: Admin authentication required.' },
        { status: 401 }
      )
    }

    const { api_key } = await req.json()
    if (!api_key || !api_key.trim()) {
      return NextResponse.json({ ok: false, error: 'API key is required' }, { status: 400 })
    }

    const cleanKey = api_key.trim()
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-flash-latest',
    ]

    let lastError = null

    for (const model of candidateModels) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': cleanKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Ping' }] }],
              generationConfig: {
                maxOutputTokens: 10,
              },
            }),
            signal: AbortSignal.timeout(10000),
          }
        )

        if (res.ok) {
          return NextResponse.json({ ok: true, model })
        }

        const errData = await res.json().catch(() => ({}))
        lastError = errData?.error?.message || `Status ${res.status}`
      } catch (callErr) {
        lastError = callErr.message
      }
    }

    return NextResponse.json({
      ok: false,
      error: lastError || 'Google rejected this key. Please check your Gemini API key in Google AI Studio.',
    }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
