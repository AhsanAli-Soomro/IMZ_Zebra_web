'use client'

import { useEffect, useState } from 'react'

const money = (value) => Number(value || 0).toLocaleString()

const formatDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString()
}

export default function InvoicePreviewModal({
  open,
  onClose,
  invoice,
  company = null,
  title,
  defaultView = 'invoice',
  showEditButton = false,
  onEdit = null,
  extraContent = null,
  message = '',
  setMessage = null,
}) {
  const [view, setView] = useState(defaultView)
  const [printerAvailable, setPrinterAvailable] = useState(true)

  useEffect(() => {
    if (!open) return
    setView(defaultView)
  }, [open, defaultView])

  useEffect(() => {
    if (open && invoice) {
      document.body.setAttribute('data-print-mode', view)
    }

    return () => {
      document.body.removeAttribute('data-print-mode')
    }
  }, [open, invoice, view])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  useEffect(() => {
    async function checkPrinters() {
      try {
        if (!window.electronAPI?.getPrinters) {
          setPrinterAvailable(false)
          return
        }

        const printers = await window.electronAPI.getPrinters()
        setPrinterAvailable(Array.isArray(printers) && printers.length > 0)
      } catch {
        setPrinterAvailable(false)
      }
    }

    if (open && invoice) {
      checkPrinters()
    }
  }, [open, invoice])

  async function handlePrint() {
    try {
      if (!invoice?.id) {
        setMessage?.('Invoice available nahi hai')
        return
      }

      if (!window.electronAPI?.printInvoice) {
        setMessage?.('Electron print API available nahi hai')
        return
      }

      const mode = view === 'pos' ? 'thermal' : 'fullpage'
      const result = await window.electronAPI.printInvoice({ mode })

      if (!result?.success) {
        if (result?.code === 'NO_PRINTER') {
          setPrinterAvailable(false)
          setMessage?.('Printer available nahi hai. Download PDF use karein.')
          return
        }

        setMessage?.(result?.message || 'Print failed')
        return
      }

      setMessage?.('Invoice print ho gayi')
    } catch (error) {
      setMessage?.(error.message || 'Print failed')
    }
  }

  async function handleDownloadPdf() {
    try {
      if (!invoice?.id) {
        setMessage?.('Invoice available nahi hai')
        return
      }

      if (!window.electronAPI?.downloadInvoicePdf) {
        setMessage?.('Electron PDF API available nahi hai')
        return
      }

      const fileName = invoice?.invoice_no || 'invoice'
      const mode = view === 'pos' ? 'thermal' : 'fullpage'

      const result = await window.electronAPI.downloadInvoicePdf({
        mode,
        fileName,
      })

      if (!result?.success) {
        setMessage?.(result?.message || 'PDF download failed')
        return
      }

      setMessage?.(`PDF save ho gayi: ${result.filePath}`)
    } catch (error) {
      setMessage?.(error.message || 'PDF download failed')
    }
  }

  if (!open) return null

  return (
    <>
      <style jsx global>{`
        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
          }

          body * {
            visibility: hidden !important;
          }

          #invoice-print-area,
          #invoice-print-area * {
            visibility: visible !important;
          }

          #invoice-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            background: white !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
          }

          .no-print {
            display: none !important;
          }

          body[data-print-mode='invoice'] #invoice-print-area {
            width: 100% !important;
            padding: 24px !important;
          }

          body[data-print-mode='pos'] #invoice-print-area {
            width: 80mm !important;
            min-width: 80mm !important;
            max-width: 80mm !important;
            padding: 0 !important;
            margin: 0 auto !important;
          }

          body[data-print-mode='pos'] #invoice-print-area table {
            width: 100% !important;
            table-layout: fixed !important;
          }

          body[data-print-mode='pos'] #invoice-print-area th,
          body[data-print-mode='pos'] #invoice-print-area td {
            font-size: 10px !important;
            line-height: 1.25 !important;
            padding-top: 4px !important;
            padding-bottom: 4px !important;
            white-space: nowrap !important;
            word-break: keep-all !important;
            overflow-wrap: normal !important;
            vertical-align: top !important;
          }

          body[data-print-mode='pos'] #invoice-print-area th.description-cell,
          body[data-print-mode='pos'] #invoice-print-area td.description-cell {
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
          }
        }

        @page {
          margin: 0;
        }
      `}</style>

      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 md:p-5"
        onClick={onClose}
      >
        <div
          className={`w-full overflow-hidden rounded-2xl bg-white shadow-2xl ${
            view === 'pos' ? 'max-w-[430px]' : 'max-w-5xl'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="no-print flex items-center justify-between border-b bg-gray-50 px-4 py-3 md:px-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {title || invoice?.invoice_no || 'Invoice Detail'}
              </h3>
              <p className="text-sm text-gray-500">
                View, print, download PDF
                {showEditButton ? ', ya form mein load karke edit karein' : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-2xl leading-none text-gray-500 hover:text-red-600"
            >
              ×
            </button>
          </div>

          {!invoice ? (
            <div className="p-8 text-center text-red-600">Invoice load nahi ho saki.</div>
          ) : (
            <>
              <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setView('invoice')}
                    className={`rounded-lg px-4 py-2 text-sm font-medium ${
                      view === 'invoice'
                        ? 'bg-indigo-600 text-white'
                        : 'border text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Modal View
                  </button>

                  <button
                    type="button"
                    onClick={() => setView('pos')}
                    className={`rounded-lg px-4 py-2 text-sm font-medium ${
                      view === 'pos'
                        ? 'bg-indigo-600 text-white'
                        : 'border text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    POS View
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={!printerAvailable}
                    className={`rounded-lg px-4 py-2 text-sm font-medium ${
                      printerAvailable
                        ? 'bg-gray-900 text-white hover:bg-black'
                        : 'border border-gray-300 bg-gray-50 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Print
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Download PDF
                  </button>

                  {showEditButton && typeof onEdit === 'function' && (
                    <button
                      type="button"
                      onClick={onEdit}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      Edit
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>

              {message ? (
                <div className="no-print border-b bg-indigo-50 px-4 py-3 text-sm text-indigo-800 md:px-6">
                  {message}
                </div>
              ) : null}

              <div className="max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible">
                <div
                  id="invoice-print-area"
                  className={`bg-white ${view === 'pos' ? 'px-0 py-0' : 'px-4 py-5 md:px-6'}`}
                >
                  {view === 'invoice' ? (
                    <>
                      <div className="mb-6 grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-400">Invoice</p>
                          <h2 className="mt-1 text-2xl font-bold text-gray-900">
                            {invoice.invoice_no}
                          </h2>
                          <p className="mt-2 text-sm text-gray-600">
                            Date: {formatDate(invoice.invoice_date)}
                          </p>
                          <p className="text-sm text-gray-600">
                            Due: {formatDate(invoice.due_date)}
                          </p>
                        </div>

                        <div className="md:text-right">
                          <p className="text-xs uppercase tracking-wide text-gray-400">Customer</p>
                          <h3 className="mt-1 text-xl font-semibold text-gray-900">
                            {invoice.customer_name || 'Walk-in Customer'}
                          </h3>
                          <p className="mt-2 text-sm text-gray-600">
                            Phone: {invoice.customer_phone || '—'}
                          </p>
                          <p className="text-sm text-gray-600">
                            Payment Type: {invoice.payment_type || '—'}
                          </p>
                          <p className="text-sm text-gray-600">
                            Status: {invoice.payment_status || '—'}
                          </p>
                        </div>
                      </div>

                      <div className="mb-6 grid gap-4 sm:grid-cols-3">
                        <div className="rounded-xl border bg-gray-50 p-4">
                          <p className="text-sm text-gray-500">Total</p>
                          <p className="mt-1 text-2xl font-bold text-gray-900">
                            Rs {money(invoice.total)}
                          </p>
                        </div>

                        <div className="rounded-xl border bg-green-50 p-4">
                          <p className="text-sm text-green-700">Paid</p>
                          <p className="mt-1 text-2xl font-bold text-green-800">
                            Rs {money(invoice.paid_amount)}
                          </p>
                        </div>

                        <div className="rounded-xl border bg-red-50 p-4">
                          <p className="text-sm text-red-700">Remaining</p>
                          <p className="mt-1 text-2xl font-bold text-red-800">
                            Rs {money(invoice.remaining_amount)}
                          </p>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-2xl border">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[700px] text-sm">
                            <thead className="bg-indigo-600 text-white">
                              <tr>
                                <th className="px-4 py-3 text-left">Product</th>
                                <th className="px-4 py-3 text-right">Qty</th>
                                <th className="px-4 py-3 text-right">Price</th>
                                <th className="px-4 py-3 text-right">Discount</th>
                                <th className="px-4 py-3 text-right">Tax</th>
                                <th className="px-4 py-3 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(invoice.items || []).length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                                    No items found.
                                  </td>
                                </tr>
                              ) : (
                                invoice.items.map((item, index) => (
                                  <tr key={item.id || index} className="border-t">
                                    <td className="px-4 py-3">
                                      {item.product_name ||
                                        item.item_name ||
                                        item.name ||
                                        `Stock ${item.stock_id || item.product_id || ''}`}
                                    </td>
                                    <td className="px-4 py-3 text-right">{item.qty}</td>
                                    <td className="px-4 py-3 text-right">{money(item.price)}</td>
                                    <td className="px-4 py-3 text-right">{money(item.discount)}</td>
                                    <td className="px-4 py-3 text-right">{money(item.tax)}</td>
                                    <td className="px-4 py-3 text-right font-medium">
                                      {money(item.total)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border p-4">
                          <p className="text-sm font-medium text-gray-700">Notes</p>
                          <p className="mt-2 text-sm text-gray-600">
                            {invoice.notes || 'No notes added.'}
                          </p>
                        </div>

                        <div className="rounded-xl border p-4">
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Subtotal</span>
                              <span className="font-medium">Rs {money(invoice.subtotal)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Discount</span>
                              <span className="font-medium">Rs {money(invoice.discount)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Tax</span>
                              <span className="font-medium">Rs {money(invoice.tax)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Shipping</span>
                              <span className="font-medium">Rs {money(invoice.shipping)}</span>
                            </div>
                            <div className="flex items-center justify-between border-t pt-2 text-base font-bold">
                              <span>Total</span>
                              <span>Rs {money(invoice.total)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-center">
                      <div className="w-[80mm] max-w-[80mm] border border-gray-800 bg-white text-black shadow-sm print:shadow-none">
                        <div className="px-2 py-2 font-mono text-[10px] leading-4">
                          <div className="border-b border-gray-800 pb-2 text-center">
                            {company?.logo_url && (
                              <div className="mb-1 flex justify-center">
                                <img
                                  src={company.logo_url}
                                  alt="Logo"
                                  className="h-8 object-contain"
                                />
                              </div>
                            )}

                            <h2 className="text-[12px] font-bold leading-4">
                              {company?.company_name || 'Company Name'}
                            </h2>

                            {company?.company_code && <p>{company.company_code}</p>}
                            <p>
                              {company?.city || ''}
                              {company?.branch ? ` - ${company.branch}` : ''}
                            </p>
                            <p>{company?.contact || ''}</p>
                            <p>{company?.company_email || ''}</p>

                            <div className="mt-1">
                              <h3 className="text-[11px] font-bold">POS Invoice</h3>
                            </div>
                          </div>

                          <div className="space-y-1 border-b border-gray-800 py-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="flex-1">Bill No: {invoice.id || '—'}</p>
                              <p className="whitespace-nowrap">
                                Time:{' '}
                                {invoice.created_at
                                  ? new Date(invoice.created_at).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : '—'}
                              </p>
                            </div>

                            <p>Date: {formatDate(invoice.invoice_date)}</p>
                            <p>Buyer: {invoice.customer_name || 'Walk-in Customer'}</p>
                          </div>

                          <div className="border-b border-gray-800 py-2">
                            <table className="w-full table-fixed text-[10px]">
                              <colgroup>
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '36%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '16%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '20%' }} />
                              </colgroup>

                              <thead>
                                <tr className="border-b border-gray-800">
                                  <th className="pb-1 text-left font-bold">Sl</th>
                                  <th className="description-cell pb-1 text-left font-bold">
                                    Description
                                  </th>
                                  <th className="pb-1 text-right font-bold">Qty</th>
                                  <th className="pb-1 text-right font-bold">Rate</th>
                                  <th className="pb-1 text-right font-bold">Dis</th>
                                  <th className="pb-1 text-right font-bold">Amount</th>
                                </tr>
                              </thead>

                              <tbody>
                                {(invoice.items || []).length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="py-3 text-center">
                                      No items found
                                    </td>
                                  </tr>
                                ) : (
                                  invoice.items.map((item, index) => (
                                    <tr
                                      key={item.id || index}
                                      className="border-b border-gray-200 align-top"
                                    >
                                      <td className="pt-1 text-left">{index + 1}</td>

                                      <td className="description-cell pt-1 pr-1 text-left leading-4">
                                        {item.product_name ||
                                          item.item_name ||
                                          item.name ||
                                          `Stock ${item.stock_id || item.product_id || ''}`}
                                      </td>

                                      <td className="pt-1 text-right whitespace-nowrap">
                                        {item.qty}
                                      </td>

                                      <td className="pt-1 text-right whitespace-nowrap">
                                        {money(item.price)}
                                      </td>

                                      <td className="pt-1 text-right whitespace-nowrap">
                                        {money(item.discount)}
                                      </td>

                                      <td className="pt-1 text-right font-semibold whitespace-nowrap">
                                        {money(item.total)}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>

                          <div className="space-y-1 border-b border-gray-800 py-2 text-[10px]">
                            <div className="flex justify-between">
                              <span>Subtotal</span>
                              <span>{money(invoice.subtotal)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Discount</span>
                              <span>{money(invoice.discount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>CGST</span>
                              <span>{money(Number(invoice.tax || 0) / 2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>SGST</span>
                              <span>{money(Number(invoice.tax || 0) / 2)}</span>
                            </div>
                            <div className="flex justify-between pt-1 text-[11px] font-bold">
                              <span>Total</span>
                              <span>{money(invoice.total)}</span>
                            </div>
                          </div>

                          <div className="space-y-1 border-b border-gray-800 py-2 text-[10px]">
                            <div className="flex justify-between">
                              <span>Cash</span>
                              <span>{money(invoice.paid_amount)}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                              <span>Balance</span>
                              <span>{money(invoice.remaining_amount)}</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-800 pt-1 text-[11px] font-bold">
                              <span>Total Paid</span>
                              <span>{money(invoice.paid_amount)}</span>
                            </div>
                          </div>

                          <div className="pt-3 text-center leading-5">
                            <p className="text-[12px] font-semibold">Thank You!</p>
                            <p className="text-[11px]">Visit Again!</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {extraContent ? (
                  <div className="no-print border-t bg-gray-50 p-4 md:p-6">{extraContent}</div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}