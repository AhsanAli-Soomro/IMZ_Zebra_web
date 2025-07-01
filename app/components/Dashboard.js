'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import '@/lib/chart-setup'

import DailyLineChart from './charts/DailyLineChart'
import MonthlyBarChart from './charts/MonthlyBarChart'
import YearlyBarChart from './charts/YearlyBarChart'
import YearlySummaryTable from './charts/YearlySummaryTable'
import MonthlyDoughnutChart from './charts/MonthlyDoughnutChart'
import YearlyDoughnutChart from './charts/YearlyDoughnutChart'
import ChartBox from './charts/ChartBox'
import TopProductsChart from './charts/TopProductsChart'
import TopSellingTable from './charts/TopSellingTable'
import MonthlySummaryTable from './charts/MonthlySummaryTable'

export default function DashboardPage() {
    const [monthly, setMonthly] = useState([])
    const [yearly, setYearly] = useState([])
    const [daily, setDaily] = useState([])
    const [total, setTotal] = useState({})
    const [topProducts, setTopProducts] = useState([])

    useEffect(() => {
        const fetch = async () => {
            const [m, y, d, t, top] = await Promise.all([
                axios.get('/api/reports/monthly'),
                axios.get('/api/reports/yearly'),
                axios.get('/api/reports/daily-growth'),
                axios.get('/api/reports/total-summary'),
                axios.get('/api/reports/top-products')
            ])

            setMonthly(m.data.data.reverse())
            setYearly(y.data.data.reverse())
            setDaily(d.data.data)
            setTopProducts(top.data.data)
            setTotal(t.data.data)
        }

        fetch()
    }, [])

    const cards = [
        { label: 'Invoices', value: total.total_invoices, color: 'from-blue-400 to-blue-600', icon: '📄' },
        { label: 'Revenue', value: total.total_revenue, color: 'from-green-400 to-green-600', icon: '💰' },
        { label: 'Profit', value: total.total_profit, color: 'from-yellow-400 to-yellow-500', icon: '📈' },
        { label: 'Products Sold', value: total.total_products_sold, color: 'from-pink-400 to-pink-600', icon: '🛒' },
    ]

    return (
        <div className="p-6 bg-gray-100 min-h-screen space-y-10">
            <h1 className="text-3xl font-bold text-gray-800">📊 Sales Dashboard</h1>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {cards.map(({ label, value, color, icon }, idx) => (
                    <div
                        key={idx}
                        className={`bg-gradient-to-br ${color} text-white rounded-xl p-5 shadow-md flex items-center gap-4`}
                    >
                        <div className="text-4xl">{icon}</div>
                        <div>
                            <div className="text-sm uppercase tracking-widest">{label}</div>
                            <div className="text-2xl font-bold">
                                {value != null ? Number(value).toLocaleString() : '...'}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <ChartBox title="📈 Daily Revenue & Profit">
                <DailyLineChart data={daily} />
            </ChartBox>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ChartBox title="🍩 Monthly Revenue Share">
                    <MonthlyDoughnutChart data={monthly} />
                </ChartBox>
                <ChartBox title="📊 Monthly Revenue & Profit">
                    <MonthlyBarChart data={monthly} />
                </ChartBox>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ChartBox title="🧁 Yearly Revenue Share">
                    <YearlyDoughnutChart data={yearly} />
                </ChartBox>
                <ChartBox title="📅 Yearly Revenue & Profit">
                    <YearlyBarChart data={yearly} />
                </ChartBox>
            </div>

            <ChartBox title="🔥 Top Selling Products">
                <TopProductsChart data={topProducts} />
            </ChartBox>

            <TopSellingTable data={topProducts} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MonthlySummaryTable data={monthly} />
                <YearlySummaryTable data={yearly} />
            </div>
        </div>
    )
}
