const NEON_DATABASE_URL =
  process.env.NEON_DATABASE_URL ||
  'postgresql://neondb_owner:npg_wGX0m6fYKLyO@ep-small-smoke-b5a3it1v-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require'

const APP_LICENSE_SECRET = 'hrc-ims-zebra-prod-secret-98234-x89f-2026'

module.exports = {
  NEON_DATABASE_URL,
  APP_LICENSE_SECRET,
}

