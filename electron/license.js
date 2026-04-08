const { app } = require('electron')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const os = require('os')
const { execFileSync } = require('child_process')

const APP_SECRET = 'ahgt45-da87jd-9sdf8a-2345hjk'
const OWNER_KEY_HASH = '867d0594b163f154df848ff6fc482abe87c543d0c82817abe0d5ccc5d2935fd7'

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

function hmac(value) {
  return crypto.createHmac('sha256', APP_SECRET).update(String(value)).digest('hex')
}

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

function getLicensePath() {
  return path.join(app.getPath('userData'), 'license.json')
}

function safeReadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function safeWriteJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

function getWindowsMachineGuid() {
  try {
    const output = execFileSync(
      'reg',
      ['query', 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
      { encoding: 'utf-8' }
    )
    const match = output.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i)
    if (match && match[1]) return match[1].trim()
  } catch {}
  return ''
}

function getMacPlatformUUID() {
  try {
    const output = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], {
      encoding: 'utf-8',
    })
    const match = output.match(/"IOPlatformUUID"\s=\s"([^"]+)"/i)
    if (match && match[1]) return match[1].trim()
  } catch {}
  return ''
}

function getLinuxMachineId() {
  const candidates = ['/etc/machine-id', '/var/lib/dbus/machine-id']

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        return fs.readFileSync(file, 'utf-8').trim()
      }
    } catch {}
  }
  return ''
}

function getPlatformMachineId() {
  const platform = os.platform()

  if (platform === 'win32') return getWindowsMachineGuid()
  if (platform === 'darwin') return getMacPlatformUUID()
  if (platform === 'linux') return getLinuxMachineId()

  return ''
}

function getMachineSource() {
  const machineId = getPlatformMachineId()
  const hostname = os.hostname()
  const platform = os.platform()
  const arch = os.arch()

  return `${machineId}|${hostname}|${platform}|${arch}`
}

function getMachineHash() {
  return sha256(getMachineSource())
}

function makeLicensePayload() {
  return {
    activated: true,
    machineHash: getMachineHash(),
    activatedAt: new Date().toISOString(),
    appName: app.getName(),
  }
}

function signPayload(payload) {
  return hmac(JSON.stringify(payload))
}

function verifyPayload(payload, signature) {
  const expected = signPayload(payload)
  return timingSafeEqual(expected, signature)
}

function isOwnerKeyValid(inputKey) {
  const inputHash = sha256(String(inputKey || '').trim())
  return timingSafeEqual(inputHash, OWNER_KEY_HASH)
}

function readLicenseFile() {
  return safeReadJson(getLicensePath())
}

function isActivated() {
  const file = readLicenseFile()

  if (!file || !file.payload || !file.signature) {
    return {
      ok: false,
      reason: 'missing_license',
    }
  }

  const validSignature = verifyPayload(file.payload, file.signature)
  if (!validSignature) {
    return {
      ok: false,
      reason: 'tampered_license',
    }
  }

  const currentMachineHash = getMachineHash()
  if (file.payload.machineHash !== currentMachineHash) {
    return {
      ok: false,
      reason: 'machine_mismatch',
    }
  }

  return {
    ok: true,
    reason: 'activated',
    payload: file.payload,
  }
}

function activateWithKey(inputKey) {
  if (!isOwnerKeyValid(inputKey)) {
    return {
      ok: false,
      message: 'Invalid activation key',
    }
  }

  const payload = makeLicensePayload()
  const signature = signPayload(payload)

  safeWriteJson(getLicensePath(), {
    payload,
    signature,
  })

  return {
    ok: true,
    message: 'Software activated successfully',
    payload,
  }
}

function clearActivation() {
  const filePath = getLicensePath()
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
  return { ok: true }
}

module.exports = {
  getLicensePath,
  getMachineHash,
  isActivated,
  activateWithKey,
  clearActivation,
  sha256,
}