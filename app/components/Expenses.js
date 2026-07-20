'use client'

import React, { useState, useEffect } from 'react'
import Select from 'react-select'

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState([])
    const [filteredExpenses, setFilteredExpenses] = useState([])
    const [loading, setLoading] = useState(true)

    // Filter state
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null)

    // Form & Modal states
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [formData, setFormData] = useState({
        expense_date: new Date().toISOString().split('T')[0],
        category: '',
        amount: '',
        payment_method: 'Cash',
        notes: '',
    })

    // Pakistani Market Categories
    const categoryOptions = [
        { value: 'Groceries / Rashan', label: 'Groceries / Rashan' },
        { value: 'Utilities (Electricity/Gas/Water)', label: 'Utilities (Electricity/Gas/Water)' },
        { value: 'Fuel / Bike / Car Maintenance', label: 'Fuel / Bike / Car Maintenance' },
        { value: 'Rent / Maintenance', label: 'Rent / Maintenance' },
        { value: 'Dine Out / Chai / Foodpanda', label: 'Dine Out / Chai / Foodpanda' },
        { value: 'Mobile Load / Internet', label: 'Mobile Load / Internet' },
        { value: 'Medical / Healthcare', label: 'Medical / Healthcare' },
        { value: 'Miscellaneous / Other', label: 'Miscellaneous / Other' },
    ]

    // Pakistani Payment Options
    const paymentOptions = [
        { value: 'Cash', label: 'Cash' },
        { value: 'Easypaisa / JazzCash', label: 'Easypaisa / JazzCash' },
        { value: 'Bank Transfer (Nayapay/SadaPay/Meezan)', label: 'Bank Transfer (Nayapay/SadaPay/Meezan)' },
        { value: 'Credit / Debit Card', label: 'Credit / Debit Card' },
    ]

    const fetchExpenses = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/expenses')
            const result = await res.json()
            if (result.success) {
                setExpenses(result.data)
                setFilteredExpenses(result.data)
            }
        } catch (err) {
            console.error('Failed to load expenses:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchExpenses()
    }, [])

    useEffect(() => {
        if (!selectedCategoryFilter) {
            setFilteredExpenses(expenses)
        } else {
            setFilteredExpenses(
                expenses.filter(exp => exp.category === selectedCategoryFilter.value)
            )
        }
    }, [selectedCategoryFilter, expenses])

    const handleSubmit = async (e) => {
        e.preventDefault()
        const method = editingId ? 'PUT' : 'POST'
        const payload = editingId ? { ...formData, id: editingId } : formData

        try {
            const res = await fetch('/api/expenses', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const result = await res.json()

            if (result.success) {
                fetchExpenses()
                closeModal()
            } else {
                alert(result.message || 'Kuch galat ho gaya.')
            }
        } catch (err) {
            console.error('Error saving expense:', err)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Kya aap waqai yeh expense delete karna chahte hain?')) return

        try {
            const res = await fetch('/api/expenses', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            })
            const result = await res.json()

            if (result.success) {
                fetchExpenses()
            } else {
                alert(result.message || 'Delete nahi ho saka.')
            }
        } catch (err) {
            console.error('Error deleting expense:', err)
        }
    }

    const handleEditClick = (expense) => {
        setEditingId(expense.id)
        setFormData({
            expense_date: expense.expense_date ? expense.expense_date.split('T')[0] : '',
            category: expense.category,
            amount: expense.amount,
            payment_method: expense.payment_method,
            notes: expense.notes || '',
        })
        setIsModalOpen(true)
    }

    const closeModal = () => {
        setIsModalOpen(false)
        setEditingId(null)
        setFormData({
            expense_date: new Date().toISOString().split('T')[0],
            category: '',
            amount: '',
            payment_method: 'Cash',
            notes: '',
        })
    }

    const totalAmount = filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0)

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-12">
            <div className="max-w-6xl mx-auto">

                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Expense Tracker</h1>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">Apne rozana ke kharche asani se manage karein.</p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-3 sm:py-2.5 rounded-xl shadow-sm transition-colors text-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Naya Expense Add Karein
                    </button>
                </div>

                {/* Stats Card & Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
                    {/* Total Box */}
                    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider">Kul Akhrajaat (Total)</p>
                            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                                Rs. {totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 0 })}
                            </h3>
                        </div>
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hidden sm:block">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6A2.25 2.25 0 0 1 18.75 20.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9A2.25 2.25 0 0 0 18.75 6.75H5.25A2.25 2.25 0 0 0 3 9v3M9 3h6" />
                            </svg>
                        </div>
                    </div>

                    {/* Filter Dropdown */}
                    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm md:col-span-2 flex flex-col justify-center">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                            Category Ke Mutabiq Filter Karein
                        </label>
                        <div className="flex items-center gap-3">
                            <div className="w-full">
                                <Select
                                    options={categoryOptions}
                                    value={selectedCategoryFilter}
                                    onChange={setSelectedCategoryFilter}
                                    isClearable
                                    placeholder="Tamam Categories"
                                    className="react-select-container text-sm"
                                    classNamePrefix="react-select"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Expenses List Component (Desktop: Table, Mobile: Card List) */}
                {loading ? (
                    <div className="bg-white p-12 rounded-2xl text-center border text-gray-500">Kharche load ho rahe hain...</div>
                ) : filteredExpenses.length === 0 ? (
                    <div className="bg-white p-12 rounded-2xl text-center border text-gray-400">Kharchon ka koi record nahi mila.</div>
                ) : (
                    <>
                        {/* 1. MOBILE RESPONSIVE CARD VIEW (Visible only on smaller screens) */}
                        <div className="grid grid-cols-1 gap-4 md:hidden">
                            {filteredExpenses.map((expense) => (
                                <div key={expense.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 mb-2">
                                                {expense.category}
                                            </span>
                                            <p className="text-xs text-gray-400 font-medium">
                                                {new Date(expense.expense_date).toLocaleDateString('en-GB', {
                                                    year: 'numeric', month: 'short', day: 'numeric'
                                                })}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-gray-900">Rs. {Number(expense.amount).toLocaleString('en-PK')}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">{expense.payment_method}</p>
                                        </div>
                                    </div>

                                    {expense.notes && (
                                        <div className="text-sm text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-100 italic">
                                            "{expense.notes}"
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                                        <button
                                            onClick={() => handleEditClick(expense)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                            </svg>
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(expense.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                            </svg>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 2. DESKTOP/TABLET VIEW (Ab tablet screens par bhi wrap nahi hoga) */}
                        <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
                                            <th className="py-4 px-6">Tareekh (Date)</th>
                                            <th className="py-4 px-6">Category</th>
                                            <th className="py-4 px-6">Payment Method</th>
                                            <th className="py-4 px-6">Tafseel (Notes)</th>
                                            <th className="py-4 px-6 text-right">Raqam (Amount)</th>
                                            <th className="py-4 px-6 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                                        {filteredExpenses.map((expense) => (
                                            <tr key={expense.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="py-4 px-6 whitespace-nowrap font-medium text-gray-900">
                                                    {new Date(expense.expense_date).toLocaleDateString('en-GB', {
                                                        year: 'numeric', month: 'short', day: 'numeric'
                                                    })}
                                                </td>
                                                <td className="py-4 px-6 whitespace-nowrap">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                                                        {expense.category}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 whitespace-nowrap text-gray-500">{expense.payment_method}</td>
                                                <td className="py-4 px-6 max-w-xs truncate text-gray-400" title={expense.notes}>
                                                    {expense.notes || '—'}
                                                </td>
                                                <td className="py-4 px-6 text-right font-semibold text-gray-900 whitespace-nowrap">
                                                    Rs. {Number(expense.amount).toLocaleString('en-PK')}
                                                </td>
                                                <td className="py-4 px-6 text-center whitespace-nowrap">
                                                    <div className="flex justify-center gap-2">
                                                        <button
                                                            onClick={() => handleEditClick(expense)}
                                                            className="p-1.5 text-gray-400 hover:text-amber-600 rounded-md hover:bg-amber-50 transition-colors"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(expense.id)}
                                                            className="p-1.5 text-gray-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {/* RESPONSIVE FULL SCREEN / SLIDEOVER MODAL */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
                        <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-[90vh] sm:max-h-[none] flex flex-col">

                            <div className="flex items-center justify-between bg-gray-50 px-6 py-4 border-b border-gray-100 shrink-0">
                                <h2 className="text-lg font-bold text-gray-900">
                                    {editingId ? 'Expense Tabdeel Karein' : 'Naya Expense Likhein'}
                                </h2>
                                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 rounded-lg p-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tareekh (Date)</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.expense_date}
                                        onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Category Select Karein</label>
                                    <Select
                                        options={categoryOptions}
                                        value={categoryOptions.find(opt => opt.value === formData.category) || null}
                                        onChange={(opt) => setFormData({ ...formData, category: opt ? opt.value : '' })}
                                        placeholder="Select karein..."
                                        className="text-sm"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Raqam (PKR)</label>
                                        <input
                                            type="number"
                                            required
                                            placeholder="0"
                                            value={formData.amount}
                                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Payment Method</label>
                                        <Select
                                            options={paymentOptions}
                                            value={paymentOptions.find(opt => opt.value === formData.payment_method) || null}
                                            onChange={(opt) => setFormData({ ...formData, payment_method: opt ? opt.value : 'Cash' })}
                                            className="text-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tafseel / Wajah (Notes)</label>
                                    <textarea
                                        rows="3"
                                        placeholder="Kharche ki mazed tafseel (optional)..."
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors resize-none text-sm"
                                    ></textarea>
                                </div>

                                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-gray-100 shrink-0">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-colors"
                                    >
                                        {editingId ? 'Tabdeeli Save Karein' : 'Save Karein'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}