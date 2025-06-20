import mysql from 'mysql2/promise';

let pool;

if (!globalThis._mysqlPool) {
  globalThis._mysqlPool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

pool = globalThis._mysqlPool;

class DatabaseClass {
  async query(sql, params = []) {
    let connection;
    try {
      connection = await pool.getConnection();
      const [rows] = await connection.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('Database query error:', error);
      throw new Error(`Database query failed: ${error.message}`);
    } finally {
      if (connection) connection.release();
    }
  }

  // Not used in Next.js; for optional manual shutdown
  async close() {
    try {
      await pool.end();
      console.log('Database pool closed.');
    } catch (error) {
      console.error('Error closing pool:', error.message);
    }
  }
}

export default new DatabaseClass();
