import db from '@/lib/db'
import { NextResponse } from 'next/server'

const clean = (value) => String(value ?? '').trim()

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateFrom = clean(searchParams.get('dateFrom'))
    const dateTo = clean(searchParams.get('dateTo'))
    const storeId = Number(searchParams.get('storeId') || 0)

    const dateConditions = []
    const dateParams = []
    if (dateFrom) {
      dateConditions.push('date(sm.movement_date) >= date(?)')
      dateParams.push(dateFrom)
    }
    if (dateTo) {
      dateConditions.push('date(sm.movement_date) <= date(?)')
      dateParams.push(dateTo)
    }
    const dateSql = dateConditions.length ? `AND ${dateConditions.join(' AND ')}` : ''

    if (storeId) {
      const data = await db.query(`
        SELECT
          sm.id,
          sm.movement_date,
          sm.movement_type,
          sm.qty,
          sm.reference_type,
          sm.reference_id,
          sm.notes,
          COALESCE(sm.store_name, st.name, s.store_name, 'Unassigned') AS store_name,
          s.item_code,
          s.item_name,
          s.weight,
          s.weight_unit,
          CASE WHEN sm.movement_type IN ('purchase_in', 'sale_return_in', 'adjustment_in', 'opening_stock') THEN 'in' ELSE 'out' END AS direction
        FROM stock_movements sm
        INNER JOIN stocks s ON s.id = sm.stock_id
        LEFT JOIN stores st ON st.id = sm.store_id
        WHERE COALESCE(sm.store_id, s.store_id) = ? ${dateSql}
        ORDER BY date(sm.movement_date) DESC, sm.id DESC
      `, [storeId, ...dateParams])

      return NextResponse.json({ success: true, data })
    }

    const data = await db.query(`
      SELECT
        st.id AS store_id,
        st.store_code,
        st.name AS store_name,
        st.address,
        COUNT(DISTINCT CASE WHEN s.deleted_at IS NULL OR s.deleted_at = '' THEN s.id END) AS stock_items,
        COALESCE(SUM(CASE WHEN s.deleted_at IS NULL OR s.deleted_at = '' THEN s.quantity ELSE 0 END), 0) AS current_quantity,
        COALESCE(m.in_quantity, 0) AS in_quantity,
        COALESCE(m.out_quantity, 0) AS out_quantity,
        COALESCE(m.movement_count, 0) AS movement_count
      FROM stores st
      LEFT JOIN stocks s ON s.store_id = st.id
      LEFT JOIN (
        SELECT
          COALESCE(sm.store_id, source.store_id) AS store_id,
          SUM(CASE WHEN sm.movement_type IN ('purchase_in', 'sale_return_in', 'adjustment_in', 'opening_stock') THEN sm.qty ELSE 0 END) AS in_quantity,
          SUM(CASE WHEN sm.movement_type IN ('sale_out', 'purchase_return_out', 'adjustment_out', 'damage_out') THEN sm.qty ELSE 0 END) AS out_quantity,
          COUNT(*) AS movement_count
        FROM stock_movements sm
        LEFT JOIN stocks source ON source.id = sm.stock_id
        WHERE 1 = 1 ${dateSql}
        GROUP BY COALESCE(sm.store_id, source.store_id)
      ) m ON m.store_id = st.id
      WHERE st.deleted_at IS NULL OR st.deleted_at = ''
      GROUP BY st.id, st.store_code, st.name, st.address, m.in_quantity, m.out_quantity, m.movement_count
      ORDER BY st.name COLLATE NOCASE
    `, dateParams)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Store history could not be loaded.' },
      { status: 500 }
    )
  }
}
