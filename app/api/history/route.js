// app/api/history/route.js
import db from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const rows = await db.query(`
      SELECT 
        c.id AS customer_id,
        c.name AS customer_name,
        c.phone,
        c.address,
        b.invoice_no,
        b.total_amount,
        b.discount_amount,
        b.net_total,
        b.amount_paid,
        b.bill_date,
        b.payment_date
      FROM billing_history b
      JOIN customers c ON b.customer_id = c.id
      ORDER BY b.bill_date DESC
    `);

        const grouped = {};
        for (const row of rows) {
            const custId = row.customer_id;
            if (!grouped[custId]) {
                grouped[custId] = {
                    customer_id: row.customer_id,
                    customer_name: row.customer_name,
                    phone: row.phone,
                    address: row.address,
                    bills: [],
                };
            }

            grouped[custId].bills.push({
                invoice_no: row.invoice_no,
                total_amount: row.total_amount,
                discount_amount: row.discount_amount,
                net_total: row.net_total,
                amount_paid: row.amount_paid,
                bill_date: row.bill_date,
                payment_date: row.payment_date,
            });
        }

        const result = Object.values(grouped).map(cust => {
            const total_net = cust.bills.reduce((sum, b) =>
                sum + (b.net_total || (b.total_amount - (b.discount_amount || 0))), 0);
            const total_paid = cust.bills.reduce((sum, b) => sum + Number(b.amount_paid || 0), 0);
            const total_remaining = total_net - total_paid;
            const last_payment_date = cust.bills[0]?.payment_date || null;

            return {
                ...cust,
                total_net,
                total_paid,
                total_remaining,
                last_payment_date,
                bills: cust.bills.map(b => ({
                    ...b,
                    calculated_net: b.calculated_net
                }))
            };
        });

        return NextResponse.json({ success: true, data: result });
    } catch (err) {
        console.error('Billing history error:', err);
        return NextResponse.json({ success: false, error: 'Failed to fetch history' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const {
            customer_id,
            invoice_no,
            total_amount,
            discount_amount,
            net_total,
            amount_paid,
            bill_date,
            payment_date
        } = body;

        await db.query(
            `INSERT INTO billing_history 
      (customer_id, invoice_no, total_amount, discount_amount, net_total, amount_paid, bill_date, payment_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [customer_id, invoice_no, total_amount, discount_amount, net_total, amount_paid, bill_date, payment_date]
        );

        return NextResponse.json({ success: true, message: 'History added' });
    } catch (err) {
        console.error('History insert error:', err);
        return NextResponse.json({ success: false, error: 'Failed to create history' }, { status: 500 });
    }
}
