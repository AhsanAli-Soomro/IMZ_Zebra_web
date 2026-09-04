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

function today() {
  return new Date().toISOString().slice(0, 10)
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = toNumber(searchParams.get('accountId'))
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''

    const conditions = [`(bt.deleted_at IS NULL OR bt.deleted_at = '')`]
    const params = []

    if (accountId) {
      conditions.push('bt.account_id = ?')
      params.push(accountId)
    }

    if (dateFrom) {
      conditions.push('date(bt.tx_date) >= date(?)')
      params.push(dateFrom)
    }

    if (dateTo) {
      conditions.push('date(bt.tx_date) <= date(?)')
      params.push(dateTo)
    }

    const rows = await db.query(`
      SELECT
        bt.*,
        ba.account_name,
        ba.bank_name,
        target.account_name AS to_account_name
      FROM bank_transactions bt
      INNER JOIN bank_accounts ba ON ba.id = bt.account_id
      LEFT JOIN bank_accounts target ON target.id = bt.to_account_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY date(bt.tx_date) DESC, bt.id DESC
      LIMIT 1000
    `, params)

    return NextResponse.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        amount: toNumber(row.amount),
        balance_after: toNumber(row.balance_after),
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load bank transactions' },
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const accountId = toNumber(body.accountId || body.account_id)
    const toAccountId = toNumber(body.toAccountId || body.to_account_id)
    const txType = clean(body.txType || body.tx_type)
    const amount = toNumber(body.amount)
    const txDate = clean(body.txDate || body.tx_date, today())
    const notes = clean(body.notes)
    const description = clean(body.description)

    if (!accountId) throw new Error('A bank account is required.')
    if (!['deposit', 'withdrawal', 'transfer'].includes(txType)) {
      throw new Error('A valid transaction type is required.')
    }
    if (amount <= 0) throw new Error('A valid amount is required.')
    if (txType === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      throw new Error('A different target account is required for a transfer.')
    }

    const sqlite = db.getConnection()
    const result = sqlite.transaction(() => {
      const fromAccount = sqlite.prepare(`
        SELECT * FROM bank_accounts
        WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')
      `).get(accountId)

      if (!fromAccount) throw new Error('Bank account not found')

      if (txType === 'deposit') {
        const balance = toNumber(fromAccount.current_balance) + amount
        sqlite.prepare(`
          UPDATE bank_accounts
          SET current_balance = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(balance, accountId)

        const tx = sqlite.prepare(`
          INSERT INTO bank_transactions (
            account_id, tx_date, tx_type, amount, balance_after,
            description, notes, created_at, updated_at
          )
          VALUES (?, ?, 'deposit', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(accountId, txDate, amount, balance, description || 'Bank deposit', notes)

        return Number(tx.lastInsertRowid)
      }

      if (toNumber(fromAccount.current_balance) < amount) {
        throw new Error('Insufficient bank balance')
      }

      if (txType === 'withdrawal') {
        const balance = toNumber(fromAccount.current_balance) - amount
        sqlite.prepare(`
          UPDATE bank_accounts
          SET current_balance = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(balance, accountId)

        const tx = sqlite.prepare(`
          INSERT INTO bank_transactions (
            account_id, tx_date, tx_type, amount, balance_after,
            description, notes, created_at, updated_at
          )
          VALUES (?, ?, 'withdrawal', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(accountId, txDate, amount, balance, description || 'Bank withdrawal', notes)

        return Number(tx.lastInsertRowid)
      }

      const toAccount = sqlite.prepare(`
        SELECT * FROM bank_accounts
        WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')
      `).get(toAccountId)

      if (!toAccount) throw new Error('Target bank account not found')

      const fromBalance = toNumber(fromAccount.current_balance) - amount
      const toBalance = toNumber(toAccount.current_balance) + amount

      sqlite.prepare(`
        UPDATE bank_accounts
        SET current_balance = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(fromBalance, accountId)

      sqlite.prepare(`
        UPDATE bank_accounts
        SET current_balance = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(toBalance, toAccountId)

      const outTx = sqlite.prepare(`
        INSERT INTO bank_transactions (
          account_id, to_account_id, tx_date, tx_type, amount, balance_after,
          description, notes, created_at, updated_at
        )
        VALUES (?, ?, ?, 'transfer_out', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        accountId,
        toAccountId,
        txDate,
        amount,
        fromBalance,
        description || `Transfer to ${toAccount.account_name}`,
        notes
      )

      sqlite.prepare(`
        INSERT INTO bank_transactions (
          account_id, to_account_id, tx_date, tx_type, amount, balance_after,
          description, notes, created_at, updated_at
        )
        VALUES (?, ?, ?, 'transfer_in', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        toAccountId,
        accountId,
        txDate,
        amount,
        toBalance,
        description || `Transfer from ${fromAccount.account_name}`,
        notes
      )

      return Number(outTx.lastInsertRowid)
    })()

    return NextResponse.json({
      success: true,
      message: 'Bank transaction saved',
      data: { id: result },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to save bank transaction' },
      { status: 400 }
    )
  }
}
