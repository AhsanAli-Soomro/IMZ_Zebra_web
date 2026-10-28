import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { verifyAdminRequest } from '@/lib/crypto-vault'

// GET /api/admin/gemini-settings: Fetch current Gemini API settings
export async function GET(req) {
  try {
    if (!verifyAdminRequest(req)) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: Admin authentication required.' },
        { status: 401 }
      )
    }

    const rows = await db.query(`
      SELECT setting_key, setting_value 
      FROM app_settings 
      WHERE setting_key IN (
        'gemini_api_key', 
        'gemini_key_name', 
        'gemini_project_name', 
        'gemini_project_number', 
        'gemini_enabled'
      )
    `)

    const map = (rows || []).reduce((acc, r) => {
      acc[r.setting_key] = r.setting_value
      return acc
    }, {})

    return NextResponse.json({
      ok: true,
      data: {
        apiKey: map.gemini_api_key || '',
        keyName: map.gemini_key_name || 'Gemini API Key For IMS',
        projectName: map.gemini_project_name || 'projects/90016021959',
        projectNumber: map.gemini_project_number || '90016021959',
        enabled: map.gemini_enabled !== 'false' && map.gemini_enabled !== '0',
      },
    })
  } catch (err) {
    console.error('Gemini settings fetch error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

// POST /api/admin/gemini-settings: Save or test Gemini API settings
export async function POST(req) {
  try {
    if (!verifyAdminRequest(req)) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: Admin authentication required.' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { action, apiKey, keyName, projectName, projectNumber, enabled } = body || {}

    // Action 1: Test Connection
    if (action === 'test') {
      const testKey = (apiKey || '').trim()
      if (!testKey) {
        return NextResponse.json(
          { ok: false, error: 'API key is required to test connection.' },
          { status: 400 }
        )
      }

      try {
        let testRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${encodeURIComponent(testKey)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': testKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Respond with the word OK if connected.' }] }],
              generationConfig: {
                thinkingConfig: {
                  thinkingBudget: 0,
                },
              },
            }),
            signal: AbortSignal.timeout(12000),
          }
        )

        // Fallback to 3.8 if 3.5 had transient error
        if (testRes.status !== 200) {
          testRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(testKey)}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': testKey,
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: 'Respond with the word OK if connected.' }] }],
                generationConfig: {
                  thinkingConfig: {
                    thinkingBudget: 0,
                  },
                },
              }),
              signal: AbortSignal.timeout(12000),
            }
          )
        }

        const testData = await testRes.json()

        if (testData?.error) {
          return NextResponse.json({
            ok: false,
            error: testData.error.message || 'Google Gemini rejected the API key.',
            details: testData.error,
          })
        }

        const reply = testData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Connected'
        return NextResponse.json({
          ok: true,
          message: 'Google Gemini API is responding successfully!',
          reply: reply.trim(),
        })
      } catch (testErr) {
        return NextResponse.json({
          ok: false,
          error: `Connection test failed: ${testErr.message}`,
        })
      }
    }

    // Action 2: Save Settings
    const upsertSetting = async (key, val) => {
      await db.query(`
        INSERT INTO app_settings (setting_key, setting_value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(setting_key) DO UPDATE SET
          setting_value = excluded.setting_value,
          updated_at = CURRENT_TIMESTAMP
      `, [key, String(val ?? '')])
    }

    if (apiKey !== undefined) await upsertSetting('gemini_api_key', apiKey.trim())
    if (keyName !== undefined) await upsertSetting('gemini_key_name', keyName.trim())
    if (projectName !== undefined) await upsertSetting('gemini_project_name', projectName.trim())
    if (projectNumber !== undefined) await upsertSetting('gemini_project_number', projectNumber.trim())
    if (enabled !== undefined) await upsertSetting('gemini_enabled', enabled ? 'true' : 'false')

    return NextResponse.json({
      ok: true,
      message: 'Google Gemini API settings saved successfully in database!',
    })
  } catch (err) {
    console.error('Gemini settings save error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
