// app/api/history/export/route.js
import db from '@/lib/db';
import { NextResponse } from 'next/server';
import { Parser } from 'json2csv';

export async function GET() {
  try {
    const rows = await db.query(`
      SELECT 
        b.invoice_no, b.customer_id, c.name AS customer_name, c.phone,
        b.total_amount, b.discount_amount, b.net_total,
        b.amount_paid, b.bill_date, b.payment_date
      FROM billing_history b
      LEFT JOIN customers c ON c.id = b.customer_id
      ORDER BY b.bill_date DESC
    `);

    const parser = new Parser();
    const csv = parser.parse(rows);

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=invoice-history.csv',
      },
    });
  } catch (err) {
    console.error('CSV export error:', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
