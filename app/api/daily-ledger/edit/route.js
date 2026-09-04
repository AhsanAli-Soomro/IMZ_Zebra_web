import { NextResponse } from 'next/server'
import db from '@/lib/db.js'
import { recalculateAccountBalances } from '@/lib/ledger.js'

export async function PATCH(request) {
  try {
    const body = await request.json()
    const id = Number(body.id)
    const amount = Number(body.amount)
    const entity = String(body.entity || '')

    if (!id || !Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ success: false, message: 'A valid entry and amount are required.' }, { status: 400 })
    }

    const sqlite = db.getConnection()
    const update = sqlite.transaction(() => {
      if (entity === 'cash') {
        const cash = sqlite.prepare(`SELECT * FROM cash_transactions WHERE id = ? AND deleted_at IS NULL`).get(id)
        if (!cash) throw new Error('Cash or bank transaction not found.')
        sqlite.prepare(`UPDATE cash_transactions SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(amount, id)

        if (cash.reference_type === 'ledger_entry' && cash.reference_id) {
          const entry = sqlite.prepare(`
            SELECT le.*, la.owner_type
            FROM ledger_entries le
            INNER JOIN ledger_accounts la ON la.id = le.account_id
            WHERE le.id = ? AND le.deleted_at IS NULL
          `).get(cash.reference_id)
          if (entry) {
            const isDebit = Number(entry.debit || 0) > 0
            sqlite.prepare(`UPDATE ledger_entries SET debit = ?, credit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
              .run(isDebit ? amount : 0, isDebit ? 0 : amount, entry.id)
            recalculateAccountBalances(sqlite, entry.account_id, entry.owner_type === 'supplier' ? 'credit-debit' : 'debit-credit')
          }
        }
        return
      }

      if (entity !== 'ledger') throw new Error('Invalid ledger entity')
      const entry = sqlite.prepare(`
        SELECT le.*, la.owner_type
        FROM ledger_entries le
        INNER JOIN ledger_accounts la ON la.id = le.account_id
        WHERE le.id = ? AND le.deleted_at IS NULL
      `).get(id)
      if (!entry) throw new Error('Ledger entry not found.')

      const isDebit = Number(entry.debit || 0) > 0
      sqlite.prepare(`
        UPDATE ledger_entries
        SET debit = ?, credit = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(isDebit ? amount : 0, isDebit ? 0 : amount, id)

      sqlite.prepare(`
        UPDATE cash_transactions
        SET amount = ?, updated_at = CURRENT_TIMESTAMP
        WHERE reference_type = 'ledger_entry' AND reference_id = ? AND deleted_at IS NULL
      `).run(amount, id)

      recalculateAccountBalances(
        sqlite,
        entry.account_id,
        entry.owner_type === 'supplier' ? 'credit-debit' : 'debit-credit'
      )
    })

    update()
    return NextResponse.json({ success: true, message: 'Amount successfully update ho gaya' })
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message || 'Amount could not be updated.' }, { status: 500 })
  }
}
