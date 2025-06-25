// app/api/history/summary/route.js
import db from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const rows = await db.query(`
      SELECT 
        DATE_FORMAT(bill_date, '%Y-%m') AS month,
        COUNT(*) AS invoices,
        SUM(net_total) AS revenue,
        SUM(amount_paid) AS paid
      FROM billing_history
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Summary failed' }, { status: 500 });
  }
}
