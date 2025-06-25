'use client';
import React, { useEffect, useState } from 'react';
import axios from 'axios';

function History() {
    const [history, setHistory] = useState([]);
    const [expandedCustomerId, setExpandedCustomerId] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const toggleDropdown = (customerId) => {
        setActiveDropdown(prev => (prev === customerId ? null : customerId));
    };
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showModal, setShowModal] = useState(false);
    useEffect(() => {
        if (showModal) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [showModal])


    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await axios.get('/api/history'); // must return detailed bills
                setHistory(res.data.data);
            } catch (err) {
                console.error('Error fetching history:', err);
            }
        };

        fetchHistory();
    }, []);

    const toggleExpand = (id) => {
        setExpandedCustomerId(prev => (prev === id ? null : id));
    };

    const exportCSV = async () => {
        try {
            const res = await axios.get('/api/history/export')
            const blob = new Blob([res.data], { type: 'text/csv' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'invoice-history.csv'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
        } catch (err) {
            alert('Failed to export CSV')
            console.error(err)
        }
    }

    const generatePDF = async (cust) => {
        const html2pdf = (await import('html2pdf.js')).default;

        const totalNet = cust.bills.reduce((sum, b) => {
            const net = b.net_total ?? (b.total_amount - (b.discount_amount || 0));
            return sum + (Number(net) || 0);
        }, 0);

        const totalPaid = cust.bills.reduce((sum, b) => sum + (Number(b.amount_paid) || 0), 0);
        const totalRemaining = totalNet - totalPaid;

        const htmlContent = `
    <div style="font-family: sans-serif; padding: 20px; max-width: 800px; lineHeight: 10;">
      <h2 style="color: #2c3e50; font-size: 18px; font-weight: bold; line-height: 3; border-bottom: 2px solid #3498db;">${cust.customer_name} - Billing Summary</h2>
      <p><strong>Phone:</strong> ${cust.phone}</p>
      <p><strong>Address:</strong> ${cust.address || '—'}</p>

      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead style="background: #3498db; color: white;">
          <tr>
            <th style="border: 1px solid #ddd; padding: 8px;">Date</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Invoice No</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Total</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Discount</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Paid</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Remaining</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Paid On</th>
          </tr>
        </thead>
        <tbody>
          ${cust.bills.map(bill => {
            const net = bill.net_total ?? (bill.total_amount - (bill.discount_amount || 0));
            const remaining = net - bill.amount_paid;
            return `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${new Date(bill.bill_date).toLocaleDateString()}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${bill.invoice_no}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">Rs ${Number(bill.total_amount).toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">Rs ${Number(bill.discount_amount || 0).toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">Rs ${Number(bill.amount_paid).toFixed(2)}</td>
                <td style="border: 1px solid #ccc; padding: 6px; color: ${remaining < 0 ? 'green' : 'red'};">
                    Rs ${remaining.toFixed(2)}
                </td>

                <td style="border: 1px solid #ddd; padding: 8px;">${bill.payment_date ? new Date(bill.payment_date).toLocaleDateString() : '—'
                }</td>
              </tr>
            `;
        }).join('')}
        </tbody>
      </table>

      <div style="margin-top: 20px; font-weight: bold;">
        <p>Total Billed: Rs ${totalNet.toFixed(2)}</p>
        <p>Total Paid: Rs ${totalPaid.toFixed(2)}</p>
        <p style="color: red;">Remaining: Rs ${totalRemaining.toFixed(2)}</p>
      </div>
    </div>
  `;

        html2pdf().set({
            margin: 0.5,
            filename: `${cust.customer_name}_Billing_History.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        }).from(htmlContent).save();
    };


    const generateAllPDFs = async () => {
        const html2pdf = (await import('html2pdf.js')).default;

        const fullHtml = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px;">
        ${history.map((cust, index) => {
            const totalNet = cust.bills?.reduce((sum, b) => {
                const net = b.net_total ?? (b.total_amount - (b.discount_amount || 0));
                return sum + (Number(net) || 0);
            }, 0) || 0;

            const totalPaid = cust.bills?.reduce((sum, b) => sum + (Number(b.amount_paid) || 0), 0) || 0;
            const totalRemaining = totalNet - totalPaid;

            const billRows = cust.bills.map(bill => {
                const net = bill.net_total ?? (bill.total_amount - (bill.discount_amount || 0));
                const remaining = net - bill.amount_paid;

                return `
                    <tr>
                        <td style="border: 1px solid #ccc; padding: 6px;">${new Date(bill.bill_date).toLocaleDateString()}</td>
                        <td style="border: 1px solid #ccc; padding: 6px;">${bill.invoice_no}</td>
                        <td style="border: 1px solid #ccc; padding: 6px;">Rs ${Number(bill.total_amount).toFixed(2)}</td>
                        <td style="border: 1px solid #ccc; padding: 6px;">Rs ${Number(bill.discount_amount || 0).toFixed(2)}</td>
                        <td style="border: 1px solid #ccc; padding: 6px;">Rs ${Number(bill.amount_paid).toFixed(2)}</td>
                        <td style="border: 1px solid #ccc; padding: 6px; color: ${remaining < 0 ? 'green' : 'red'};">
                           Rs ${remaining.toFixed(2)}
                        </td>

                        <td style="border: 1px solid #ccc; padding: 6px;">${bill.payment_date ? new Date(bill.payment_date).toLocaleDateString() : '—'}</td>
                    </tr>
                `;
            }).join('');

            return `
                <div style="margin-bottom: 60px;">
                    <h2 style="color: #2c3e50; font-size: 18px; font-weight: bold; line-height: 3; border-bottom: 2px solid #3498db;">${index + 1}. ${cust.customer_name}</h2>
                    <p><strong>Phone:</strong> ${cust.phone}</p>
                    <p><strong>Address:</strong> ${cust.address || '—'}</p>

                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px;">
                        <thead style="background-color: #3498db; color: white;">
                            <tr>
                                <th style="border: 1px solid #ccc; padding: 6px;">Date</th>
                                <th style="border: 1px solid #ccc; padding: 6px;">Invoice No</th>
                                <th style="border: 1px solid #ccc; padding: 6px;">Total</th>
                                <th style="border: 1px solid #ccc; padding: 6px;">Discount</th>
                                <th style="border: 1px solid #ccc; padding: 6px;">Paid</th>
                                <th style="border: 1px solid #ccc; padding: 6px;">Remaining</th>
                                <th style="border: 1px solid #ccc; padding: 6px;">Paid On</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${billRows}
                        </tbody>
                    </table>

                    <div style="margin-top: 15px; font-weight: bold;">
                        <p>Total Billed: Rs ${totalNet.toFixed(2)}</p>
                        <p>Total Paid: Rs ${totalPaid.toFixed(2)}</p>
                        <p style="color: red;">Remaining: Rs ${totalRemaining.toFixed(2)}</p>
                    </div>
                </div>

            `;
        }).join('')}
    </div>`;

        html2pdf().set({
            margin: 0.5,
            filename: `All_Customers_Billing_History.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        }).from(fullHtml).save();
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">Customer Billing History</h2>

            <div className="flex justify-end mb-4 gap-2">
                <button
                    onClick={generateAllPDFs}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-2 rounded-md shadow hover:from-blue-600 hover:to-indigo-700 transition"
                >
                    Download Full Histories (PDF)
                </button>
            <button
                onClick={exportCSV}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
                Export CSV
            </button>
            </div>


            <div className="overflow-x-auto">
                <table className="w-full text-sm bg-white shadow-lg rounded-lg overflow-hidden">
                    <thead className="bg-indigo-600 text-white">
                        <tr>
                            <th className="p-3 text-left">Name</th>
                            <th className="p-3 text-left">Phone</th>
                            <th className="p-3 text-left">Total Billed</th>
                            <th className="p-3 text-left">Total Paid</th>
                            <th className="p-3 text-left">Remaining</th>
                            <th className="p-3 text-left">Last Payment</th>
                            <th className="p-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((cust, i) => {
                            const totalNet = cust.bills?.reduce((sum, b) => {
                                const net = b.net_total ?? (b.total_amount - (b.discount_amount || 0));
                                return sum + (Number(net) || 0);
                            }, 0) || 0;

                            const totalPaid = cust.bills?.reduce((sum, b) => sum + (Number(b.amount_paid) || 0), 0) || 0;
                            const totalRemaining = totalNet - totalPaid;

                            return (
                                <React.Fragment key={i}>
                                    <tr
                                        onClick={() => {
                                            setSelectedCustomer(cust);
                                            setShowModal(true);
                                            setActiveDropdown(null);
                                        }}
                                        className={`hover:bg-indigo-50 transition cursor-pointer duration-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                        <td className="p-3">{cust.customer_name}</td>
                                        <td className="p-3">{cust.phone}</td>
                                        <td className="p-3 text-blue-700 font-semibold">Rs {totalNet.toFixed(2)}</td>
                                        <td className="p-3 text-green-700 font-semibold">Rs {totalPaid.toFixed(2)}</td>
                                        <td className={`p-3 font-semibold ${totalRemaining < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            Rs {totalRemaining.toFixed(2)}
                                        </td>
                                        <td className="p-3">{cust.last_payment_date ? new Date(cust.last_payment_date).toLocaleDateString() : '—'}</td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end items-center">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        generatePDF(cust);
                                                        setActiveDropdown(null);
                                                    }}
                                                    className="hover:bg-green-50 px-3 py-1 rounded-md text-sm text-green-600 border border-green-100 transition"
                                                >
                                                    Download PDF
                                                </button>
                                            </div>
                                        </td>

                                    </tr>


                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>

                {showModal && selectedCustomer && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
                        tabIndex={-1}
                        onKeyDown={(e) => e.key === 'Escape' && setShowModal(false)}
                    >
                        <div className="bg-white w-full max-w-5xl max-h-[90vh] mx-4 rounded-lg shadow-2xl overflow-hidden animate-slide-up relative">
                            {/* Header */}
                            <div className="flex justify-between items-center px-5 py-4 border-b bg-indigo-50">
                                <h3 className="text-lg font-bold text-gray-800">
                                    <span className="text-indigo-700">{selectedCustomer.customer_name}</span>'s Billing History
                                </h3>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="text-gray-500 hover:text-red-600 text-2xl font-semibold"
                                    aria-label="Close modal"
                                >
                                    ×
                                </button>
                            </div>

                            {/* Table Content */}
                            <div className="overflow-auto p-4">
                                <table className="w-full text-sm border border-gray-200 rounded-md">
                                    <thead className="bg-gray-200 text-gray-700 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-2 border">Date</th>
                                            <th className="p-2 border">Invoice No</th>
                                            <th className="p-2 border">Total</th>
                                            <th className="p-2 border">Discount</th>
                                            <th className="p-2 border">Paid</th>
                                            <th className="p-2 border">Remaining</th>
                                            <th className="p-2 border">Paid On</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedCustomer.bills.map((bill, idx) => {
                                            const net = bill.net_total ?? (bill.total_amount - (bill.discount_amount || 0));
                                            const remaining = net - bill.amount_paid;
                                            return (
                                                <tr key={idx} className="hover:bg-gray-50 transition">
                                                    <td className="p-2 border">{new Date(bill.bill_date).toLocaleDateString()}</td>
                                                    <td className="p-2 border">{bill.invoice_no}</td>
                                                    <td className="p-2 border">Rs {Number(bill.total_amount).toFixed(2)}</td>
                                                    <td className="p-2 border">Rs {Number(bill.discount_amount || 0).toFixed(2)}</td>
                                                    <td className="p-2 border text-green-600">Rs {Number(bill.amount_paid).toFixed(2)}</td>
                                                    <td
                                                        className={`p-2 border font-semibold ${remaining < 0 ? 'text-green-600' : 'text-red-600'
                                                            }`}
                                                    >
                                                        Rs {remaining.toFixed(2)}
                                                    </td>
                                                    <td className="p-2 border">{bill.payment_date ? new Date(bill.payment_date).toLocaleDateString() : '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}


            </div>
        </div>

    );
}

export default History;