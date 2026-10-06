const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  licenseCheck: () => ipcRenderer.invoke('license:check'),
  licenseActivate: (key) => ipcRenderer.invoke('license:activate', key),
  licenseClear: () => ipcRenderer.invoke('license:clear'),
  resetLicense: () => ipcRenderer.invoke('license:reset'),

  getUpdateState: () => ipcRenderer.invoke('update:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status)
    ipcRenderer.on('update:status', listener)
    return () => ipcRenderer.removeListener('update:status', listener)
  },

  printInvoice: (payload) => ipcRenderer.invoke('print-invoice', payload),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  downloadInvoicePdf: (payload) => ipcRenderer.invoke('download-invoice-pdf', payload),
})
