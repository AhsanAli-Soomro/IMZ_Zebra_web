import db from '@/lib/db'

export async function GET() {
    try {
        const bills = await db.query('SELECT items FROM bills')
        const salesMap = new Map()

        for (const bill of bills) {
            try {
                const items = eval(bill.items) // ⚠️ only if it's your trusted internal data

                if (!Array.isArray(items)) continue

                for (const item of items) {
                    const id = item.id
                    if (!salesMap.has(id)) {
                        salesMap.set(id, {
                            id,
                            item_name: item.item_name,
                            total_qty: 0,
                            total_amount: 0,
                            total_profit: 0,
                        })
                    }

                    const entry = salesMap.get(id)
                    const qty = Number(item.qty || 0)
                    const sell = parseFloat(item.selling_price || '0')
                    const buy = parseFloat(item.purchase_price || '0')

                    const profit = qty * (sell - buy)

                    entry.total_qty += qty
                    entry.total_amount += qty * sell
                    entry.total_profit += profit

                }
            } catch (e) {
                console.error('⚠️ Failed to eval items:', bill.items)
            }
        }

        const sorted = Array.from(salesMap.values())
            .sort((a, b) => b.total_qty - a.total_qty)
            .slice(0, 10)

        return Response.json({ success: true, data: sorted })
    } catch (err) {
        console.error('Top products API error:', err)
        return Response.json({ success: false, error: 'Failed to fetch' }, { status: 500 })
    }
}
