const crypto = require('crypto')
const { APP_LICENSE_SECRET } = require('./license-config.js')

const VALID_ADMIN_PASSWORDS = [
  '123456',
  'admin123',
  'habib2026',
  'hireside',
  APP_LICENSE_SECRET,
]

const VAULT_KEY = crypto.createHash('sha256').update(APP_LICENSE_SECRET).digest()

function hashPassword(plainText) {
  if (!plainText) return ''
  return crypto.createHash('sha256').update(String(plainText)).digest('hex')
}

function encryptPasswordForVault(plainText) {
  if (!plainText) return ''
  try {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', VAULT_KEY, iv)
    let encrypted = cipher.update(String(plainText), 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return `enc_${iv.toString('hex')}_${encrypted}`
  } catch (err) {
    console.error('Vault encryption failed:', err.message)
    return ''
  }
}

function decryptPasswordFromVault(userCodeId, adminPassword) {
  if (!userCodeId || !adminPassword) return null

  const isAuthorized = VALID_ADMIN_PASSWORDS.includes(String(adminPassword).trim())
  if (!isAuthorized) {
    return null
  }

  try {
    const str = String(userCodeId)
    if (!str.startsWith('enc_')) {
      return Buffer.from(str, 'base64').toString('utf8')
    }

    const parts = str.split('_')
    if (parts.length !== 3) return null

    const iv = Buffer.from(parts[1], 'hex')
    const encryptedText = parts[2]
    const decipher = crypto.createDecipheriv('aes-256-cbc', VAULT_KEY, iv)
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    console.error('Vault decryption failed:', err.message)
    return null
  }
}

module.exports = {
  VALID_ADMIN_PASSWORDS,
  hashPassword,
  encryptPasswordForVault,
  decryptPasswordFromVault,
}
