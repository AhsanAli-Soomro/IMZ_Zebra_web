import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function POST(request) {
  try {
    const { type, entryDate, items } = await request.json()
    if (!['customer', 'supplier'].includes(type)) throw new Error('Invalid party type')
    if (!entryDate || !Array.isArray(items) || !items.length) throw new Error('A date and balance rows are required.')

    const normalized = items.map((item) => ({
      partyId: Number(item.partyId), amount: Number(item.amount), note: String(item.note || '').trim(),
    }))
    if (normalized.some((item) => !item.partyId || !Number.isFinite(item.amount) || item.amount <= 0)) throw new Error('Each row requires a valid party and positive amount.')
    if (new Set(normalized.map((item) => item.partyId)).size !== normalized.length) throw new Error('Select each party only once.')

    const sqlite = db.getConnection()
    sqlite.transaction(() => {
      const partyTable = type === 'customer' ? 'customers' : 'suppliers'
      const balanceExpression = type === 'customer' ? 'debit - credit' : 'credit - debit'
      const accountNameExpression = type === 'customer' ? 'name' : "COALESCE(NULLIF(company_name, ''), name)"
      const entryType = type === 'customer' ? 'bulk_balance_debit' : 'supplier_bulk_balance_credit'
      const debit = type === 'customer'
      const findParty = sqlite.prepare(`SELECT id, ${accountNameExpression} AS account_name FROM ${partyTable} WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`)
      const findAccount = sqlite.prepare(`SELECT id FROM ledger_accounts WHERE owner_type = ? AND owner_id = ? ORDER BY id LIMIT 1`)
      const addAccount = sqlite.prepare(`INSERT INTO ledger_accounts (owner_type, owner_id, account_name, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      const insertEntry = sqlite.prepare(`INSERT INTO ledger_entries (account_id, entry_date, entry_type, debit, credit, balance_after, description, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      const entries = sqlite.prepare(`SELECT id, debit, credit FROM ledger_entries WHERE account_id = ? AND deleted_at IS NULL ORDER BY entry_date, id`)
      const updateBalance = sqlite.prepare(`UPDATE ledger_entries SET balance_after = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)

      for (const item of normalized) {
        const party = findParty.get(item.partyId)
        if (!party) throw new Error(`${type} not found`)
        let account = findAccount.get(type, item.partyId)
        if (!account) account = { id: Number(addAccount.run(type, item.partyId, party.account_name).lastInsertRowid) }
        insertEntry.run(account.id, entryDate, entryType, debit ? item.amount : 0, debit ? 0 : item.amount, `Bulk ${type} balance entry`, item.note)
        let balance = 0
        for (const entry of entries.all(account.id)) {
          balance += type === 'customer' ? Number(entry.debit || 0) - Number(entry.credit || 0) : Number(entry.credit || 0) - Number(entry.debit || 0)
          updateBalance.run(balance, entry.id)
        }
      }
    })()

    return NextResponse.json({ success: true, count: normalized.length })
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message || 'Bulk balance save failed' }, { status: 400 })
  }
}
