import fs from 'fs'
import path from 'path'

export function getDatabaseDir() {
  const dir =
    process.env.SQLITE_DB_DIR ||
    path.join(process.cwd(), 'database')

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  return dir
}

export function getDatabasePath() {
  if (process.env.SQLITE_DB_PATH) {
    const fullPath = process.env.SQLITE_DB_PATH
    const dir = path.dirname(fullPath)

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    return fullPath
  }

  return path.join(getDatabaseDir(), 'ims.sqlite')
}

export function getSchemaPath() {
  return (
    process.env.SQLITE_SCHEMA_PATH ||
    path.join(process.cwd(), 'database', 'schema.sql')
  )
}