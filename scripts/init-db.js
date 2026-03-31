import fs from 'fs'
import Database from 'better-sqlite3'
import { getDatabasePath, getSchemaPath } from '../lib/db-path.js'

const dbPath = getDatabasePath()
const schemaPath = getSchemaPath()

const db = new Database(dbPath)
const schema = fs.readFileSync(schemaPath, 'utf8')

db.exec(schema)
db.close()

console.log('Database initialized successfully.')
console.log('DB PATH:', dbPath)
console.log('SCHEMA PATH:', schemaPath)