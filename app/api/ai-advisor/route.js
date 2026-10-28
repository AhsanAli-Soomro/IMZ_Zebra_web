import { NextResponse } from 'next/server'
import db from '@/lib/db'

// Quick helper to fetch real-time financial snapshot from SQLite
async function getFinancialSnapshot() {
  try {
    const todaySales = await db.query(`
      SELECT 
        COALESCE(SUM(net_amount), 0) as total_sales,
        COUNT(*) as total_invoices
      FROM invoices 
      WHERE date(created_at) = date('now')
    `)

    const topDebtors = await db.query(`
      SELECT name, phone, balance 
      FROM customers 
      WHERE balance > 0 
      ORDER BY balance DESC 
      LIMIT 5
    `)

    const topSuppliersPayable = await db.query(`
      SELECT name, phone, balance 
      FROM suppliers 
      WHERE balance > 0 
      ORDER BY balance DESC 
      LIMIT 5
    `)

    const lowStock = await db.query(`
      SELECT name, quantity, min_quantity, unit 
      FROM products 
      WHERE quantity <= COALESCE(min_quantity, 10) AND status = 'active'
      ORDER BY quantity ASC 
      LIMIT 6
    `)

    const monthExpenses = await db.query(`
      SELECT category, COALESCE(SUM(amount), 0) as total 
      FROM expenses 
      WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
      GROUP BY category 
      ORDER BY total DESC
    `)

    const topSelling = await db.query(`
      SELECT 
        product_name, 
        COALESCE(SUM(quantity), 0) as total_qty, 
        COALESCE(SUM(total_price), 0) as total_revenue
      FROM invoice_items
      GROUP BY product_name
      ORDER BY total_qty DESC
      LIMIT 5
    `)

    const cashInHandRow = await db.query(`
      SELECT closing_cash, cash_in_hand 
      FROM daily_ledger 
      ORDER BY id DESC 
      LIMIT 1
    `)

    return {
      todaySales: todaySales?.[0] || { total_sales: 0, total_invoices: 0 },
      topDebtors: topDebtors || [],
      topSuppliersPayable: topSuppliersPayable || [],
      lowStock: lowStock || [],
      monthExpenses: monthExpenses || [],
      topSelling: topSelling || [],
      cashInHand: cashInHandRow?.[0]?.cash_in_hand || cashInHandRow?.[0]?.closing_cash || 0,
    }
  } catch (err) {
    console.error('Error getting financial snapshot:', err)
    return null
  }
}

// GET /api/ai-advisor: Financial health check and anomaly detection
export async function GET() {
  try {
    const snap = await getFinancialSnapshot()
    if (!snap) {
      return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 500 })
    }

    // Identify anomalies
    const anomalies = []

    // 1. Critical Debt Warning
    const totalMarketUdhar = snap.topDebtors.reduce((acc, c) => acc + (c.balance || 0), 0)
    if (totalMarketUdhar > 500000) {
      anomalies.push({
        type: 'warning',
        title: 'High Market Receivables (Udhar)',
        message: `Market me Top 5 customers ka kul udhar Rs. ${totalMarketUdhar.toLocaleString()} hai. Wasooli tez karein.`,
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

    return NextResponse.json({
      ok: true,
      snapshot: snap,
      anomalies,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

// POST /api/ai-advisor: Conversational Query (Dual Engine: Offline SQL NLP + Gemini Online)
export async function POST(req) {
  try {
    const { query, geminiKey } = await req.json()
    if (!query || !query.trim()) {
      return NextResponse.json({ ok: false, message: 'Query is required' }, { status: 400 })
    }

    const q = query.toLowerCase().trim()
    const snap = await getFinancialSnapshot()

    // ----------------------------------------------------
    // ONLINE ENGINE: Google Gemini (if key provided & online)
    // ----------------------------------------------------
    if (geminiKey && geminiKey.trim()) {
      try {
        const promptContext = `
You are Zebra IMS AI Business Advisor for an inventory & billing software in Pakistan (dealing with mills/wholesale/retail).
Always respond in polite, clear Roman Urdu with professional business tone and exact numbers formatted in Pakistani Rupees (Rs.).

Current Real-Time Business Snapshot from SQLite Database:
- Today Sales: Rs. ${snap.todaySales.total_sales.toLocaleString()} (${snap.todaySales.total_invoices} bills)
- Current Cash in Hand / Rokar: Rs. ${Number(snap.cashInHand).toLocaleString()}
- Top Customers with Udhar (Baqaya): ${snap.topDebtors.map(d => `${d.name}: Rs. ${Number(d.balance).toLocaleString()}`).join(', ') || 'None'}
- Top Suppliers Payable (Dena hai): ${snap.topSuppliersPayable.map(s => `${s.name}: Rs. ${Number(s.balance).toLocaleString()}`).join(', ') || 'None'}
- Low Stock Items: ${snap.lowStock.map(l => `${l.name} (${l.quantity} ${l.unit || 'qty'})`).join(', ') || 'Stock full'}
- Top Selling Items: ${snap.topSelling.map(t => `${t.product_name} (${t.total_qty} sold, Rs. ${Number(t.total_revenue).toLocaleString()})`).join(', ') || 'None'}
- Monthly Expenses Total: Rs. ${snap.monthExpenses.reduce((a, b) => a + Number(b.total), 0).toLocaleString()}

User's Question: "${query}"
Provide a direct, accurate, and insightful response strictly based on these real numbers.
`
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey.trim()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptContext }] }],
            }),
            signal: AbortSignal.timeout(6000),
          }
        )
        const geminiData = await geminiRes.json()
        const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          return NextResponse.json({
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
    // OFFLINE ENGINE: Local Smart Intent & Data Matcher (100% Offline)
    // ----------------------------------------------------
    let reply = ''

    if (q.includes('aaj') || q.includes('sale') || q.includes('today') || q.includes('rokar') || q.includes('cash')) {
      reply = `⚡ **[Offline Engine] Aaj Ka Hisab Kitab:**\n\n` +
        `• **Aaj Ki Kul Sale:** Rs. ${Number(snap.todaySales.total_sales).toLocaleString()}\n` +
        `• **Kul Bills / Invoices:** ${snap.todaySales.total_invoices} bills\n` +
        `• **Cash In Hand (Rokar):** Rs. ${Number(snap.cashInHand).toLocaleString()}\n\n` +
        `Aapki dukan ka hisab rokar ledger me match kar raha hai.`
    } else if (q.includes('udhar') || q.includes('customer') || q.includes('balance') || q.includes('baqaya')) {
      reply = `⚡ **[Offline Engine] Top Baqaya Udhar Walay Customers:**\n\n`
      if (snap.topDebtors.length === 0) {
        reply += `MashaAllah! Kisi bhi customer ka udhar baqaya nahi hai.`
      } else {
        snap.topDebtors.forEach((c, idx) => {
          reply += `${idx + 1}. **${c.name}:** Rs. ${Number(c.balance).toLocaleString()} ${c.phone ? `(${c.phone})` : ''}\n`
        })
        const total = snap.topDebtors.reduce((a, b) => a + Number(b.balance), 0)
        reply += `\n**Kul Top Udhar:** Rs. ${total.toLocaleString()}`
      }
    } else if (q.includes('supplier') || q.includes('dena') || q.includes('payable')) {
      reply = `⚡ **[Offline Engine] Suppliers Ko Adaigi (Payables):**\n\n`
      if (snap.topSuppliersPayable.length === 0) {
        reply += `Kisi bhi supplier ka baqaya wajib-ul-ada nahi hai.`
      } else {
        snap.topSuppliersPayable.forEach((s, idx) => {
          reply += `${idx + 1}. **${s.name}:** Rs. ${Number(s.balance).toLocaleString()}\n`
        })
      }
    } else if (q.includes('stock') || q.includes('maal') || q.includes('kam') || q.includes('khatam') || q.includes('low')) {
      reply = `⚡ **[Offline Engine] Low Stock Alert (Mal Khatam Hone Wala Hai):**\n\n`
      if (snap.lowStock.length === 0) {
        reply += `Sabhi items ka stock behtareen level par hai. Koi item short nahi hai.`
      } else {
        snap.lowStock.forEach((item, idx) => {
          reply += `${idx + 1}. **${item.name}:** Sirf **${item.quantity} ${item.unit || 'units'}** baqi hain (Reorder limit: ${item.min_quantity || 10})\n`
        })
        reply += `\nIn items ka naya Purchase Order bana lein.`
      }
    } else if (q.includes('kharcha') || q.includes('expense') || q.includes('expenses')) {
      const expTotal = snap.monthExpenses.reduce((a, b) => a + Number(b.total), 0)
      reply = `⚡ **[Offline Engine] Is Mahine Ka Kharcha:**\n\n` +
        `• **Kul Mahana Kharcha:** Rs. ${expTotal.toLocaleString()}\n\n` +
        `**Category Wise Breakdown:**\n`
      snap.monthExpenses.forEach((exp) => {
        reply += `• **${exp.category}:** Rs. ${Number(exp.total).toLocaleString()}\n`
      })
    } else if (q.includes('top') || q.includes('fast') || q.includes('zyada') || q.includes('selling') || q.includes('bika')) {
      reply = `⚡ **[Offline Engine] Sab Se Zyada Biknay Walay Items:**\n\n`
      snap.topSelling.forEach((item, idx) => {
        reply += `${idx + 1}. **${item.product_name}:** ${item.total_qty} units farokht hue (Rs. ${Number(item.total_revenue).toLocaleString()})\n`
      })
    } else {
      // General Executive Overview
      reply = `⚡ **[Offline Engine] Karobar Ka Mukhtasar Jaiza (Executive Summary):**\n\n` +
        `• **Aaj Ki Sale:** Rs. ${Number(snap.todaySales.total_sales).toLocaleString()} (${snap.todaySales.total_invoices} bills)\n` +
        `• **Cash In Hand:** Rs. ${Number(snap.cashInHand).toLocaleString()}\n` +
        `• **Short Stock Items:** ${snap.lowStock.length} items low hain\n` +
        `• **Top Udhar:** ${snap.topDebtors?.[0]?.name || 'None'} (Rs. ${Number(snap.topDebtors?.[0]?.balance || 0).toLocaleString()})\n\n` +
        `Aap kisi bhi cheez ke baare me pooch sakte hain: "aaj ki sale", "udhar list", "low stock", ya "kharcha".`
    }

    return NextResponse.json({
      ok: true,
      mode: 'offline',
      engine: 'Local Database Rule Engine',
      response: reply,
    })
  } catch (err) {
    console.error('AI query error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
