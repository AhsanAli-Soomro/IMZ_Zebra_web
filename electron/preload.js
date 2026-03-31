const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  printInvoice: (payload) => ipcRenderer.invoke('print-invoice', payload),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  downloadInvoicePdf: (payload) => ipcRenderer.invoke('download-invoice-pdf', payload),
})