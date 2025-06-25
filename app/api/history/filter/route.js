// app/api/history/filter/route.js
import db from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const { startDate, endDate, customerId, category } = await req.json();

  let sql = `
    SELECT 
      b.*, c.name AS customer_name, c.phone
    FROM billing_history b
    LEFT JOIN customers c ON b.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (startDate && endDate) {
    sql += ` AND b.bill_date BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  if (customerId) {
    sql += ` AND b.customer_id = ?`;
    params.push(customerId);
  }

  if (category) {
    sql += ` AND EXISTS (
      SELECT 1 FROM bills bs
      WHERE bs.invoice_no = b.invoice_no AND JSON_CONTAINS(bs.items, JSON_QUOTE(?), '$[*].category')
    )`;
    params.push(category);
  }

  sql += ` ORDER BY b.bill_date DESC`;

  try {
    const rows = await db.query(sql, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Filter error:', error);
    return NextResponse.json({ success: false, message: 'Filter failed' }, { status: 500 });
  }
}
