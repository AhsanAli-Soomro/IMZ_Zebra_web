import { neon } from '@neondatabase/serverless'
import { NEON_DATABASE_URL } from './license-config'

let sqlClient = null

export function getNeonSql() {
  if (!sqlClient) {
    if (!NEON_DATABASE_URL) {
      throw new Error('NEON_DATABASE_URL is not configured.')
    }
    sqlClient = neon(NEON_DATABASE_URL)
  }
  return sqlClient
}

export async function ensureLicenseTable() {
  const sql = getNeonSql()
  await sql`
    CREATE TABLE IF NOT EXISTS system_licenses (
      id SERIAL PRIMARY KEY,
      machine_id VARCHAR(128) UNIQUE NOT NULL,
      mac_address VARCHAR(64) NOT NULL,
      hostname VARCHAR(128),
      os_info VARCHAR(128),
      activation_key VARCHAR(64) UNIQUE NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      customer_name VARCHAR(255),
      notes TEXT,
      first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      activated_at TIMESTAMP WITH TIME ZONE,
      expires_at TIMESTAMP WITH TIME ZONE,
      last_online_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `
}

export async function listLicenses() {
  const sql = getNeonSql()
  await ensureLicenseTable()
  const rows = await sql`
    SELECT * FROM system_licenses
    ORDER BY
      CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
      first_seen_at DESC
  `
  return rows
}

export async function updateLicenseStatus({ id, status, expires_at, customer_name, notes }) {
  const sql = getNeonSql()
  await ensureLicenseTable()

  let activated_at = null
  if (status === 'active') {
    activated_at = new Date().toISOString()
  }

  const rows = await sql`
    UPDATE system_licenses
    SET
      status = COALESCE(${status}, status),
      expires_at = ${expires_at !== undefined ? expires_at : null},
      activated_at = CASE WHEN ${status} = 'active' THEN NOW() ELSE activated_at END,
      customer_name = COALESCE(${customer_name}, customer_name),
      notes = COALESCE(${notes}, notes)
    WHERE id = ${id}
    RETURNING *;
  `
  return rows[0] || null
}

export async function deleteLicense(id) {
  const sql = getNeonSql()
  await ensureLicenseTable()
  const rows = await sql`DELETE FROM system_licenses WHERE id = ${id} RETURNING id;`
  return rows[0] || null
}

export async function registerOrCheckLicense({ machine_id, mac_address, hostname, os_info, activation_key }) {
  const sql = getNeonSql()
  await ensureLicenseTable()

  const rows = await sql`
    INSERT INTO system_licenses (machine_id, mac_address, hostname, os_info, activation_key, status, first_seen_at, last_online_at)
    VALUES (${machine_id}, ${mac_address}, ${hostname}, ${os_info}, ${activation_key}, 'pending', NOW(), NOW())
    ON CONFLICT (machine_id) DO UPDATE SET
      mac_address = EXCLUDED.mac_address,
      hostname = EXCLUDED.hostname,
      os_info = EXCLUDED.os_info,
      last_online_at = NOW()
    RETURNING *;
  `

  const record = rows[0]
  if (!record) return null

  // If status is active, check if expiry has passed
  if (record.status === 'active' && record.expires_at) {
    const expiryTime = new Date(record.expires_at).getTime()
    if (expiryTime <= Date.now()) {
      record.status = 'expired'
      await sql`UPDATE system_licenses SET status = 'expired' WHERE id = ${record.id}`
    }
  }

  return record
}

