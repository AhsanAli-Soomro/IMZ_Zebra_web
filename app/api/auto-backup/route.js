import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'

function getCandidateDbPaths() {
  const osAppSupport =
    process.platform === 'win32'
      ? (process.env.APPDATA ? path.join(process.env.APPDATA, 'zebra-ims') : null)
      : (process.platform === 'darwin'
          ? path.join(os.homedir(), 'Library', 'Application Support', 'zebra-ims')
          : path.join(os.homedir(), '.config', 'zebra-ims'))

  return [
    process.env.SQLITE_DB_PATH,
    osAppSupport ? path.join(osAppSupport, 'ims.sqlite') : null,
    path.join(process.cwd(), 'database', 'ims.sqlite'),
  ].filter(Boolean)
}

function getBackupDir() {
  const dir = path.join(process.cwd(), 'database', 'backups')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

// GET /api/auto-backup: List existing snapshots
export async function GET() {
  try {
    const backupDir = getBackupDir()
    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.sqlite') || f.endsWith('.bak'))

    const backups = files.map((f) => {
      const p = path.join(backupDir, f)
      const stats = fs.statSync(p)
      return {
        filename: f,
        size_kb: Math.round(stats.size / 1024),
        created_at: stats.mtime.toISOString(),
      }
    })

    backups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    return NextResponse.json({ ok: true, data: backups })
  } catch (err) {
    console.error('List backups error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

// POST /api/auto-backup: Create instant backup snapshot
export async function POST(req) {
  try {
    const candidatePaths = getCandidateDbPaths()
    let activeDbPath = null

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        activeDbPath = p
        break
      }
    }

    if (!activeDbPath) {
      return NextResponse.json({ ok: false, error: 'Database file not found' }, { status: 404 })
    }

    const backupDir = getBackupDir()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupFileName = `ims_backup_${timestamp}.sqlite`
    const backupFilePath = path.join(backupDir, backupFileName)

    fs.copyFileSync(activeDbPath, backupFilePath)

    const stats = fs.statSync(backupFilePath)

    return NextResponse.json({
      ok: true,
      message: 'Backup snapshot created successfully!',
      filename: backupFileName,
      size_kb: Math.round(stats.size / 1024),
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Create backup error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
