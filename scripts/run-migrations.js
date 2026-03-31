import { runMigrations } from '../lib/migrate.js'

try {
  runMigrations()
  console.log('Migration script completed.')
  process.exit(0)
} catch (err) {
  console.error('Migration script failed:', err)
  process.exit(1)
}