import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import db from '@/lib/db.js'
import { APP_LICENSE_SECRET, OWNER_KEY_HASH } from '@/lib/license-config.js'

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

function getMacPlatformUUID() {
  try {
    const { execSync } = require('child_process')
    const out = execSync('ioreg -rd1 -c IOPlatformExpertDevice', { encoding: 'utf-8' })
    const match = out.match(/"IOPlatformUUID"\s=\s"([^"]+)"/i)
    if (match && match[1]) return match[1].trim()
  } catch {}
  return ''
}

function getWindowsMachineGuid() {
  try {
    const { execSync } = require('child_process')
    const out = execSync(
      'reg query HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid',
      { encoding: 'utf-8' }
    )
    const match = out.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i)
    if (match && match[1]) return match[1].trim()
  } catch {}
  return ''
}

function getLinuxMachineId() {
  const candidates = ['/etc/machine-id', '/var/lib/dbus/machine-id']
  for (const f of candidates) {
    try {
      if (fs.existsSync(f)) return fs.readFileSync(f, 'utf-8').trim()
    } catch {}
  }
  return ''
}

function getPlatformMachineId() {
  if (process.platform === 'win32') return getWindowsMachineGuid()
  if (process.platform === 'darwin') return getMacPlatformUUID()
  if (process.platform === 'linux') return getLinuxMachineId()
  return ''
}

function getPrimaryMacAddress() {
  try {
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          return iface.mac.toUpperCase()
        }
      }
    }
  } catch {}
  return '00:00:00:00:00:00'
}

function getSystemInfo() {
  const machineId = getPlatformMachineId() || 'SYS-' + os.hostname()
  const macAddress = getPrimaryMacAddress()
  const hostname = os.hostname() || 'Unknown-PC'
  const osInfo = `${os.type()} ${os.release()} (${os.arch()})`
  const raw = crypto
    .createHash('sha256')
    .update(`ZBR_KEY_${machineId}_${macAddress}_ZEBRA`)
    .digest('hex')
    .toUpperCase()
  const activationKey = `ZBR-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`

  return {
    machineId,
    macAddress,
    hostname,
    osInfo,
    activationKey,
  }
}

function getCandidateLicenseDirs() {
  const osAppSupport =
    process.platform === 'win32'
      ? (process.env.APPDATA ? path.join(process.env.APPDATA, 'zebra-ims') : null)
      : (process.platform === 'darwin'
          ? path.join(os.homedir(), 'Library', 'Application Support', 'zebra-ims')
          : path.join(os.homedir(), '.config', 'zebra-ims'))

  return [
    process.env.APP_USER_DATA_PATH,
    osAppSupport,
    path.join(os.homedir(), '.zebra-ims'),
    path.join(process.cwd(), 'database'),
  ].filter(Boolean)
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

    const candidateDirs = getCandidateLicenseDirs()

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
                  return NextResponse.json({
                    ok: false,
                    active: false,
                    reason: 'expired',
                    machineInfo: getSystemInfo(),
                  })
                }
              }
              return NextResponse.json({
                ok: true,
                active: true,
                customer_name: parsed.payload.customerName || 'Licensed Business',
                allowed_tabs: parsed.payload.allowedTabs || 'ALL',
                machineInfo: getSystemInfo(),
              })
            }
          }
        } catch {}
      }
    }

    return NextResponse.json({
      ok: false,
      active: false,
      reason: 'missing_or_invalid_license',
      machineInfo: getSystemInfo(),
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      active: false,
      error: err.message,
      machineInfo: getSystemInfo(),
    }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const { key } = body || {}

    if (!key) {
      return NextResponse.json({ ok: false, message: 'Activation Key or Master Key is required' }, { status: 400 })
    }

    const inputHash = crypto.createHash('sha256').update(String(key).trim()).digest('hex')
    const isMaster = timingSafeEqual(inputHash, OWNER_KEY_HASH)

    if (isMaster) {
      const sysInfo = getSystemInfo()
      const payload = {
        machineId: sysInfo.machineId,
        macAddress: sysInfo.macAddress,
        hostname: sysInfo.hostname,
        customerName: 'Licensed Business (Owner Master Key)',
        issuedAt: new Date().toISOString(),
        expiresAt: null,
        allowedTabs: 'ALL',
        maxDevices: 10,
      }
      const signature = crypto
        .createHmac('sha256', APP_LICENSE_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex')

      const candidateDirs = getCandidateLicenseDirs()
      const targetDir = candidateDirs[0] || path.join(process.cwd(), 'database')
      fs.mkdirSync(targetDir, { recursive: true })
      fs.writeFileSync(
        path.join(targetDir, 'license.json'),
        JSON.stringify({ payload, signature }, null, 2),
        'utf-8'
      )

      return NextResponse.json({
        ok: true,
        active: true,
        message: 'Software activated successfully with Master Key!',
      })
    }

    return NextResponse.json({ ok: false, message: 'Invalid Master Key or Activation Key' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ ok: false, message: err.message || 'Activation failed' }, { status: 500 })
  }
}

