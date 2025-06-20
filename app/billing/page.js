'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function BillingPage() {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [customers, setCustomers] = useState([])
  const [isPrinting, setIsPrinting] = useState(false)
  const [isInvoicePrinted, setIsInvoicePrinted] = useState(false)
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState('manual')
  const [customerInfo, setCustomerInfo] = useState({ name: '', contact: '', address: '' })
  const [invoiceNo, setInvoiceNo] = useState(null)
  const [billAmount, setBillAmount] = useState(0)
  const [discount, setDiscount] = useState(0.05)
  const [netPay, setNetPay] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isInvoiceSaved, setIsInvoiceSaved] = useState(false)
  const [currentTime, setCurrentTime] = useState({ date: '', time: '' })

  useEffect(() => {
    const now = new Date()
    setCurrentTime({
      date: now.toLocaleDateString('en-GB'),
      time: now.toLocaleTimeString('en-GB')
    })
  }, [])

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        console.log('Categories API response:', data); // for debugging
        setCategories(Array.isArray(data.data) ? data.data : []);
      })
      .catch(err => {
        console.error("Failed to load categories", err);
        setCategories([]); // fallback
      });
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [productRes, customerRes, invoiceRes] = await Promise.all([
          axios.get('/api/stocks'),
          axios.get('/api/customers'),
          axios.get('/api/invoices/last')
        ])

        setProducts(productRes.data.data.filter(p => p.status === 'Active'))
        setCustomers(customerRes.data.data)
        setInvoiceNo(invoiceRes.data.lastInvoice + 1)
      } catch (err) {
        console.error('Init fetch error:', err)
      }
    }

    fetchInitialData()
  }, [])

  useEffect(() => {
    const total = cart.reduce((acc, item) => acc + (item.selling_price * item.qty), 0)
    setBillAmount(total)
    setNetPay(total - total * discount)
  }, [cart, discount])

  const addToCart = (product) => {
    setCart(prev => {
      const exists = prev.find(p => p.id === product.id)
      return exists
        ? prev.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p)
        : [...prev, { ...product, qty: 1 }]
    })
  }

  const updateQty = (id, qty) => {
    setCart(prev =>
      qty <= 0 ? prev.filter(p => p.id !== id) : prev.map(p => p.id === id ? { ...p, qty } : p)
    )
  }

  const updateStockAfterSale = async () => {
    try {
      const updates = cart.map(item => ({
        id: item.id,
        qty: item.qty
      }))
      await axios.post('/api/stocks/update', updates) // ✅ now hitting the right API
      console.log('Stock updated successfully')
    } catch (err) {
      console.error('Failed to update stock:', err)
      alert('Stock update failed')
    }
  }

  const generateInvoice = async () => {
    if (customerInfo.name === '' || customerInfo.contact === '' || customerInfo.address === '') {
      alert('Please enter customer info')
      return
    }
    if (cart.length === 0) {
      alert('Please add items to cart')
      return
    }
    try {
      setIsGenerating(true)

      const { data } = await axios.get('/api/invoices/last')
      if (data.lastInvoice >= invoiceNo) {
        alert('Invoice already exists.')
        return
      }

      // ✅ Now the DOM is ready, we can safely use it
      const invoiceHTML = document.getElementById('invoice-area')?.outerHTML
      if (!invoiceHTML) {
        alert('Invoice content not found')
        return
      }

      const html = `
      <html>
        <head>
          <style>
            @page { margin: 0; }
            body { margin: 1cm; font-family: monospace; font-size: 12px; }

            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .border { border: 1px solid #000; }
            .border-b { border-bottom: 1px solid #000; }
            .border-t { border-top: 1px solid #000; }
            .bg-gray-100 { background-color: #f3f3f3; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 2px; border: 1px solid #000; }
          </style>
        </head>
        <body>
          ${invoiceHTML}
        </body>
      </html>
    `

      const response = await axios.post('/api/invoices/save', {
        invoice_no: invoiceNo,
        customer_name: customerInfo.name,
        contact: customerInfo.contact,
        address: customerInfo.address,
        items: cart,
        subtotal: billAmount,
        discount_percent: discount,
        discount_amount: billAmount * discount,
        net_total: netPay,
        html
      })

      if (response.data.success) {
        alert('Invoice Generated & Saved')
        setIsInvoiceSaved(true)
        await updateStockAfterSale()
      } else {
        alert('Failed to save invoice')
      }
    } catch (err) {
      console.error('Generate error:', err)
      alert('Error generating invoice')
    } finally {
      setIsGenerating(false)
    }
  }

  const printInvoice = async () => {
    if (customerInfo.name === '' || customerInfo.contact === '' || customerInfo.address === '') {
      alert('Please enter customer info')
      return
    }
    if (cart.length === 0) {
      alert('Please add items to cart')
      return
    }

    try {
      setIsPrinting(true)

      const printerConnected = true
      if (!printerConnected) {
        alert('Printer not connected')
        return
      }

      const { data } = await axios.get('/api/invoices/last')
      const last = data.lastInvoice

      const invoiceHTML = document.getElementById('invoice-area')?.outerHTML
      if (!invoiceHTML) {
        alert('Invoice content not found')
        return
      }

      // ✅ If already saved, just print
      if (last >= invoiceNo) {
        window.print()
        setIsInvoicePrinted(true)
        return
      }

      // ✅ Save and then print
      const html = `
      <html>
        <head>
          <style>
            @page { margin: 0; }
            body { margin: 1cm; font-family: monospace; font-size: 12px; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .border { border: 1px solid #000; }
            .border-b { border-bottom: 1px solid #000; }
            .border-t { border-top: 1px solid #000; }
            .bg-gray-100 { background-color: #f3f3f3; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 2px; border: 1px solid #000; }
          </style>
        </head>
        <body>
          ${invoiceHTML}
        </body>
      </html>
    `

      const response = await axios.post('/api/invoices/save', {
        invoice_no: invoiceNo,
        customer_name: customerInfo.name,
        contact: customerInfo.contact,
        address: customerInfo.address,
        items: cart,
        subtotal: billAmount,
        discount_percent: discount,
        discount_amount: billAmount * discount,
        net_total: netPay,
        html
      })

      if (response.data.success) {
        alert('Invoice saved, now printing...')
        setIsInvoiceSaved(true)

        // ✅ Only now update stock
        await updateStockAfterSale()

        window.print()
        setIsInvoicePrinted(true)
      } else {
        alert('Failed to save invoice')
      }

    } catch (err) {
      console.error('Print error:', err)
      alert('Error during print process')
    } finally {
      setIsPrinting(false)
    }
  }

  const clearCart = async () => {
    setCart([])
    setIsInvoiceSaved(false)
    setInvoiceNo(prev => prev + 1)
    setSelectedCustomer('manual')
    setCustomerInfo({ name: '', contact: '', address: '' })

    try {
      const res = await axios.get('/api/stocks')
      setProducts(res.data.data.filter(p => p.status === 'Active'))
    } catch (err) {
      console.error('Failed to refresh products:', err)
    }
  }

  const filteredProducts =
    selectedCategory === 'all'
      ? products
      : products.filter(prod => prod.category === selectedCategory);

  return (
    <div className="h-screen bg-gray-100 font-sans flex flex-col">

      <div className="flex flex-1 overflow-hidden">

        {/* Left: Order Summary and Customer Info */}
        <aside className="w-[320px] bg-white border-r shadow p-4 overflow-y-auto">

          {/* Customer Info */}
          <div className="mb-4">
            <h2 className="font-semibold text-lg mb-2">Customer</h2>
            <select
              value={selectedCustomer}
              onChange={(e) => {
                const val = e.target.value
                setSelectedCustomer(val)
                if (val !== 'manual') {
                  const cust = customers.find(c => c.id == val)
                  setCustomerInfo({
                    name: cust.name,
                    contact: cust.phone,
                    address: cust.address || ''
                  })
                } else {
                  setCustomerInfo({ name: '', contact: '', address: '' })
                }
              }}
              className="border px-3 py-2 w-full mb-2 rounded"
            >
              <option value="manual">Manual Entry</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>

            {selectedCustomer === 'manual' && (
              <>
                <input
                  placeholder="Name"
                  className="border px-3 py-2 w-full mb-2 rounded"
                  value={customerInfo.name}
                  onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                />
                <input
                  placeholder="Contact"
                  className="border px-3 py-2 w-full mb-2 rounded"
                  value={customerInfo.contact}
                  onChange={e => setCustomerInfo({ ...customerInfo, contact: e.target.value })}
                />
                <input
                  placeholder="Address"
                  className="border px-3 py-2 w-full rounded"
                  value={customerInfo.address}
                  onChange={e => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                />
              </>
            )}
          </div>

          {/* Cart Items */}
          <div className="mb-4">
            <h2 className="font-semibold text-lg mb-2">Cart</h2>
            <div className="max-h-60 overflow-y-auto border rounded p-2">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between items-center mb-2 text-sm">
                  <div className="flex-1">{item.item_name}</div>
                  <input
                    type="number"
                    min="0"
                    className="w-14 text-right border rounded px-1 py-0.5 ml-2"
                    value={item.qty}
                    onChange={e => updateQty(item.id, parseInt(e.target.value))}
                  />
                  <div className="ml-2">Rs {item.qty * item.selling_price}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Billing Summary */}
          <div className="border-t pt-2 text-sm">
            <p className="flex justify-between"><span>Total Qty:</span> <span>{cart.reduce((a, b) => a + b.qty, 0)}</span></p>
            <p className="flex justify-between"><span>Subtotal:</span> <span>Rs {billAmount.toFixed(2)}</span></p>
            <p className="flex justify-between"><span>Discount (5%):</span> <span>- Rs {(billAmount * discount).toFixed(2)}</span></p>
            <p className="flex justify-between font-bold mt-2"><span>Net Pay:</span> <span>Rs {netPay.toFixed(2)}</span></p>
          </div>

        </aside>


        {/* Right: Product Grid */}
        <main className="flex-1 p-4 overflow-y-auto">
          {/* Category Bar */}
          <div className="mb-4 w-full max-w-xs">
            <label className="block mb-1 font-semibold text-gray-700">Filter by Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border px-3 py-2 w-full rounded shadow-sm"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>


          </div>



          {/* Product Grid */}
          <div className="grid grid-cols-6 gap-4">
            {filteredProducts.map(prod => (
              <div
                key={prod.id}
                onClick={() => addToCart(prod)}
                className="bg-white rounded shadow hover:shadow-lg cursor-pointer p-2 flex flex-col items-center"
              >
                {prod.image_path ? (
                  <img src={prod.image_path} alt={prod.item_name} className="h-10 w-10 object-cover" />
                ) : (
                  'No Image'
                )}
                <span className="font-medium text-center text-sm">{prod.item_name} Qty:({prod.quantity})</span>
                <span className="text-sm text-gray-600">Rs {prod.selling_price}</span>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Bottom Action Bar */}
      <footer className="bg-white border-t p-3 flex justify-between px-6 shadow-inner">
        <div className="flex gap-4">
          <button
            onClick={generateInvoice}
            disabled={isGenerating || isInvoiceSaved}
            className="bg-green-600 text-white px-5 py-2 rounded hover:bg-green-700"
          >
            {isInvoiceSaved ? 'Generated' : 'Generate'}
          </button>
          <button
            onClick={printInvoice}
            className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700"
          >
            Print
          </button>
          {isInvoiceSaved && (
            <button onClick={clearCart} className="bg-gray-500 text-white px-5 py-2 rounded hover:bg-gray-600">
              Clear
            </button>
          )}
        </div>

        <div className="flex gap-4 text-sm text-gray-600 items-center">
          <button>Settings</button>
          <button>Help</button>
        </div>
      </footer>



      {/* Hidden Invoice for Print/Save */}
      <div id="invoice-area" className="hidden">
        <div className="bg-white text-black text-[12px] w-[290px] p-4 border mx-auto font-mono">
          <div className="text-center">
            <h2 className="font-bold text-base mb-1">Sales Invoice</h2>
            <p className="font-semibold">Manan Agency</p>
            <p>A/12, Shrenik Park, Opp. Jain Temple, Akota, Vadodara</p>
            <p>Ph: 9727955514</p>
            <p>Email: softwareketan@gmail.com</p>
            <p className="font-semibold">GSTIN: 24AKPPP1343N1ZR</p>
          </div>

          <hr className="my-2 border-black" />

          <div className="mb-2">
            <p><b>Bill No:</b> {invoiceNo}</p>
            <p><b>Date:</b> {currentTime.date} <b>Time:</b> {currentTime.time}</p>
          </div>

          <div className="mb-2">
            <p><b>To:</b> {customerInfo.name}</p>
            <p><b>Phone:</b> {customerInfo.contact}</p>
            <p><b>Address:</b> {customerInfo.address}</p>
          </div>

          <table className="w-full border text-[11px] mb-2">
            <thead>
              <tr className="border-t border-b border-black bg-gray-100">
                <th className="text-left">#</th>
                <th className="text-left">Item</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Amt</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item, i) => (
                <tr key={i} className="border-b">
                  <td>{i + 1}</td>
                  <td>{item.item_name}</td>
                  <td className="text-right">{item.qty}</td>
                  <td className="text-right">{item.selling_price}</td>
                  <td className="text-right">{(item.qty * item.selling_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="text-right text-sm mb-1">
            <p>Total Qty: {cart.reduce((sum, item) => sum + item.qty, 0)}</p>
            <p>Gross Amount: Rs:{billAmount.toFixed(2)}</p>
            <p>Discount (5%): Rs:{(billAmount * discount).toFixed(2)}</p>
            <p className="font-bold">Net Amount: Rs:{netPay.toFixed(2)}</p>
          </div>

          <hr className="my-2 border-black" />

          <div className="text-sm">
            <p><b>Advance:</b> Rs:{netPay.toFixed(2)}</p>
            <p><b>Balance:</b> Rs:0.00</p>
          </div>

          <hr className="my-2 border-black" />

          <div className="text-center text-xs mt-2">
            <p>Have a Nice Day</p>
            <p>Thanks for your Kind Visit</p>
            <p className="mt-2 font-bold">DETAILS OF GST TAX</p>
            <p>CGST 2.5% & SGST 2.5% on Rs:{(netPay / 1.05).toFixed(2)}</p>
          </div>
        </div>
      </div>

    </div>


  )
}
