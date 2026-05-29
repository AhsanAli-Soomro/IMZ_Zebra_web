import { runMigrations } from '../lib/migrate.js'

const dbPath = process.env.SQLITE_DB_PATH || process.argv[2]
const schemaPath = process.env.SQLITE_SCHEMA_PATH || process.argv[3]

try {
  runMigrations(dbPath, schemaPath)
  console.log('Migration script completed.')
  process.exit(0)
} catch (err) {
  console.error('Migration script failed:', err)
  process.exit(1)
}