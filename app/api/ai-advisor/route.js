import { NextResponse } from 'next/server'
import db from '@/lib/db'

// Helper to fetch real-time financial snapshot using actual Zebra IMS schema
async function getFinancialSnapshot() {
  try {
    // 1. Today's sales from bills table
    const todaySales = await db.query(`
      SELECT 
        COALESCE(SUM(total), 0) as total_sales,
        COALESCE(SUM(paid_amount), 0) as total_cash_collected,
        COUNT(*) as total_invoices
      FROM bills 
      WHERE (deleted_at IS NULL OR deleted_at = '')
        AND (invoice_date = date('now') OR date(created_at) = date('now'))
    `)

    // 2. Top Debtors (Customers with positive balance from ledger_accounts)
    const topDebtors = await db.query(`
      SELECT
        c.id,
        c.name,
        c.phone,
        c.city,
        COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) AS balance
      FROM customers c
      LEFT JOIN ledger_accounts la
        ON la.owner_type = 'customer' AND la.owner_id = c.id
      LEFT JOIN ledger_entries le
        ON le.account_id = la.id AND (le.deleted_at IS NULL OR le.deleted_at = '')
      WHERE (c.deleted_at IS NULL OR c.deleted_at = '')
      GROUP BY c.id
      HAVING balance > 0
      ORDER BY balance DESC
      LIMIT 8
    `)

    // 3. Top Suppliers Payable (Liabilities from ledger_accounts)
    const topSuppliersPayable = await db.query(`
      SELECT
        s.id,
        s.name,
        s.phone,
        s.city,
        COALESCE(SUM(le.credit), 0) - COALESCE(SUM(le.debit), 0) AS balance
      FROM suppliers s
      LEFT JOIN ledger_accounts la
        ON la.owner_type = 'supplier' AND la.owner_id = s.id
      LEFT JOIN ledger_entries le
        ON le.account_id = la.id AND (le.deleted_at IS NULL OR le.deleted_at = '')
      WHERE (s.deleted_at IS NULL OR s.deleted_at = '')
      GROUP BY s.id
      HAVING balance > 0
      ORDER BY balance DESC
      LIMIT 8
    `)

    // 4. Low stock items from stocks table
    const lowStock = await db.query(`
      SELECT 
        item_name as name, 
        COALESCE(quantity, qty, 0) as quantity, 
        COALESCE(min_qty, reorder_level, 10) as min_quantity, 
        COALESCE(unit, 'units') as unit,
        COALESCE(selling_rate, selling_price, sale_price, 0) as rate
      FROM stocks 
      WHERE (deleted_at IS NULL OR deleted_at = '')
        AND (status IS NULL OR status = 'Active' OR status = 'active')
        AND COALESCE(quantity, qty, 0) <= COALESCE(min_qty, reorder_level, 10)
      ORDER BY quantity ASC 
      LIMIT 8
    `)

    // 5. Monthly Expenses from expenses table
    const monthExpenses = await db.query(`
      SELECT 
        COALESCE(category, 'General') as category, 
        COALESCE(SUM(amount), 0) as total 
      FROM expenses 
      WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now')
      GROUP BY category 
      ORDER BY total DESC
    `)

    // 6. Top selling items from sales_invoice_items
    const topSelling = await db.query(`
      SELECT 
        COALESCE(item_name, product_name, 'Product') as product_name, 
        COALESCE(SUM(qty), 0) as total_qty, 
        COALESCE(SUM(total), 0) as total_revenue
      FROM sales_invoice_items
      GROUP BY COALESCE(item_name, product_name)
      ORDER BY total_qty DESC
      LIMIT 6
    `)

    // 7. Net Cash in hand from cash_transactions
    const cashRow = await db.query(`
      SELECT COALESCE(SUM(CASE WHEN tx_type = 'in' THEN amount ELSE -amount END), 0) as net_cash
      FROM cash_transactions 
      WHERE (deleted_at IS NULL OR deleted_at = '')
    `)

    // 8. Total Bank balances & accounts list
    const bankAccounts = await db.query(`
      SELECT account_name, bank_name, account_number, COALESCE(current_balance, 0) as current_balance
      FROM bank_accounts
      WHERE (deleted_at IS NULL OR deleted_at = '')
    `)
    const totalBankBalance = (bankAccounts || []).reduce((acc, b) => acc + Number(b.current_balance || 0), 0)

    // 9. Staff Users (Cashiers, Admins, Salesmen, Operators)
    const staffUsers = await db.query(`
      SELECT id, name, email, COALESCE(user_type, role) as role, status
      FROM users
      WHERE (deleted_at IS NULL OR deleted_at = '')
      ORDER BY id ASC
    `)

    // 10. HRM Registered Employees
    const hrmEmployees = await db.query(`
      SELECT id, name, designation, salary, phone, status
      FROM employees
      ORDER BY id ASC
    `)

    // 11. Database entity counts
    const [custCountRow, suppCountRow, stockCountRow, storesRow] = await Promise.all([
      db.query(`SELECT COUNT(*) as count FROM customers WHERE (deleted_at IS NULL OR deleted_at = '')`),
      db.query(`SELECT COUNT(*) as count FROM suppliers WHERE (deleted_at IS NULL OR deleted_at = '')`),
      db.query(`SELECT COUNT(*) as total_items, COALESCE(SUM(quantity), 0) as total_qty FROM stocks WHERE (deleted_at IS NULL OR deleted_at = '')`),
      db.query(`SELECT id, name as store_name, address FROM stores WHERE (deleted_at IS NULL OR deleted_at = '')`),
    ])

    return {
      todaySales: todaySales?.[0] || { total_sales: 0, total_cash_collected: 0, total_invoices: 0 },
      topDebtors: topDebtors || [],
      topSuppliersPayable: topSuppliersPayable || [],
      lowStock: lowStock || [],
      monthExpenses: monthExpenses || [],
      topSelling: topSelling || [],
      cashInHand: cashRow?.[0]?.net_cash || 0,
      bankBalance: totalBankBalance,
      bankAccounts: bankAccounts || [],
      staffUsers: staffUsers || [],
      hrmEmployees: hrmEmployees || [],
      totalCustomers: custCountRow?.[0]?.count || 0,
      totalSuppliers: suppCountRow?.[0]?.count || 0,
      inventorySummary: stockCountRow?.[0] || { total_items: 0, total_qty: 0 },
      storesList: storesRow || [],
    }
  } catch (err) {
    console.error('Error getting financial snapshot:', err)
    return null
  }
}

// GET /api/ai-advisor: Financial health check and anomaly detection OR chat history
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.get('history') === 'true') {
      const history = await db.query(`
        SELECT 
          id, 
          sender, 
          message as text, 
          mode, 
          engine, 
          created_at, 
          strftime('%H:%M', created_at, 'localtime') as timestamp 
        FROM ai_advisor_chats 
        ORDER BY id ASC 
        LIMIT 100
      `)
      return NextResponse.json({ ok: true, history: history || [] })
    }

    const snap = await getFinancialSnapshot()
    if (!snap) {
      return NextResponse.json({ ok: false, error: 'Database snapshot unavailable' }, { status: 500 })
    }

    // Identify proactive anomalies
    const anomalies = []

    // 1. Critical Debt Warning
    const totalMarketUdhar = snap.topDebtors.reduce((acc, c) => acc + (Number(c.balance) || 0), 0)
    if (totalMarketUdhar > 100000) {
      anomalies.push({
        type: 'warning',
        title: 'High Market Receivables (Udhar)',
        message: `Market me Top customers ka kul udhar Rs. ${Math.round(totalMarketUdhar).toLocaleString()} hai. Wasooli tez karein.`,
      })
    }

    // 2. Low Stock Alerts
    if (snap.lowStock.length > 0) {
      anomalies.push({
        type: 'notice',
        title: 'Low Stock Reorder Alert',
        message: `${snap.lowStock.length} items ka stock khatam hone ke qareeb hai (e.g. ${snap.lowStock[0].name}).`,
      })
    }

    // 3. Daily Sales Check
    if (snap.todaySales.total_invoices === 0) {
      anomalies.push({
        type: 'info',
        title: 'No Invoices Billed Today Yet',
        message: 'Aaj abhi tak koi sale invoice register nahi hui hai.',
      })
    }

    // Check if Gemini is enabled & configured in database
    let geminiConfigured = false
    try {
      const gRow = await db.query(`
        SELECT setting_value 
        FROM app_settings 
        WHERE setting_key = 'gemini_api_key'
      `)
      if (gRow?.[0]?.setting_value && gRow[0].setting_value.trim()) {
        geminiConfigured = true
      }
    } catch {}

    return NextResponse.json({
      ok: true,
      snapshot: snap,
      anomalies,
      geminiConfigured,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

// DELETE /api/ai-advisor: Clear chat history
export async function DELETE() {
  try {
    await db.query(`DELETE FROM ai_advisor_chats`)
    return NextResponse.json({ ok: true, message: 'Chat history cleared' })
  } catch (err) {
    console.error('Failed to clear chat history:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

// POST /api/ai-advisor: Dual Engine (Google Gemini Online + Multi-Intent Smart Local SQL Engine)
export async function POST(req) {
  try {
    const { query, geminiKey } = await req.json()
    if (!query || !query.trim()) {
      return NextResponse.json({ ok: false, message: 'Query is required' }, { status: 400 })
    }

    // Save user query to SQLite database
    try {
      await db.query(
        `INSERT INTO ai_advisor_chats (session_id, sender, message, mode, engine) VALUES ('default', 'user', ?, 'user', 'User')`,
        [query.trim()]
      )
    } catch (saveErr) {
      console.warn('Failed to persist user chat:', saveErr.message)
    }

    // Helper to persist AI reply and return response
    const saveAndRespond = async (payload) => {
      if (payload && payload.response) {
        try {
          await db.query(
            `INSERT INTO ai_advisor_chats (session_id, sender, message, mode, engine) VALUES ('default', 'ai', ?, ?, ?)`,
            [payload.response, payload.mode || 'offline', payload.engine || 'Zebra Local Intelligence Engine']
          )
        } catch (saveErr) {
          console.warn('Failed to persist AI chat response:', saveErr.message)
        }
      }
      return NextResponse.json(payload)
    }

    const q = query.toLowerCase().trim()
    const snap = await getFinancialSnapshot()
    if (!snap) {
      return NextResponse.json({
        ok: false,
        message: 'Local database connection error. Please try again.',
      }, { status: 500 })
    }

    // Read Gemini configuration from database
    let activeGeminiKey = ''
    try {
      const gRows = await db.query(`
        SELECT setting_key, setting_value 
        FROM app_settings 
        WHERE setting_key IN ('gemini_api_key', 'gemini_enabled')
      `)
      const gMap = (gRows || []).reduce((acc, r) => {
        acc[r.setting_key] = r.setting_value
        return acc
      }, {})

      const isEnabled = gMap.gemini_enabled !== 'false' && gMap.gemini_enabled !== '0'
      if (isEnabled && gMap.gemini_api_key && gMap.gemini_api_key.trim()) {
        activeGeminiKey = gMap.gemini_api_key.trim()
      }
    } catch (e) {
      console.warn('Could not read gemini settings from app_settings:', e.message)
    }

    // Fallback if client passed any legacy key
    if (!activeGeminiKey && geminiKey && geminiKey.trim()) {
      activeGeminiKey = geminiKey.trim()
    }

    // ----------------------------------------------------
    // ONLINE ENGINE: Google Gemini (if API Key configured & online)
    // ----------------------------------------------------
    if (activeGeminiKey) {
      try {
        const promptContext = `
You are Zebra IMS AI Business Advisor for an inventory, sales & billing system in Pakistan.
Always respond in polite, clear Roman Urdu with professional business tone and exact numbers formatted in Pakistani Rupees (Rs.).

Formatting rules:
- Strictly do NOT use Markdown heading hashes (e.g. '###' or '##').
- Strictly do NOT output lines like "### **Business Summary Snapshot:**" or similar title wrappers.
- Format key points as clean bullets (•) and short readable paragraphs.
- Highlight key figures with bold **text**.
- Keep output tidy, respectful, concise, and direct in polite Roman Urdu.

Current Real-Time Business Database Snapshot:
- Staff & Employees:
  * System Users / Staff: ${snap.staffUsers.length > 0 ? snap.staffUsers.map(u => `${u.name} (${u.role || 'Staff'})`).join(', ') : 'None'}
  * HRM Employees Table: ${snap.hrmEmployees.length > 0 ? snap.hrmEmployees.map(e => `${e.name} (${e.designation || 'Employee'})`).join(', ') : 'None registered in HRM'}
- Today Sales: Rs. ${Number(snap.todaySales.total_sales).toLocaleString()} (${snap.todaySales.total_invoices} bills, Cash Collected: Rs. ${Number(snap.todaySales.total_cash_collected).toLocaleString()})
- Cash in Hand (Rokar): Rs. ${Number(snap.cashInHand).toLocaleString()}
- Total Bank Balances: Rs. ${Number(snap.bankBalance).toLocaleString()} (${snap.bankAccounts.map(b => `${b.account_name || b.bank_name || 'Bank'}: Rs. ${Number(b.current_balance).toLocaleString()}`).join(', ') || 'No bank accounts'})
- Registered Customers: ${snap.totalCustomers} customers. Top Udhar (Baqaya): ${snap.topDebtors.map(d => `${d.name}: Rs. ${Math.round(Number(d.balance)).toLocaleString()}`).join(', ') || 'No pending debts'}
- Registered Suppliers: ${snap.totalSuppliers} suppliers. Top Payable (Dena hai): ${snap.topSuppliersPayable.map(s => `${s.name}: Rs. ${Math.round(Number(s.balance)).toLocaleString()}`).join(', ') || 'No payables'}
- Total Inventory Items: ${snap.inventorySummary.total_items} items (${snap.inventorySummary.total_qty} units in stock)
- Low Stock Items: ${snap.lowStock.map(l => `${l.name} (${l.quantity} ${l.unit})`).join(', ') || 'Stock adequate'}
- Top Selling Items: ${snap.topSelling.map(t => `${t.product_name} (${t.total_qty} units sold, Rs. ${Number(t.total_revenue).toLocaleString()})`).join(', ') || 'None'}
- Monthly Expenses Total: Rs. ${snap.monthExpenses.reduce((a, b) => a + Number(b.total), 0).toLocaleString()}

User's Question: "${query}"
Answer the user directly and accurately based on these real database records.
`
        let geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(activeGeminiKey)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': activeGeminiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptContext }] }],
              generationConfig: {
                thinkingConfig: {
                  thinkingBudget: 0,
                },
              },
            }),
            signal: AbortSignal.timeout(15000),
          }
        )

        // If 503 or transient failure on flash-lite, fallback to 3.5-flash
        if (geminiRes.status !== 200) {
          console.warn('Gemini 3.5 flash-lite returned status:', geminiRes.status, 'trying 3.5-flash fallback...')
          geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${encodeURIComponent(activeGeminiKey)}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': activeGeminiKey,
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: promptContext }] }],
                generationConfig: {
                  thinkingConfig: {
                    thinkingBudget: 0,
                  },
                },
              }),
              signal: AbortSignal.timeout(15000),
            }
          )
        }

        const geminiData = await geminiRes.json()
        const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          return await saveAndRespond({
            ok: true,
            mode: 'online',
            engine: 'Google Gemini Pro',
            response: text,
          })
        }
      } catch (geminiErr) {
        console.warn('Gemini online call failed, falling back smoothly to offline local engine:', geminiErr.message)
      }
    }

    // ----------------------------------------------------
    // OFFLINE ENGINE: Local Multi-Intent Smart SQL Engine (100% Offline)
    // ----------------------------------------------------

    // Helper: Extract dates from query (e.g. "2026-10-08", "aj", "aaj", "kal", "8 oct")
    function extractDateFromQuery(text) {
      const t = text.toLowerCase()

      // 1. Relative: Today ('aj', 'aaj', 'today', 'current date')
      if (/\b(aj|aaj|today|current date)\b/.test(t)) {
        const now = new Date()
        const pkTime = new Date(now.getTime() + (5 * 60 + now.getTimezoneOffset()) * 60000)
        const y = pkTime.getFullYear()
        const m = String(pkTime.getMonth() + 1).padStart(2, '0')
        const d = String(pkTime.getDate()).padStart(2, '0')
        return { date: `${y}-${m}-${d}`, isToday: true }
      }

      // 2. Relative: Yesterday ('kal', 'yesterday')
      if (/\b(kal|yesterday)\b/.test(t)) {
        const now = new Date()
        const pkTime = new Date(now.getTime() + (5 * 60 + now.getTimezoneOffset()) * 60000)
        pkTime.setDate(pkTime.getDate() - 1)
        const y = pkTime.getFullYear()
        const m = String(pkTime.getMonth() + 1).padStart(2, '0')
        const d = String(pkTime.getDate()).padStart(2, '0')
        return { date: `${y}-${m}-${d}`, isYesterday: true }
      }

      // 3. ISO format: YYYY-MM-DD
      const isoMatch = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
      if (isoMatch) {
        return { date: `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}` }
      }

      // 4. DD-MM-YYYY or DD/MM/YYYY
      const dmyMatch = t.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/)
      if (dmyMatch) {
        return { date: `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}` }
      }

      // 5. Month names (e.g. "8 october 2026", "8 oct")
      const monthMap = {
        jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
        apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
        aug: '08', august: '08', sep: '09', sept: '09', september: '09', oct: '10', october: '10',
        nov: '11', november: '11', dec: '12', december: '12',
      }
      const textMonthMatch = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)(?:\s+(\d{4}))?\b/i)
      if (textMonthMatch) {
        const day = textMonthMatch[1].padStart(2, '0')
        const monthName = textMonthMatch[2].toLowerCase()
        const year = textMonthMatch[3] || new Date().getFullYear().toString()
        if (monthMap[monthName]) {
          return { date: `${year}-${monthMap[monthName]}-${day}` }
        }
      }
      return null
    }

    // 1. GREETINGS & INTRODUCTIONS
    if (/^(hi|hello|salam|assalam|hey|kya hal|kaise ho|aoa)\b/i.test(q)) {
      return await saveAndRespond({
        ok: true,
        mode: 'offline',
        engine: 'Zebra Local Intelligence Engine',
        response: `Walekum Assalam! Main Zebra IMS ka **Local AI Business Advisor** hoon ⚡.\n\n` +
          `Main 100% offline aapke system ka real-time hisab kitab analyze kar sakta hoon. Aap mujhse pooch sakte hain:\n\n` +
          `• *"aj ki date ki cash in hand batao"*\n` +
          `• *"2026-10-08 date ki cash in hand batao"*\n` +
          `• *"Aaj ki sale aur rokar kitni hai?"*\n` +
          `• *"Is mahine ka profit kitna hua?"*\n` +
          `• *"Cash aur bank me kitna balance hai?"*\n` +
          `• Ya kisi bhi customer ya item ka naam likhein jaise *"Ahsan ka balance"* ya *"Basmati stock"*.`,
      })
    }

    // 2. STAFF & EMPLOYEES RECORD (Users & HRM)
    if (q.includes('employee') || q.includes('employees') || q.includes('staff') || q.includes('cashier') || q.includes('mulazim') || q.includes('mulazmeen') || q.includes('worker') || (q.includes('user') && !q.includes('udhar'))) {
      let staffReply = `👥 **[Offline Engine] Staff & Employees Record:**\n\n`
      if (snap.staffUsers.length > 0) {
        staffReply += `• **Registered System Users / Staff (${snap.staffUsers.length}):**\n`
        snap.staffUsers.forEach((u, idx) => {
          staffReply += `  ${idx + 1}. **${u.name}** — ${u.role || 'Staff'} (${u.status})\n`
        })
      }
      if (snap.hrmEmployees.length > 0) {
        staffReply += `\n• **HRM Module Employees (${snap.hrmEmployees.length}):**\n`
        snap.hrmEmployees.forEach((e, idx) => {
          staffReply += `  ${idx + 1}. **${e.name}** — ${e.designation || 'Staff'} (Salary: Rs. ${Number(e.salary || 0).toLocaleString()})\n`
        })
      } else if (snap.staffUsers.length === 0) {
        staffReply += `System me abhi tak koi employee ya user register nahi hai.`
      }

      return await saveAndRespond({
        ok: true,
        mode: 'offline',
        engine: 'Zebra Local Intelligence Engine',
        response: staffReply.trim(),
      })
    }

    // 3. SPECIFIC DATE RECORD (e.g. "aj ki date ki cash in hand", "2026-10-08 date ki cash in hand", "kal ki sale")
    const dateObj = extractDateFromQuery(q)
    if (dateObj && dateObj.date) {
      const targetDate = dateObj.date
      const isToday = Boolean(dateObj.isToday)
      const isYesterday = Boolean(dateObj.isYesterday)

      const [closingRows, salesRows, cashRows, expRows, purchaseRows, latestClosingRows] = await Promise.all([
        db.query('SELECT * FROM counter_closings WHERE date(closing_date) = date(?) LIMIT 1', [targetDate]),
        db.query(`
          SELECT 
            COUNT(*) as count, 
            COALESCE(SUM(total), 0) as total_sales, 
            COALESCE(SUM(paid_amount), 0) as cash_collected,
            COALESCE(SUM(remaining_amount), 0) as udhar_sales
          FROM bills
          WHERE (deleted_at IS NULL OR deleted_at = '')
            AND (date(invoice_date) = date(?) OR date(created_at) = date(?))
        `, [targetDate, targetDate]),
        db.query(`
          SELECT 
            COALESCE(SUM(CASE WHEN tx_type = 'in' THEN amount ELSE 0 END), 0) as cash_in,
            COALESCE(SUM(CASE WHEN tx_type = 'out' THEN amount ELSE 0 END), 0) as cash_out
          FROM cash_transactions
          WHERE (deleted_at IS NULL OR deleted_at = '')
            AND date(tx_date) = date(?)
        `, [targetDate]),
        db.query('SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE date(expense_date) = date(?)', [targetDate]),
        db.query(`
          SELECT 
            COUNT(*) as count,
            COALESCE(SUM(total), 0) as total_purchases,
            COALESCE(SUM(paid_amount), 0) as cash_paid
          FROM purchase_invoices
          WHERE (deleted_at IS NULL OR deleted_at = '')
            AND (date(purchase_date) = date(?) OR date(invoice_date) = date(?))
        `, [targetDate, targetDate]),
        db.query('SELECT closing_date, physical_amount FROM counter_closings ORDER BY closing_date DESC, id DESC LIMIT 1'),
      ])

      const closing = closingRows?.[0] || null
      const sales = salesRows?.[0] || { count: 0, total_sales: 0, cash_collected: 0, udhar_sales: 0 }
      const cash = cashRows?.[0] || { cash_in: 0, cash_out: 0 }
      const exp = expRows?.[0] || { total: 0, count: 0 }
      const purchase = purchaseRows?.[0] || { count: 0, total_purchases: 0, cash_paid: 0 }
      const latestClosing = latestClosingRows?.[0] || null

      const dateLabel = isToday ? `${targetDate} (Aaj)` : isYesterday ? `${targetDate} (Kal)` : targetDate
      let dateReply = `📅 **[Offline Engine] Tareekh: ${dateLabel} Ka Record:**\n\n`

      // A. Physical Cash In Hand / Counter Closing on this date
      if (closing) {
        dateReply += `• **Physical Cash in Hand (Counter Closing):** Rs. ${Number(closing.physical_amount).toLocaleString()}\n`
        dateReply += `  - Software Expected Cash: Rs. ${Number(closing.expected_amount).toLocaleString()}\n`
        if (Number(closing.variance) !== 0) {
          dateReply += `  - Variance (Farq): Rs. ${Number(closing.variance).toLocaleString()}\n`
        }
      } else {
        dateReply += `• **Physical Cash in Hand (Counter Closing):** ${isToday ? 'Aaj abhi tak physical closing save nahi ki gayi hai (Galla shaam ko band kiya jata hai).' : 'Is tareekh ko physical closing record nahi hui thi.'}\n`
        if (latestClosing) {
          dateReply += `  *(Pichla Recorded Physical Galla: Rs. ${Number(latestClosing.physical_amount).toLocaleString()} tareekh ${latestClosing.closing_date} ko save hua tha)*\n`
        }
      }

      // B. Sales on this date
      dateReply += `\n• **Is Din Ki Kul Sale:** Rs. ${Number(sales.total_sales).toLocaleString()} (${sales.count} bills)\n`
      if (Number(sales.cash_collected) > 0) {
        dateReply += `  - Sales Cash Wasool: Rs. ${Number(sales.cash_collected).toLocaleString()}\n`
      }
      if (Number(sales.udhar_sales) > 0) {
        dateReply += `  - Sales Udhar: Rs. ${Number(sales.udhar_sales).toLocaleString()}\n`
      }

      // C. Expenses on this date
      dateReply += `• **Dukan Ke Kharchay:** Rs. ${Number(exp.total).toLocaleString()} (${exp.count} entries)\n`

      // D. Purchases on this date
      if (Number(purchase.total_purchases) > 0) {
        dateReply += `• **Purchases / Kharidari:** Rs. ${Number(purchase.total_purchases).toLocaleString()} (Cash Paid: Rs. ${Number(purchase.cash_paid).toLocaleString()})\n`
      }

      // E. Cash Transactions
      if (Number(cash.cash_in) > 0 || Number(cash.cash_out) > 0) {
        dateReply += `• **Cash Ledger Entries:** Inflow Rs. ${Number(cash.cash_in).toLocaleString()} | Outflow Rs. ${Number(cash.cash_out).toLocaleString()}\n`
      }

      if (isToday && !closing) {
        dateReply += `\n💡 *Tip: Din ke aakhir par sidebar me "Cash in Hand" tab me ja kar aaj ka physical galla count save karein.*`
      }

      return await saveAndRespond({
        ok: true,
        mode: 'offline',
        engine: 'Zebra Local Intelligence Engine',
        response: dateReply.trim(),
      })
    }

    // 2. SPECIFIC CUSTOMER SEARCH (e.g. "Ahsan ka balance", "customer Shakir", "Tariq udhar")
    const words = q.split(/\s+/).filter(w => !['ka', 'ki', 'ke', 'ko', 'me', 'se', 'balance', 'udhar', 'customer', 'kitna', 'hai', 'batao', 'check', 'bataen'].includes(w))
    if (words.length > 0 && (q.includes('customer') || q.includes('balance') || q.includes('udhar') || q.includes('hisab'))) {
      const searchTerm = words.join(' ')
      if (searchTerm.length >= 2) {
        const matchingCustomers = await db.query(`
          SELECT
            c.id,
            c.name,
            c.phone,
            c.city,
            COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) AS balance
          FROM customers c
          LEFT JOIN ledger_accounts la
            ON la.owner_type = 'customer' AND la.owner_id = c.id
          LEFT JOIN ledger_entries le
            ON le.account_id = la.id AND (le.deleted_at IS NULL OR le.deleted_at = '')
          WHERE (c.deleted_at IS NULL OR c.deleted_at = '')
            AND (c.name LIKE ? OR c.phone LIKE ?)
          GROUP BY c.id
          LIMIT 3
        `, [`%${searchTerm}%`, `%${searchTerm}%`])

        if (matchingCustomers && matchingCustomers.length > 0) {
          let custReply = `⚡ **[Offline Engine] Customer Ledger Details:**\n\n`
          for (const c of matchingCustomers) {
            const bal = Math.round(Number(c.balance) || 0)
            custReply += `👤 **${c.name}** ${c.city ? `(${c.city})` : ''}\n`
            custReply += `• **Phone:** ${c.phone || 'N/A'}\n`
            custReply += `• **Current Balance (Udhar):** ${bal > 0 ? `Rs. ${bal.toLocaleString()} (Lena Hai)` : bal < 0 ? `Rs. ${Math.abs(bal).toLocaleString()} (Advance)` : 'Rs. 0 (Nil / Clear)'}\n\n`
          }
          return await saveAndRespond({
            ok: true,
            mode: 'offline',
            engine: 'Zebra Local Intelligence Engine',
            response: custReply.trim(),
          })
        }
      }
    }

    // 3. SPECIFIC STOCK / ITEM SEARCH (e.g. "Basmati stock", "Sugar kitna hai", "Super Kernel")
    if (q.includes('stock') || q.includes('maal') || q.includes('item') || q.includes('rate') || q.includes('price')) {
      const stockWords = q.split(/\s+/).filter(w => !['ka', 'ki', 'ke', 'ko', 'me', 'se', 'stock', 'maal', 'item', 'kitna', 'hai', 'rate', 'price', 'batao', 'check'].includes(w))
      if (stockWords.length > 0) {
        const itemSearch = stockWords.join(' ')
        const matchingItems = await db.query(`
          SELECT 
            item_name, 
            COALESCE(quantity, qty, 0) as quantity, 
            COALESCE(unit, 'units') as unit, 
            COALESCE(purchase_rate, purchase_price, 0) as cost,
            COALESCE(selling_rate, selling_price, sale_price, 0) as sale_rate,
            store_name,
            COALESCE(min_qty, reorder_level, 10) as min_quantity
          FROM stocks 
          WHERE (deleted_at IS NULL OR deleted_at = '')
            AND (item_name LIKE ? OR item_code LIKE ?)
          LIMIT 4
        `, [`%${itemSearch}%`, `%${itemSearch}%`])

        if (matchingItems && matchingItems.length > 0) {
          let stockReply = `⚡ **[Offline Engine] Stock Status for "${itemSearch}":**\n\n`
          for (const it of matchingItems) {
            const isLow = Number(it.quantity) <= Number(it.min_quantity)
            stockReply += `📦 **${it.item_name}**\n`
            stockReply += `• **Mojooda Stock:** ${it.quantity} ${it.unit} ${isLow ? '⚠️ *(Low Stock!)*' : '✅'}\n`
            stockReply += `• **Sale Rate:** Rs. ${Number(it.sale_rate).toLocaleString()}\n`
            if (it.store_name) stockReply += `• **Godam / Store:** ${it.store_name}\n`
            stockReply += `\n`
          }
          return await saveAndRespond({
            ok: true,
            mode: 'offline',
            engine: 'Zebra Local Intelligence Engine',
            response: stockReply.trim(),
          })
        }
      }
    }

    // 4. SALES INQUIRIES BY TIME (Today, Yesterday, This Month, Last Month, Overall)
    if (q.includes('kal') || q.includes('yesterday')) {
      const yesterdaySales = await db.query(`
        SELECT 
          COALESCE(SUM(total), 0) as total_sales,
          COALESCE(SUM(paid_amount), 0) as cash_collected,
          COUNT(*) as total_invoices
        FROM bills 
        WHERE (deleted_at IS NULL OR deleted_at = '')
          AND (invoice_date = date('now', '-1 day') OR date(created_at) = date('now', '-1 day'))
      `)
      const yData = yesterdaySales?.[0] || { total_sales: 0, cash_collected: 0, total_invoices: 0 }
      return await saveAndRespond({
        ok: true,
        mode: 'offline',
        engine: 'Zebra Local Intelligence Engine',
        response: `⚡ **[Offline Engine] Kal (Yesterday) Ka Hisab Kitab:**\n\n` +
          `• **Kal Ki Kul Sale:** Rs. ${Number(yData.total_sales).toLocaleString()}\n` +
          `• **Total Invoices / Bills:** ${yData.total_invoices} bills\n` +
          `• **Kal Wasool Shuda Cash:** Rs. ${Number(yData.cash_collected).toLocaleString()}`,
      })
    }

    if (q.includes('mahina') || q.includes('mahine') || q.includes('month') || q.includes('monthly')) {
      const isLastMonth = q.includes('pichle') || q.includes('last')
      const dateFilter = isLastMonth ? "strftime('%Y-%m', 'now', '-1 month')" : "strftime('%Y-%m', 'now')"
      const monthTitle = isLastMonth ? 'Pichle Mahine (Last Month)' : 'Is Mahine (Current Month)'

      const monthSales = await db.query(`
        SELECT 
          COALESCE(SUM(total), 0) as total_sales,
          COALESCE(SUM(paid_amount), 0) as cash_collected,
          COUNT(*) as total_invoices
        FROM bills 
        WHERE (deleted_at IS NULL OR deleted_at = '')
          AND strftime('%Y-%m', invoice_date) = ${dateFilter}
      `)
      const mData = monthSales?.[0] || { total_sales: 0, cash_collected: 0, total_invoices: 0 }
      const expTotal = isLastMonth ? 0 : snap.monthExpenses.reduce((a, b) => a + Number(b.total), 0)

      return await saveAndRespond({
        ok: true,
        mode: 'offline',
        engine: 'Zebra Local Intelligence Engine',
        response: `⚡ **[Offline Engine] ${monthTitle} Ka Jaiza:**\n\n` +
          `• **Kul Sale (Revenue):** Rs. ${Number(mData.total_sales).toLocaleString()}\n` +
          `• **Total Bills:** ${mData.total_invoices} invoices\n` +
          `• **Wasool Shuda Cash:** Rs. ${Number(mData.cash_collected).toLocaleString()}\n` +
          (!isLastMonth ? `• **Mahana Kharchay:** Rs. ${expTotal.toLocaleString()}\n` : '') +
          `\nKarobar ki growth check karne ke liye aap pichle mahine ki sale se compare kar sakte hain.`,
      })
    }

    if (q.includes('aaj') || (q.includes('sale') && !q.includes('total') && !q.includes('kul'))) {
      return await saveAndRespond({
        ok: true,
        mode: 'offline',
        engine: 'Zebra Local Intelligence Engine',
        response: `⚡ **[Offline Engine] Aaj Ka Hisab Kitab:**\n\n` +
          `• **Aaj Ki Kul Sale:** Rs. ${Number(snap.todaySales.total_sales).toLocaleString()}\n` +
          `• **Bane Huey Bills:** ${snap.todaySales.total_invoices} invoices\n` +
          `• **Aaj Cash Wasool:** Rs. ${Number(snap.todaySales.total_cash_collected).toLocaleString()}\n` +
          `• **Current Cash In Hand (Rokar):** Rs. ${Number(snap.cashInHand).toLocaleString()}\n\n` +
          `Rokar ledger me aaj ka hisab update ho chuka hai.`,
      })
    }

    // 5. PROFIT / MUNAFA / MARGIN INQUIRIES
    if (q.includes('profit') || q.includes('munafa') || q.includes('margin') || q.includes('bachat') || q.includes('kamai')) {
      const profitStats = await db.query(`
        SELECT 
          COALESCE(SUM(sii.total), 0) as revenue,
          COALESCE(SUM(sii.qty * COALESCE(st.purchase_rate, st.purchase_price, 0)), 0) as cost
        FROM sales_invoice_items sii
        LEFT JOIN stocks st ON sii.stock_id = st.id
        LEFT JOIN bills b ON sii.bill_id = b.id
        WHERE (b.deleted_at IS NULL OR b.deleted_at = '')
          AND strftime('%Y-%m', b.invoice_date) = strftime('%Y-%m', 'now')
      `)
      const pData = profitStats?.[0] || { revenue: 0, cost: 0 }
      const grossProfit = Number(pData.revenue) - Number(pData.cost)
      const expTotal = snap.monthExpenses.reduce((a, b) => a + Number(b.total), 0)
      const netProfit = grossProfit - expTotal
      const margin = pData.revenue > 0 ? ((grossProfit / pData.revenue) * 100).toFixed(1) : '0'

      return await saveAndRespond({
        ok: true,
        mode: 'offline',
        engine: 'Zebra Local Intelligence Engine',
        response: `⚡ **[Offline Engine] Is Mahine Ka Profit & Loss Hisab:**\n\n` +
          `• **Kul Mahana Sale (Revenue):** Rs. ${Number(pData.revenue).toLocaleString()}\n` +
          `• **Kharidari Ki Cost (COGS):** Rs. ${Number(pData.cost).toLocaleString()}\n` +
          `• **Gross Munafa:** Rs. ${grossProfit.toLocaleString()} (${margin}% margin)\n` +
          `• **Mahana Dukan Ke Kharchay:** Rs. ${expTotal.toLocaleString()}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `• **Net Munafa (Saaf Bachat):** Rs. ${netProfit.toLocaleString()}\n\n` +
          `${netProfit >= 0 ? 'MashaAllah aapka business munafay me chal raha hai!' : 'Kharchay zyada hone ki wajah se control ki zaroorat hai.'}`,
      })
    }

    // 6. CASH IN HAND & BANK BALANCE (Liquidity Breakdown)
    if (q.includes('cash') || q.includes('rokar') || q.includes('bank') || q.includes('galla') || q.includes('paisa')) {
      const latestClosingRow = await db.query(`
        SELECT closing_date, physical_amount, expected_amount, variance
        FROM counter_closings
        ORDER BY closing_date DESC, id DESC
        LIMIT 1
      `)
      const latestClosing = latestClosingRow?.[0] || null

      let cashReply = `⚡ **[Offline Engine] Mojooda Cash Aur Bank Position:**\n\n`
      
      if (latestClosing) {
        cashReply += `• **Last Recorded Counter Closing (Physical Cash in Hand):** Rs. ${Number(latestClosing.physical_amount).toLocaleString()} *(Tareekh: ${latestClosing.closing_date})*\n`
      }
      
      cashReply += `• **Sales Se Received Cash (Transactions):** Rs. ${Number(snap.cashInHand).toLocaleString()} *(Bills/invoices se wasool hone wala cash)*\n`
      cashReply += `• **Bank Accounts Balance:** Rs. ${Number(snap.bankBalance).toLocaleString()}\n`
      cashReply += `━━━━━━━━━━━━━━━━━━━━━━\n`
      cashReply += `• **Kul Liquid Funds:** Rs. ${(Number(snap.cashInHand) + Number(snap.bankBalance)).toLocaleString()}\n\n`
      cashReply += `💡 *Wazahat:* \n`
      if (latestClosing) {
        cashReply += `1. **Rs. ${Number(latestClosing.physical_amount).toLocaleString()}** counter closing par physical galla count karke save kiya gaya tha (Tareekh: ${latestClosing.closing_date}).\n`
      }
      cashReply += `2. **Rs. ${Number(snap.cashInHand).toLocaleString()}** sales bills aur cash transactions se wasool hone wala total record hai.`

      return await saveAndRespond({
        ok: true,
        mode: 'offline',
        engine: 'Zebra Local Intelligence Engine',
        response: cashReply.trim(),
      })
    }

    // 7. EXPENSES BREAKDOWN
    if (q.includes('kharcha') || q.includes('kharchay') || q.includes('expense') || q.includes('expenses') || q.includes('bill')) {
      const expTotal = snap.monthExpenses.reduce((a, b) => a + Number(b.total), 0)
      let expReply = `⚡ **[Offline Engine] Is Mahine Ke Kharchay (Expenses):**\n\n` +
        `• **Kul Mahana Kharcha:** Rs. ${expTotal.toLocaleString()}\n\n` +
        `**Category Wise Breakdown:**\n`
      if (snap.monthExpenses.length === 0) {
        expReply += `Is mahine koi kharcha enter nahi hua.\n`
      } else {
        snap.monthExpenses.forEach((exp) => {
          expReply += `• **${exp.category}:** Rs. ${Number(exp.total).toLocaleString()}\n`
        })
      }
      return await saveAndRespond({
        ok: true,
        mode: 'offline',
        engine: 'Zebra Local Intelligence Engine',
        response: expReply.trim(),
      })
    }

    // 8. UDHAR / MARKET RECEIVABLES
    if (q.includes('udhar') || q.includes('market') || q.includes('baqaya') || q.includes('wasooli') || q.includes('receivable')) {
      const totalUdhar = snap.topDebtors.reduce((a, b) => a + (Number(b.balance) || 0), 0)
      let udharReply = `⚡ **[Offline Engine] Market Ka Udhar Aur Top Baqaya Parties:**\n\n` +
        `• **Top Customers Ka Kul Udhar:** Rs. ${Math.round(totalUdhar).toLocaleString()}\n\n` +
        `**Top Baqaya Customers:**\n`
      if (snap.topDebtors.length === 0) {
        udharReply += `MashaAllah! Kisi bhi customer ka udhar baqaya nahi hai.\n`
      } else {
        snap.topDebtors.forEach((c, idx) => {
          udharReply += `${idx + 1}. **${c.name}:** Rs. ${Math.round(Number(c.balance)).toLocaleString()} ${c.phone ? `(${c.phone})` : ''}\n`
        })
        udharReply += `\n*Mashwara: In customers se wasooli ke liye reminder call karein.*`
      }
      return await saveAndRespond({
        ok: true,
        mode: 'offline',
        engine: 'Zebra Local Intelligence Engine',
        response: udharReply.trim(),
      })
    }

    // 9. SUPPLIER PAYABLES (Dena Hai)
    if (q.includes('supplier') || q.includes('suppliers') || q.includes('dena') || q.includes('payable') || q.includes('wajib')) {
      const totalPayable = snap.topSuppliersPayable.reduce((a, b) => a + (Number(b.balance) || 0), 0)
      let suppReply = `⚡ **[Offline Engine] Suppliers Ko Adaigi (Payables):**\n\n` +
        `• **Kul Supplier Wajib-ul-Ada:** Rs. ${Math.round(totalPayable).toLocaleString()}\n\n`
      if (snap.topSuppliersPayable.length === 0) {
        suppReply += `Kisi bhi supplier ka baqaya wajib-ul-ada nahi hai. Sab clear hai.`
      } else {
        suppReply += `**Top Suppliers Jinhe Raqam Deni Hai:**\n`
        snap.topSuppliersPayable.forEach((s, idx) => {
          suppReply += `${idx + 1}. **${s.name}:** Rs. ${Math.round(Number(s.balance)).toLocaleString()} ${s.phone ? `(${s.phone})` : ''}\n`
        })
      }
      return await saveAndRespond({
        ok: true,
        mode: 'offline',
        engine: 'Zebra Local Intelligence Engine',
        response: suppReply.trim(),
      })
    }

    // 10. LOW STOCK ALERT
    if (q.includes('low') || q.includes('short') || q.includes('khatam') || q.includes('reorder')) {
      let lowReply = `⚡ **[Offline Engine] Low Stock Alert (Mal Khatam Hone Wala Hai):**\n\n`
      if (snap.lowStock.length === 0) {
        lowReply += `Alhamdulillah! Sabhi items ka stock behtareen level par hai. Koi item short nahi hai.`
      } else {
        snap.lowStock.forEach((item, idx) => {
          lowReply += `${idx + 1}. **${item.name}:** Sirf **${item.quantity} ${item.unit}** baqi hain (Reorder Limit: ${item.min_quantity})\n`
        })
        lowReply += `\n*In items ka foran supplier se naya order mangwa lein.*`
      }
      return await saveAndRespond({
        ok: true,
        mode: 'offline',
        engine: 'Zebra Local Intelligence Engine',
        response: lowReply.trim(),
      })
    }

    // 11. TOP SELLING / FAST MOVING PRODUCTS
    if (q.includes('top') || q.includes('fast') || q.includes('zyada') || q.includes('bestseller') || q.includes('bika')) {
      let topReply = `⚡ **[Offline Engine] Sab Se Zyada Biknay Walay Items:**\n\n`
      if (snap.topSelling.length === 0) {
        topReply += `Abhi tak sales history me koi item record nahi hua.`
      } else {
        snap.topSelling.forEach((item, idx) => {
          topReply += `${idx + 1}. **${item.product_name}:** ${item.total_qty} units farokht hue (Kul Revenue: Rs. ${Number(item.total_revenue).toLocaleString()})\n`
        })
      }
      return await saveAndRespond({
        ok: true,
        mode: 'offline',
        engine: 'Zebra Local Intelligence Engine',
        response: topReply.trim(),
      })
    }

    // 12. GENERAL EXECUTIVE SNAPSHOT (Smart Fallback with context & suggestions)
    const totalUdharAll = snap.topDebtors.reduce((a, b) => a + (Number(b.balance) || 0), 0)
    const defaultReply = `⚡ **[Offline Engine] Karobar Ka Real-Time Jaiza:**\n\n` +
      `• **Aaj Ki Sale:** Rs. ${Number(snap.todaySales.total_sales).toLocaleString()} (${snap.todaySales.total_invoices} bills)\n` +
      `• **Cash In Hand (Rokar):** Rs. ${Number(snap.cashInHand).toLocaleString()}\n` +
      `• **Bank Accounts:** Rs. ${Number(snap.bankBalance).toLocaleString()}\n` +
      `• **Market Udhar:** Rs. ${Math.round(totalUdharAll).toLocaleString()} (${snap.topDebtors.length} parties)\n` +
      `• **Low Stock Items:** ${snap.lowStock.length} items short hain\n\n` +
      `💡 *Aap kisi bhi item ka naam (e.g. "Basmati stock") ya customer ka naam (e.g. "Ahsan udhar") likh kar seedha pooch sakte hain.*`

    return await saveAndRespond({
      ok: true,
      mode: 'offline',
      engine: 'Zebra Local Intelligence Engine',
      response: defaultReply,
    })
  } catch (err) {
    console.error('AI query error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
