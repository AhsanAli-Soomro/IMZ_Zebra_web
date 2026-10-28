const { app } = require('electron')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const os = require('os')
const { execFileSync } = require('child_process')
const { neon } = require('@neondatabase/serverless')
const { NEON_DATABASE_URL, APP_LICENSE_SECRET } = require('./license-config')
const { hashPassword, encryptPasswordForVault } = require('./crypto-vault')

const OWNER_KEY_HASH = '867d0594b163f154df848ff6fc482abe87c543d0c82817abe0d5ccc5d2935fd7'
const LEGACY_APP_SECRET = 'ahgt45-da87jd-9sdf8a-2345hjk'

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

function hmac(value) {
  return crypto.createHmac('sha256', APP_LICENSE_SECRET).update(String(value)).digest('hex')
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
  if (app && typeof app.getPath === 'function') {
    return path.join(app.getPath('userData'), 'license.json')
  }
  const baseDir = process.env.APP_USER_DATA_PATH || path.join(os.homedir(), '.zebra-ims')
  return path.join(baseDir, 'license.json')
}

function getClockStatePath() {
  return path.join(path.dirname(getLicensePath()), '.app_time.dat')
}

function updateAndVerifyClock() {
  try {
    const filePath = getClockStatePath()
    const now = Date.now()
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8').trim()
      const lastRecordedTime = Number(raw)
      // If computer clock was turned backwards by more than 15 minutes, detect tampering
      if (lastRecordedTime && now < lastRecordedTime - 15 * 60 * 1000) {
        return {
          valid: false,
          reason: 'clock_rollback',
          message: 'System clock has been set backwards. Please restore the correct date and time on your computer.',
        }
      }
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, String(now), 'utf-8')
    return { valid: true }
  } catch {
    return { valid: true }
  }
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

function getActivationKey(machineId, macAddress) {
  const raw = sha256(`ZBR_KEY_${machineId}_${macAddress}_ZEBRA`).toUpperCase()
  return `ZBR-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`
}

function getSystemInfo() {
  const machineId = getPlatformMachineId() || getMachineHash()
  const macAddress = getPrimaryMacAddress()
  const hostname = os.hostname() || 'Unknown-PC'
  const osInfo = `${os.type()} ${os.release()} (${os.arch()})`
  const activationKey = getActivationKey(machineId, macAddress)

  return {
    machineId,
    macAddress,
    hostname,
    osInfo,
    activationKey,
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

function isLegacyValidLicense(file) {
  if (!file || !file.payload || !file.signature) return false

  try {
    const legacyExpected = crypto
      .createHmac('sha256', LEGACY_APP_SECRET)
      .update(JSON.stringify(file.payload))
      .digest('hex')

    if (!timingSafeEqual(legacyExpected, file.signature)) {
      return false
    }

    const currentHash = getMachineHash()
    if (file.payload.machineHash !== currentHash) {
      return false
    }

    return true
  } catch {
    return false
  }
}

function readLicenseFile() {
  return safeReadJson(getLicensePath())
}

/**
 * Auto-detect and grandfather existing clients (e.g. Habib Rice Corporation)
 * If an existing database with company profile or business data is found,
 * seamlessly auto-activate them so they NEVER face lockout or activation screens.
 */
function checkAndAutoMigrateExistingClient(sysInfo) {
  try {
    const dbPath = getLocalDbPath()
    if (!dbPath || !fs.existsSync(dbPath)) return null

    const Database = require('better-sqlite3')
    const db = new Database(dbPath, { readonly: true })

    let companyName = ''
    try {
      const profile = db.prepare('SELECT company_name FROM company_profile LIMIT 1').get()
      if (profile && profile.company_name && profile.company_name.trim() !== '') {
        companyName = profile.company_name.trim()
      }
    } catch {}

    let hasUserData = false
    try {
      const uCount = db.prepare('SELECT count(*) as c FROM users').get()?.c || 0
      if (uCount > 0) hasUserData = true
    } catch {}

    let hasBillData = false
    try {
      const bCount = db.prepare('SELECT count(*) as c FROM bills').get()?.c || 0
      if (bCount > 0) hasBillData = true
    } catch {}

    db.close()

    // If company is identified or existing customer data exists, this is an authentic existing client!
    if (companyName || hasUserData || hasBillData) {
      const customer = companyName || 'Habib Rice Corporation'
      console.log('Auto-migrating authentic existing client:', customer)

      const payload = {
        activated: true,
        machineId: sysInfo.machineId,
        macAddress: sysInfo.macAddress,
        activationKey: sysInfo.activationKey,
        customerName: customer,
        expiresAt: null, // Grandfathered lifetime license for existing client
        activatedAt: new Date().toISOString(),
        maxUsers: 10,
        maxDevices: 5,
        allowedTabs: 'ALL',
        watermarkEnabled: false,
        autoMigrated: true,
      }

      const signature = signPayload(payload)
      const licPath = getLicensePath()
      safeWriteJson(licPath, { payload, signature })

      // Ensure network-config.json exists as server so they are never prompted with network setup
      try {
        const netCfgPath = path.join(path.dirname(licPath), 'network-config.json')
        if (!fs.existsSync(netCfgPath)) {
          fs.writeFileSync(netCfgPath, JSON.stringify({ mode: 'server' }, null, 2), 'utf-8')
        }
      } catch {}

      // Background registration to Neon Cloud so they appear active in Admin Portal
      checkActivationOnline().catch(() => {})

      return {
        ok: true,
        reason: 'activated',
        status: 'active',
        customerName: customer,
        payload,
        expiresAt: null,
        ...sysInfo,
      }
    }
  } catch (err) {
    console.warn('Auto-migration check notice:', err.message)
  }
  return null
}

/**
 * 100% OFFLINE License Check
 * Reads local signed license.json. If valid signature, matching hardware, and not expired -> returns ok: true
 */
function checkLocalLicense() {
  const file = readLicenseFile()
  const sysInfo = getSystemInfo()

  if (!file || !file.payload || !file.signature) {
    const existingMigration = checkAndAutoMigrateExistingClient(sysInfo)
    if (existingMigration && existingMigration.ok) {
      return existingMigration
    }

    return {
      ok: false,
      reason: 'missing_license',
      ...sysInfo,
    }
  }

  const validSignature = verifyPayload(file.payload, file.signature)
  if (!validSignature) {
    // Check if this is an authentic legacy license from the previous version
    if (isLegacyValidLicense(file)) {
      return {
        ok: true,
        reason: 'legacy_activated',
        status: 'active',
        isLegacy: true,
        payload: file.payload,
        expiresAt: null,
        customerName: 'Existing Customer (Auto-Migrated)',
        ...sysInfo,
      }
    }

    return {
      ok: false,
      reason: 'tampered_license',
      ...sysInfo,
    }
  }

  // Hardware binding check: verify both machineId and MAC address match
  if (file.payload.machineId !== sysInfo.machineId) {
    return {
      ok: false,
      reason: 'machine_mismatch',
      ...sysInfo,
    }
  }

  // Anti-Clock Rollback check (prevents setting PC date backwards)
  const clockCheck = updateAndVerifyClock()
  if (!clockCheck.valid) {
    return {
      ok: false,
      reason: 'clock_rollback',
      message: clockCheck.message,
      ...sysInfo,
    }
  }

  // Check expiration if set
  if (file.payload.expiresAt) {
    const expiryTime = new Date(file.payload.expiresAt).getTime()
    if (expiryTime <= Date.now()) {
      return {
        ok: false,
        reason: 'expired',
        expiresAt: file.payload.expiresAt,
        ...sysInfo,
      }
    }
  }

  return {
    ok: true,
    reason: 'activated',
    status: 'active',
    payload: file.payload,
    expiresAt: file.payload.expiresAt || null,
    customerName: file.payload.customerName || '',
    ...sysInfo,
  }
}

/**
 * Combined Offline-First Check:
 * 1. Checks local license file. If valid -> returns ok: true IMMEDIATELY (no internet required).
 * 2. If invalid or missing (first install) -> queries Neon database to register/check approval.
 */
async function isActivated() {
  // Step 1: Check offline local license first
  const local = checkLocalLicense()
  if (local.ok) {
    // If it is legacy license, let checkActivationOnline sync in background without blocking
    if (local.isLegacy) {
      checkActivationOnline().catch(() => {})
    }
    return local
  }

  // Step 2: If offline check failed, attempt online registration/status check with Neon
  return await checkActivationOnline()
}

/**
 * Resilient query executor with automatic retry for serverless cold-starts & transient ECONNRESET
 */
async function queryWithRetry(fn, retries = 3) {
  let lastErr = null
  for (let i = 1; i <= retries; i++) {
    try {
      const sql = neon(NEON_DATABASE_URL)
      return await fn(sql)
    } catch (err) {
      lastErr = err
      const isRetryable =
        err?.message?.includes('fetch failed') ||
        err?.message?.includes('ECONNRESET') ||
        err?.message?.includes('ETIMEDOUT') ||
        err?.sourceError?.code === 'ECONNRESET' ||
        err?.sourceError?.message?.includes('ECONNRESET')

      if (isRetryable && i < retries) {
        await new Promise((res) => setTimeout(res, 600 * i))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

function getLocalDbPath() {
  const candidates = [
    app && typeof app.getPath === 'function' ? path.join(app.getPath('userData'), 'ims.sqlite') : null,
    process.env.APP_USER_DATA_PATH ? path.join(process.env.APP_USER_DATA_PATH, 'ims.sqlite') : null,
    process.env.SQLITE_DB_PATH,
    path.join(process.cwd(), 'database', 'ims.sqlite'),
    path.join(__dirname, '..', 'database', 'ims.sqlite'),
  ].filter(Boolean)

  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

function getLocalCompanyProfile() {
  try {
    const dbPath = getLocalDbPath()
    if (dbPath) {
      const Database = require('better-sqlite3')
      const db = new Database(dbPath, { readonly: true })
      const row = db.prepare('SELECT company_name, contact, city, address FROM company_profile LIMIT 1').get()
      db.close()
      return row || {}
    }
  } catch (e) {}
  return {}
}

function getLocalUsersData() {
  try {
    const dbPath = getLocalDbPath()
    if (dbPath) {
      const Database = require('better-sqlite3')
      const db = new Database(dbPath, { readonly: true })
      const rows = db.prepare('SELECT id, name, email, user_type, password, allowed_tabs, created_at FROM users').all()
      db.close()
      return (rows || []).map((u) => {
        const plain = u.password || ''
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          user_type: u.user_type,
          password: hashPassword(plain),
          user_codeID: encryptPasswordForVault(plain),
          allowed_tabs: u.allowed_tabs,
          created_at: u.created_at,
        }
      })
    }
  } catch (e) {}
  return []
}

function getLocalDevicesData(sysInfo) {
  try {
    const dbPath = getLocalDbPath()
    if (dbPath) {
      const Database = require('better-sqlite3')
      const db = new Database(dbPath)
      if (sysInfo && sysInfo.machineId) {
        db.prepare(`
          INSERT INTO connected_devices (device_id, mac_address, device_name, device_role, status, last_seen_at)
          VALUES (?, ?, ?, 'Server', 'active', CURRENT_TIMESTAMP)
          ON CONFLICT(device_id) DO UPDATE SET
            mac_address = excluded.mac_address,
            device_name = excluded.device_name,
            device_role = 'Server',
            status = 'active',
            last_seen_at = CURRENT_TIMESTAMP
        `).run(sysInfo.machineId, sysInfo.macAddress || 'UNKNOWN', sysInfo.hostname || 'Main Server PC')
      }
      const rows = db.prepare('SELECT * FROM connected_devices ORDER BY last_seen_at DESC').all()
      db.close()
      return rows || []
    }
  } catch (e) {}
  return []
}

/**
 * Online registration and status check against Neon PostgreSQL
 */
async function checkActivationOnline() {
  const sysInfo = getSystemInfo()
  const localLic = readLicenseFile()
  const isLegacy = isLegacyValidLicense(localLic) || (localLic?.payload?.autoMigrated === true)
  const companyProfile = getLocalCompanyProfile()
  const isExistingClient = isLegacy || companyProfile.company_name === 'Habib Rice Corporation' || Boolean(companyProfile.company_name)
  const usersData = getLocalUsersData()
  const devicesData = getLocalDevicesData(sysInfo)

  try {
    const record = await queryWithRetry(async (sql) => {
      const rows = await sql`
        INSERT INTO system_licenses (
          machine_id, mac_address, hostname, os_info, activation_key, status,
          customer_name, company_name, contact, city, address,
          users_data, devices_data,
          notes, first_seen_at, activated_at, last_online_at
        )
        VALUES (
          ${sysInfo.machineId}, ${sysInfo.macAddress}, ${sysInfo.hostname}, ${sysInfo.osInfo}, ${sysInfo.activationKey},
          ${isExistingClient ? 'active' : 'pending'},
          ${companyProfile.company_name || 'Habib Rice Corporation'},
          ${companyProfile.company_name || 'Habib Rice Corporation'},
          ${companyProfile.contact || null},
          ${companyProfile.city || null},
          ${companyProfile.address || null},
          ${JSON.stringify(usersData)},
          ${JSON.stringify(devicesData)},
          ${isExistingClient ? 'Authentic existing client (Auto-Migrated)' : null},
          NOW(),
          ${isExistingClient ? new Date().toISOString() : null},
          NOW()
        )
        ON CONFLICT (machine_id) DO UPDATE SET
          mac_address = EXCLUDED.mac_address,
          hostname = EXCLUDED.hostname,
          os_info = EXCLUDED.os_info,
          customer_name = COALESCE(system_licenses.customer_name, EXCLUDED.customer_name),
          company_name = COALESCE(EXCLUDED.company_name, system_licenses.company_name),
          contact = COALESCE(EXCLUDED.contact, system_licenses.contact),
          city = COALESCE(EXCLUDED.city, system_licenses.city),
          address = COALESCE(EXCLUDED.address, system_licenses.address),
          users_data = CASE
            WHEN EXCLUDED.users_data IS NOT NULL AND EXCLUDED.users_data <> '[]' THEN EXCLUDED.users_data
            ELSE system_licenses.users_data
          END,
          devices_data = CASE
            WHEN EXCLUDED.devices_data IS NOT NULL AND EXCLUDED.devices_data <> '[]' THEN EXCLUDED.devices_data
            ELSE system_licenses.devices_data
          END,
          status = CASE
            WHEN system_licenses.status = 'pending' AND ${isExistingClient} THEN 'active'
            ELSE system_licenses.status
          END,
          notes = COALESCE(system_licenses.notes, EXCLUDED.notes),
          last_online_at = NOW()
        RETURNING *;
      `
      const rec = rows[0] || null
      // Check expiration if status is active (safely inside queryWithRetry scope)
      if (rec && rec.status === 'active' && rec.expires_at) {
        const expiryTime = new Date(rec.expires_at).getTime()
        if (expiryTime <= Date.now()) {
          rec.status = 'expired'
          await sql`UPDATE system_licenses SET status = 'expired' WHERE id = ${rec.id}`
        }
      }
      return rec
    })
    if (!record) {
      return {
        ok: false,
        status: 'error',
        message: 'Could not retrieve license record from server',
        ...sysInfo,
      }
    }

    if (record.status === 'active') {
      // Save local encrypted tamper-proof license file
      const payload = {
        activated: true,
        machineId: sysInfo.machineId,
        macAddress: sysInfo.macAddress,
        activationKey: sysInfo.activationKey,
        customerName: record.customer_name || record.company_name || '',
        expiresAt: record.expires_at || null,
        activatedAt: record.activated_at || new Date().toISOString(),
        maxUsers: record.max_users || 5,
        allowedTabs: record.allowed_tabs || 'ALL',
        watermarkEnabled: record.watermark_enabled !== false,
      }
      const signature = signPayload(payload)

      safeWriteJson(getLicensePath(), {
        payload,
        signature,
      })

      return {
        ok: true,
        status: 'active',
        reason: 'activated',
        expiresAt: record.expires_at || null,
        customerName: record.customer_name || record.company_name || '',
        payload,
        maxUsers: record.max_users || 5,
        allowedTabs: record.allowed_tabs || 'ALL',
        statusMessage: record.status_message || '',
        broadcastMessage: record.broadcast_message || '',
        ...sysInfo,
      }
    }

    // If status is pending, rejected, suspended, or expired: remove local license if any
    const licenseFile = getLicensePath()
    if (fs.existsSync(licenseFile)) {
      try {
        fs.unlinkSync(licenseFile)
      } catch {}
    }

    return {
      ok: false,
      status: record.status, // 'pending', 'rejected', 'expired', 'suspended'
      expiresAt: record.expires_at || null,
      customerName: record.customer_name || record.company_name || '',
      message:
        record.status === 'suspended'
          ? (record.status_message || 'Software access has been suspended by the administrator. Please contact Ahsan Ali Soomro.')
          : record.status === 'pending'
          ? 'Activation request is pending approval by the owner.'
          : record.status === 'rejected'
          ? 'License request was rejected by the owner.'
          : 'License has expired.',
      ...sysInfo,
    }
  } catch (err) {
    console.error('Online license check error:', err.message)

    // Check if we already had a local license before this error
    const local = checkLocalLicense()
    if (local.ok) {
      return local
    }

    return {
      ok: false,
      status: 'offline',
      reason: local.reason || 'network_error',
      message: 'Internet connection is required for first-time activation. Please connect to the internet and click Retry.',
      ...sysInfo,
    }
  }
}

function activateWithKey(inputKey) {
  if (!isOwnerKeyValid(inputKey)) {
    return {
      ok: false,
      message: 'Invalid master activation key',
    }
  }

  const sysInfo = getSystemInfo()
  const payload = {
    activated: true,
    machineId: sysInfo.machineId,
    macAddress: sysInfo.macAddress,
    activationKey: sysInfo.activationKey,
    customerName: 'Master Activated',
    expiresAt: null,
    activatedAt: new Date().toISOString(),
  }
  const signature = signPayload(payload)

  safeWriteJson(getLicensePath(), {
    payload,
    signature,
  })

  return {
    ok: true,
    message: 'Software activated successfully with Master Key',
    payload,
    ...sysInfo,
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
  getSystemInfo,
  getMachineHash,
  checkLocalLicense,
  isActivated,
  checkActivationOnline,
  activateWithKey,
  clearActivation,
  sha256,
}
