'use client'

import { useEffect, useMemo, useState } from 'react'

const reports = [
    { key: 'dailySales', label: 'Daily Sales' },
    { key: 'monthlySales', label: 'Monthly Sales' },
    { key: 'yearlySales', label: 'Yearly Sales' },
    { key: 'purchaseReports', label: 'Purchase Reports' },
    { key: 'itemProfit', label: 'Per Item Profit/Loss' },
    { key: 'stockMovements', label: 'Stock Movement History' },
    { key: 'recentTransactions', label: 'Recent Transactions' },
]

function money(value) {
    return Number(value || 0).toLocaleString('en-PK')
}

function downloadCsv(filename, rows) {
    if (!rows?.length) return

    const headers = Object.keys(rows[0])
    const csv = [
        headers.join(','),
        ...rows.map((row) =>
            headers
                .map((h) => `"${String(row[h] ?? '').replaceAll('"', '""')}"`)
                .join(',')
        ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()

    URL.revokeObjectURL(url)
}

export default function ReportsDashboard() {
    const [activeReport, setActiveReport] = useState('dailySales')
    const [profitView, setProfitView] = useState('total') // total | sold
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [itemProfitTab, setItemProfitTab] = useState('all')
    async function loadReports() {
        setLoading(true)
        setError('')

        try {
            const qs = new URLSearchParams()
            if (dateFrom) qs.set('dateFrom', dateFrom)
            if (dateTo) qs.set('dateTo', dateTo)

            const res = await fetch(`/api/reports/all?${qs.toString()}`)
            const json = await res.json()

            if (!res.ok || !json.success) {
                throw new Error(json.message || 'Failed to load reports')
            }

            setData(json.data)
        } catch (err) {
            setError(err.message || 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadReports()
    }, [dateFrom, dateTo])

    const rawRows = data?.[activeReport] || []

    const rows = useMemo(() => {
        if (activeReport !== 'itemProfit') return rawRows

        if (itemProfitTab === 'profit') {
            return rawRows.filter((row) => Number(row.profit_loss || 0) > 0)
        }

        if (itemProfitTab === 'loss') {
            return rawRows.filter((row) => Number(row.profit_loss || 0) < 0)
        }

        return rawRows
    }, [rawRows, activeReport, itemProfitTab])
    const profit = data?.profitSummary || {}

    const stockSummary = data?.stockSummary || {}
    const bankSummary = data?.bankSummary || {}

    const totalSummary = {
        totalSales: profit.total_sales || 0,
        totalPurchases: profit.total_purchases || 0,
        transport: profit.total_transport_expenses || 0,
        grossProfit: profit.gross_profit || 0,
        netProfit: profit.net_profit || 0,
        loss: profit.loss || 0,
    }

    const soldSummary = {
        soldSales: profit.sold_sales || 0,
        soldPurchaseCost: profit.sold_purchase_cost || 0,
        soldGrossProfit: profit.sold_gross_profit || 0,
    }

    const currentSummary = useMemo(() => {
        if (profitView === 'total') {
            return [
                {
                    title: 'Total Sales',
                    subtitle: 'All sales invoices',
                    value: totalSummary.totalSales,
                    className: 'bg-green-50 text-green-800 border-green-200',
                },
                {
                    title: 'Total Purchases',
                    subtitle: 'All purchase invoices',
                    value: totalSummary.totalPurchases,
                    className: 'bg-red-50 text-red-800 border-red-200',
                },
                {
                    title: 'Sales - Purchases',
                    subtitle: 'Gross profit from sold items',
                    value: totalSummary.grossProfit,
                    className:
                        totalSummary.grossProfit >= 0
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-orange-50 text-orange-800 border-orange-200',
                },
                {
                    title: 'Net Profit',
                    subtitle: 'Gross profit - transport',
                    value: totalSummary.netProfit,
                    className:
                        totalSummary.netProfit >= 0
                            ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                            : 'bg-red-50 text-red-800 border-red-200',
                },
                {
                    title: 'Bank Balance',
                    subtitle: `${bankSummary.account_count || 0} bank accounts`,
                    value: bankSummary.bank_balance || 0,
                    className: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                },
                {
                    title: 'Available Stock',
                    subtitle: `${stockSummary.low_stock_count || 0} low stock alerts`,
                    value: stockSummary.available_stock || 0,
                    className: 'bg-gray-50 text-gray-800 border-gray-200',
                    isCount: true,
                },
            ]
        }

        return [
            {
                title: 'Sold Sales',
                subtitle: 'Only sold items sale amount',
                value: soldSummary.soldSales,
                className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            },
            {
                title: 'Sold Purchase Cost',
                subtitle: 'Sold qty × purchase price',
                value: soldSummary.soldPurchaseCost,
                className: 'bg-orange-50 text-orange-800 border-orange-200',
            },
            {
                title: 'Sold Gross Profit',
                subtitle: 'Sold sales - sold cost',
                value: soldSummary.soldGrossProfit,
                className:
                    soldSummary.soldGrossProfit >= 0
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : 'bg-red-50 text-red-800 border-red-200',
            },
            {
                title: 'Transport Expense',
                subtitle: 'Purchase + sales transport',
                value: totalSummary.transport,
                className: 'bg-gray-50 text-gray-800 border-gray-200',
            },
        ]
    }, [profitView, data, rows])

    const columns = rows[0] ? Object.keys(rows[0]) : []

    return (
        <div className="p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Reports</h1>
                    <p className="text-sm text-gray-500">
                        Daily, monthly, yearly sales, purchases, total comparison and sold-item profit.
                    </p>
                </div>

                <div className="flex rounded-xl border bg-white p-1 w-fit">
                    <button
                        type="button"
                        onClick={() => setProfitView('total')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold ${profitView === 'total'
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        Total Sale / Purchase
                    </button>

                    <button
                        type="button"
                        onClick={() => setProfitView('sold')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold ${profitView === 'sold'
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        Sold Profit
                    </button>
                </div>
            </div>

            <div className="grid md:grid-cols-5 gap-4">
                {currentSummary.map((card) => (
                    <div key={card.title} className={`rounded-xl border p-4 ${card.className}`}>
                        <p className="text-sm font-semibold">{card.title}</p>
                        <p className="text-xs opacity-80">{card.subtitle}</p>
                        <p className="text-2xl font-bold mt-2">
                            {card.isCount ? card.value : money(card.value)}
                        </p>
                    </div>
                ))}
            </div>

            <div className="bg-white border rounded-xl p-4 space-y-4">
                <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
                    <div className="flex flex-wrap gap-2">
                        {reports.map((report) => (
                            <button
                                key={report.key}
                                type="button"
                                onClick={() => setActiveReport(report.key)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold ${activeReport === report.key
                                    ? 'bg-gray-900 text-white'
                                    : 'border text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                {report.label}
                            </button>
                        ))}

                    </div>
                    {activeReport === 'itemProfit' && (
                        <div className="flex flex-wrap gap-2 border-t pt-3">
                            <button
                                type="button"
                                onClick={() => setItemProfitTab('all')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold ${itemProfitTab === 'all'
                                    ? 'bg-gray-900 text-white'
                                    : 'border text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                All Items
                            </button>

                            <button
                                type="button"
                                onClick={() => setItemProfitTab('profit')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold ${itemProfitTab === 'profit'
                                    ? 'bg-green-600 text-white'
                                    : 'border text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                Profit Items
                            </button>

                            <button
                                type="button"
                                onClick={() => setItemProfitTab('loss')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold ${itemProfitTab === 'loss'
                                    ? 'bg-red-600 text-white'
                                    : 'border text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                Loss Items
                            </button>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => downloadCsv(
                            activeReport === 'itemProfit'
                                ? `${activeReport}-${itemProfitTab}.csv`
                                : `${activeReport}.csv`,
                            rows
                        )}
                        disabled={!rows.length}
                        className="bg-green-600 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 text-sm"
                    >
                        Download CSV
                    </button>
                </div>

                <div className="grid md:grid-cols-3 gap-2">
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="border rounded px-3 py-2 text-sm"
                    />

                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="border rounded px-3 py-2 text-sm"
                    />

                    <button
                        type="button"
                        onClick={() => {
                            setDateFrom('')
                            setDateTo('')
                        }}
                        className="border rounded px-3 py-2 text-sm hover:bg-gray-50"
                    >
                        Clear Date Filter
                    </button>
                </div>

                <div className="rounded-lg bg-gray-50 border px-4 py-3 text-xs text-gray-600">
                    {profitView === 'total' ? (
                        <span>
                            <b>Total View:</b> Total Sales aur Total Purchases poori invoices ke totals hain.
                        </span>
                    ) : (
                        <span>
                            <b>Sold Profit View:</b> Sirf sold items ka sale amount, purchase cost aur gross
                            profit show hota hai. Cost column: <b>{data?.costColumn || 'purchase_price'}</b>
                        </span>
                    )}
                </div>

                {loading && <div className="p-4 text-sm text-gray-500">Loading reports...</div>}
                {error && <div className="p-4 text-sm text-red-600">{error}</div>}

                {!loading && !error && (
                    <div className="border rounded-xl overflow-hidden">
                        <div className="overflow-auto max-h-[560px]">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100 sticky top-0 z-10">
                                    <tr>
                                        {columns.length === 0 ? (
                                            <th className="px-4 py-3 text-left">No Data</th>
                                        ) : (
                                            columns.map((col) => (
                                                <th key={col} className="px-4 py-3 text-left whitespace-nowrap">
                                                    {col.replaceAll('_', ' ').toUpperCase()}
                                                </th>
                                            ))
                                        )}
                                    </tr>
                                </thead>

                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={Math.max(columns.length, 1)}
                                                className="px-4 py-8 text-center text-gray-500"
                                            >
                                                No report data found.
                                            </td>
                                        </tr>
                                    ) : (
                                        rows.map((row, index) => {
                                            const profitLoss = Number(row.profit_loss || 0)
                                            const isItemProfitReport = activeReport === 'itemProfit'

                                            return (
                                                <tr
                                                    key={index}
                                                    className={`border-t hover:bg-gray-50 ${isItemProfitReport && profitLoss > 0
                                                            ? 'bg-green-50/40'
                                                            : isItemProfitReport && profitLoss < 0
                                                                ? 'bg-red-50/40'
                                                                : ''
                                                        }`}
                                                >
                                                    {columns.map((col) => {
                                                        const value = row[col]

                                                        if (isItemProfitReport && col === 'profit_loss') {
                                                            return (
                                                                <td key={col} className="px-4 py-3 whitespace-nowrap">
                                                                    <span
                                                                        className={`px-2 py-1 rounded text-xs font-semibold ${profitLoss > 0
                                                                                ? 'bg-green-100 text-green-700'
                                                                                : profitLoss < 0
                                                                                    ? 'bg-red-100 text-red-700'
                                                                                    : 'bg-gray-100 text-gray-700'
                                                                            }`}
                                                                    >
                                                                        {profitLoss > 0
                                                                            ? `Profit: ${money(profitLoss)}`
                                                                            : profitLoss < 0
                                                                                ? `Loss: ${money(Math.abs(profitLoss))}`
                                                                                : 'No Profit/Loss'}
                                                                    </span>
                                                                </td>
                                                            )
                                                        }

                                                        if (
                                                            isItemProfitReport &&
                                                            ['sales_amount', 'cost_amount'].includes(col)
                                                        ) {
                                                            return (
                                                                <td key={col} className="px-4 py-3 whitespace-nowrap font-medium">
                                                                    {money(value)}
                                                                </td>
                                                            )
                                                        }

                                                        return (
                                                            <td key={col} className="px-4 py-3 whitespace-nowrap">
                                                                {typeof value === 'number' ? money(value) : value || '-'}
                                                            </td>
                                                        )
                                                    })}
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
