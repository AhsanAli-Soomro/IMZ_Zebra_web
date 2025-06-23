'use client';
import React, { useEffect, useState } from 'react';
import axios from 'axios';


export default function HistoryPage() {
    const [history, setHistory] = useState([]);
    const [expandedCustomerId, setExpandedCustomerId] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const toggleDropdown = (customerId) => {
        setActiveDropdown(prev => (prev === customerId ? null : customerId));
    };

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

    const generatePDF = async (cust) => {
        const html2pdf = (await import('html2pdf.js')).default;

        const totalNet = cust.bills.reduce((sum, b) => {
            const net = b.net_total ?? (b.total_amount - (b.discount_amount || 0));
            return sum + (Number(net) || 0);
        }, 0);

        const totalPaid = cust.bills.reduce((sum, b) => sum + (Number(b.amount_paid) || 0), 0);
        const totalRemaining = totalNet - totalPaid;

        const htmlContent = `
    <div style="font-family: sans-serif; padding: 20px; max-width: 800px;">
      <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db;">${cust.customer_name} - Billing Summary</h2>
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

                <td style="border: 1px solid #ddd; padding: 8px;">${new Date(bill.payment_date).toLocaleDateString()}</td>
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
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Customer Billing History</h2>
            <div className="flex justify-end mb-4">
                <button
                    onClick={generateAllPDFs}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                    Download All Histories (PDF)
                </button>
            </div>

            <table className="w-full border-collapse border text-sm bg-white shadow">
                <thead className="bg-gray-200">
                    <tr>
                        <th className="border p-2">Name</th>
                        <th className="border p-2">Phone</th>
                        <th className="border p-2">Total Billed</th>
                        <th className="border p-2">Total Paid</th>
                        <th className="border p-2">Remaining</th>
                        <th className="border p-2">Last Payment</th>
                        <th className='border p-2'>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {history.map((cust, i) => (
                        <React.Fragment key={i}>
                            <tr className="hover:bg-gray-50">
                                <td className="border p-2">{cust.customer_name}</td>
                                <td className="border p-2">{cust.phone}</td>
                                {(() => {
                                    const totalNet = cust.bills?.reduce((sum, b) => {
                                        const net = b.net_total ?? (b.total_amount - (b.discount_amount || 0));
                                        return sum + (Number(net) || 0);
                                    }, 0) || 0;

                                    const totalPaid = cust.bills?.reduce((sum, b) => sum + (Number(b.amount_paid) || 0), 0) || 0;
                                    const totalRemaining = totalNet - totalPaid;

                                    return (
                                        <>
                                            <td className="border p-2">Rs {totalNet.toFixed(2)}</td>
                                            <td className="border p-2">Rs {totalPaid.toFixed(2)}</td>
                                            <td
                                                className={`border p-2 font-semibold ${totalRemaining < 0 ? 'text-green-600' : 'text-red-600'
                                                    }`}
                                            >
                                                Rs {totalRemaining.toFixed(2)}
                                            </td>

                                        </>
                                    );
                                })()}




                                <td className="border p-2">
                                    {cust.last_payment_date
                                        ? new Date(cust.last_payment_date).toLocaleDateString()
                                        : '—'}
                                </td>
                                <td className="border p-2 text-right font-extrabold relative">
                                    <button
                                        onClick={() => toggleDropdown(cust.customer_id)}
                                        className="text-gray-600 text-xl font-bold focus:outline-none"
                                    >
                                        ⋮
                                    </button>

                                    {activeDropdown === cust.customer_id && (
                                        <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 shadow-lg z-10 text-left rounded">
                                            <button
                                                onClick={() => {
                                                    toggleExpand(cust.customer_id);
                                                    setActiveDropdown(null);
                                                }}
                                                className="w-full px-4 py-2 hover:bg-gray-100 text-sm text-blue-600 text-left"
                                            >
                                                {expandedCustomerId === cust.customer_id ? 'Hide Details' : 'View Details'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    generatePDF(cust);
                                                    setActiveDropdown(null);
                                                }}
                                                className="w-full px-4 py-2 hover:bg-gray-100 text-sm text-green-600 text-left"
                                            >
                                                Download PDF
                                            </button>
                                        </div>
                                    )}
                                </td>

                            </tr>

                            {expandedCustomerId === cust.customer_id && cust.bills?.length > 0 && (
                                <tr>
                                    <td colSpan="7" className="border-t bg-gray-50 p-3">
                                        <table className="w-full text-xs border">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="p-1 border">Date</th>
                                                    <th className="p-1 border">Invoice No</th>
                                                    <th className="p-1 border">Total</th>
                                                    <th className="p-1 border">Discount</th>
                                                    <th className="p-1 border">Paid</th>
                                                    <th className="p-1 border">Remaining</th>
                                                    <th className="p-1 border">Paid On</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {cust.bills.map((bill, idx) => (
                                                    <tr key={idx}>
                                                        <td className="p-1 border">{new Date(bill.bill_date).toLocaleDateString()}</td>
                                                        <td className="p-1 border">{bill.invoice_no}</td>
                                                        <td className="p-1 border">Rs {Number(bill.total_amount).toFixed(2)}</td>

                                                        {/* ✅ Discount */}
                                                        <td className="p-1 border">Rs {Number(bill.discount_amount || 0).toFixed(2)}</td>

                                                        <td className="p-1 border">Rs {Number(bill.amount_paid).toFixed(2)}</td>

                                                        {/* ✅ Remaining After Discount */}
                                                        <td
                                                            className={`p-1 border font-semibold ${((bill.calculated_net ?? (bill.total_amount - (bill.discount_amount || 0))) - bill.amount_paid) < 0
                                                                ? 'text-green-600'
                                                                : 'text-red-600'
                                                                }`}
                                                        >
                                                            Rs {((bill.calculated_net ?? (bill.total_amount - (bill.discount_amount || 0))) - bill.amount_paid).toFixed(2)}
                                                        </td>



                                                        <td className="p-1 border">
                                                            {bill.payment_date
                                                                ? new Date(bill.payment_date).toLocaleDateString()
                                                                : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            )}

                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
