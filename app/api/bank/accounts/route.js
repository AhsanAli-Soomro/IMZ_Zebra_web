import { NextResponse } from 'next/server'
import db from '@/lib/db.js'

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clean(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

export async function GET() {
  try {
    const rows = await db.query(`
      SELECT
        ba.*,
        COALESCE(tx.transaction_count, 0) AS transaction_count
      FROM bank_accounts ba
      LEFT JOIN (
        SELECT account_id, COUNT(*) AS transaction_count
        FROM bank_transactions
        WHERE deleted_at IS NULL OR deleted_at = ''
        GROUP BY account_id
      ) tx ON tx.account_id = ba.id
      WHERE ba.deleted_at IS NULL OR ba.deleted_at = ''
      ORDER BY ba.id DESC
    `)

    return NextResponse.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        opening_balance: toNumber(row.opening_balance),
        current_balance: toNumber(row.current_balance),
        transaction_count: toNumber(row.transaction_count),
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load bank accounts' },
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const accountName = clean(body.accountName || body.account_name)
    const bankName = clean(body.bankName || body.bank_name)
    const accountNumber = clean(body.accountNumber || body.account_number)
    const openingBalance = toNumber(body.openingBalance || body.opening_balance)
    const status = clean(body.status, 'Active')
    const notes = clean(body.notes)

    if (!accountName) throw new Error('Account name required hai')
    if (openingBalance < 0) throw new Error('Opening balance negative nahi ho sakta')

    const sqlite = db.getConnection()
    const result = sqlite.transaction(() => {
      const account = sqlite.prepare(`
        INSERT INTO bank_accounts (
          account_name, bank_name, account_number, opening_balance,
          current_balance, status, notes, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(accountName, bankName, accountNumber, openingBalance, openingBalance, status, notes)

      const accountId = Number(account.lastInsertRowid)

      if (openingBalance > 0) {
        sqlite.prepare(`
          INSERT INTO bank_transactions (
            account_id, tx_date, tx_type, amount, balance_after,
            reference_type, reference_id, description, notes, created_at, updated_at
          )
          VALUES (?, date('now'), 'deposit', ?, ?, 'opening_balance', ?, 'Opening balance', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(accountId, openingBalance, openingBalance, accountId, notes)
      }

      return accountId
    })()

    return NextResponse.json({
      success: true,
      message: 'Bank account saved',
      data: { id: result },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to save bank account' },
      { status: 400 }
    )
  }
}

export async function PUT(req) {
  try {
    const body = await req.json()
    const id = toNumber(body.id)
    const accountName = clean(body.accountName || body.account_name)
    const bankName = clean(body.bankName || body.bank_name)
    const accountNumber = clean(body.accountNumber || body.account_number)
    const status = clean(body.status, 'Active')
    const notes = clean(body.notes)

    if (!id) throw new Error('Invalid account id')
    if (!accountName) throw new Error('Account name required hai')

    await db.query(`
      UPDATE bank_accounts
      SET account_name = ?, bank_name = ?, account_number = ?, status = ?,
          notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [accountName, bankName, accountNumber, status, notes, id])

    return NextResponse.json({ success: true, message: 'Bank account updated' })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update bank account' },
      { status: 400 }
    )
  }
}

export async function DELETE(req) {
  try {
    const body = await req.json()
    const id = toNumber(body.id)
    if (!id) throw new Error('Invalid account id')

    await db.query(`
      UPDATE bank_accounts
      SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id])

    return NextResponse.json({ success: true, message: 'Bank account deleted' })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to delete bank account' },
      { status: 400 }
    )
  }
}
