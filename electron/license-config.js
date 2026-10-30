const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL || ''

const LICENSE_SERVER_URL =
  process.env.LICENSE_SERVER_URL ||
  process.env.NEXT_PUBLIC_LICENSE_API_URL ||
  ''

const APP_LICENSE_SECRET =
  process.env.APP_LICENSE_SECRET || 'hrc-ims-zebra-prod-secret-98234-x89f-2026'

module.exports = {
  NEON_DATABASE_URL,
  LICENSE_SERVER_URL,
  APP_LICENSE_SECRET,
}


