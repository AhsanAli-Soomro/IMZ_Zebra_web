const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  licenseCheck: () => ipcRenderer.invoke('license:check'),
  licenseActivate: (key) => ipcRenderer.invoke('license:activate', key),
  licenseClear: () => ipcRenderer.invoke('license:clear'),
  resetLicense: () => ipcRenderer.invoke('license:reset'),

  printInvoice: (payload) => ipcRenderer.invoke('print-invoice', payload),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  downloadInvoicePdf: (payload) => ipcRenderer.invoke('download-invoice-pdf', payload),
})