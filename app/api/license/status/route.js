import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import db from '@/lib/db.js'
import { APP_LICENSE_SECRET } from '@/lib/license-config.js'

function timingSafeEqual(a, b) {
  try {
    const aBuf = Buffer.from(String(a))
    const bBuf = Buffer.from(String(b))
    if (aBuf.length !== bBuf.length) return false
    return crypto.timingSafeEqual(aBuf, bBuf)
  } catch {
    return false
  }
}

function verifyPayload(payload, signature) {
  try {
    const expected = crypto
      .createHmac('sha256', APP_LICENSE_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex')
    return timingSafeEqual(expected, signature)
  } catch {
    return false
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const deviceId = searchParams.get('device_id')
    if (deviceId) {
      try {
        const devRows = await db.query('SELECT status FROM connected_devices WHERE device_id = ? LIMIT 1', [deviceId])
        if (devRows && devRows[0]?.status === 'blocked') {
          return NextResponse.json({
            ok: false,
            active: false,
            blocked: true,
            reason: 'device_blocked',
            message: 'This computer has been blocked by the Administrator.'
          })
        }
      } catch {}
    }

    const candidateDirs = [
      process.env.APP_USER_DATA_PATH,
      path.join(os.homedir(), '.zebra-ims'),
      path.join(process.cwd(), 'database'),
    ].filter(Boolean)

    for (const dir of candidateDirs) {
      const licFile = path.join(dir, 'license.json')
      if (fs.existsSync(licFile)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(licFile, 'utf8'))
          if (parsed?.payload && parsed?.signature) {
            if (verifyPayload(parsed.payload, parsed.signature)) {
              if (parsed.payload.expiresAt) {
                const expiry = new Date(parsed.payload.expiresAt).getTime()
                if (expiry <= Date.now()) {
                  return NextResponse.json({ ok: false, active: false, reason: 'expired' })
                }
              }
              return NextResponse.json({
                ok: true,
                active: true,
                customer_name: parsed.payload.customerName || 'Licensed Business',
                allowed_tabs: parsed.payload.allowedTabs || 'ALL',
              })
            }
          }
        } catch {}
      }
    }

    return NextResponse.json({ ok: false, active: false, reason: 'missing_or_invalid_license' })
  } catch (err) {
    return NextResponse.json({ ok: false, active: false, error: err.message }, { status: 500 })
  }
}

