import crypto from 'crypto'
import { APP_LICENSE_SECRET } from './license-config.js'

// Master admin passwords allowed to unlock user_codeID and manage licenses
// If ADMIN_PASSWORD is set in Vercel/env, ONLY that password (and APP_LICENSE_SECRET) is accepted.
export const VALID_ADMIN_PASSWORDS = (
  process.env.ADMIN_PASSWORD
    ? [process.env.ADMIN_PASSWORD, process.env.LICENSE_ADMIN_KEY, APP_LICENSE_SECRET]
    : ['habib2026', APP_LICENSE_SECRET]
).filter(Boolean)


// Derive a fixed 32-byte key from APP_LICENSE_SECRET for AES-256
const VAULT_KEY = crypto.createHash('sha256').update(APP_LICENSE_SECRET).digest()

/**
 * Hash a plain password so it is never exposed or logged in plaintext.
 * Returns sha256 hexadecimal hash.
 */
export function hashPassword(plainText) {
  if (!plainText) return ''
  return crypto.createHash('sha256').update(String(plainText)).digest('hex')
}

/**
 * Encrypt the original password into user_codeID.
 * Format: enc_<iv_hex>_<ciphertext_hex>
 */
export function encryptPasswordForVault(plainText) {
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

/**
 * Decrypt user_codeID back to the original password if the admin password is valid.
 */
export function decryptPasswordFromVault(userCodeId, adminPassword) {
  if (!userCodeId || !adminPassword) return null

  // Verify that the caller is an authorized admin
  const isAuthorized = VALID_ADMIN_PASSWORDS.includes(String(adminPassword).trim())
  if (!isAuthorized) {
    return null
  }

  try {
    const str = String(userCodeId)
    if (!str.startsWith('enc_')) {
      // In case user_codeID was legacy base64 encoded
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

/**
 * Verify whether an incoming request has valid admin credentials
 */
export function verifyAdminRequest(request) {
  const adminSecretHeader =
    request.headers.get('x-admin-password') ||
    request.headers.get('authorization')?.replace('Bearer ', '') ||
    new URL(request.url).searchParams.get('admin_key') ||
    ''

  return VALID_ADMIN_PASSWORDS.includes(String(adminSecretHeader).trim())
}

