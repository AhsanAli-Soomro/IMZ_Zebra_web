// import mysql from 'mysql2/promise';

// let pool;

// if (!globalThis._mysqlPool) {
// globalThis._mysqlPool = mysql.createPool({
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
// });
// }

// pool = globalThis._mysqlPool;

// class DatabaseClass {
//   async query(sql, params = []) {
//     let connection;
//     try {
//       connection = await pool.getConnection();
//       const [rows] = await connection.execute(sql, params);
//       return rows;
//     } catch (error) {
//       console.error('Database query error:', error);
//       throw new Error(`Database query failed: ${error.message}`);
//     } finally {
//       if (connection) connection.release();
//     }
//   }

//   // Not used in Next.js; for optional manual shutdown
//   async close() {
//     try {
//       await pool.end();
//       console.log('Database pool closed.');
//     } catch (error) {
//       console.error('Error closing pool:', error.message);
//     }
//   }
// }

// export default new DatabaseClass();


import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { runMigrations } from './migrate.js'

const dbPath =
  process.env.SQLITE_DB_PATH ||
  path.join(process.cwd(), 'database', 'ims.sqlite')

if (!globalThis._sqliteDb) {
  const dir = path.dirname(dbPath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  console.log('Using SQLite DB:', dbPath)

  // Sab se pehle migrations
  runMigrations()

  const sqlite = new Database(dbPath)

  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  const adminName = process.env.DEFAULT_ADMIN_NAME || 'Admin'
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@gmail.com'
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || '123456'
  const adminUserType = process.env.DEFAULT_ADMIN_USER_TYPE || 'Admin'
  const adminStatus = process.env.DEFAULT_ADMIN_STATUS || 'active'
  const adminRole = process.env.DEFAULT_ADMIN_ROLE || 'user'

  const usersTable = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='users'`)
    .get()

  if (usersTable) {
    const userCountRow = sqlite.prepare(`SELECT COUNT(*) AS count FROM users`).get()
    const userCount = Number(userCountRow?.count || 0)

    if (userCount === 0) {
      sqlite.prepare(`
        INSERT INTO users (name, email, password, user_type, status, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        adminName,
        adminEmail,
        adminPassword,
        adminUserType,
        adminStatus,
        adminRole
      )

      console.log('Default admin user created:')
      console.log('Email:', adminEmail)
      console.log('Password:', adminPassword)
    }
  }

  globalThis._sqliteDb = sqlite
}

const sqlite = globalThis._sqliteDb

class DatabaseClass {
  async query(sql, params = []) {
    try {
      const stmt = sqlite.prepare(sql)
      const normalized = sql.trim().toUpperCase()

      if (normalized.startsWith('SELECT')) {
        return stmt.all(...params)
      }

      const result = stmt.run(...params)

      return {
        success: true,
        insertId: Number(result.lastInsertRowid || 0),
        changes: result.changes || 0,
      }
    } catch (error) {
      console.error('SQLite query error:', error)
      throw new Error(`Database query failed: ${error.message}`)
    }
  }

  getConnection() {
    return sqlite
  }

  async close() {
    try {
      sqlite.close()
    } catch (error) {
      console.error('Error closing SQLite:', error.message)
    }
  }
}

export default new DatabaseClass()