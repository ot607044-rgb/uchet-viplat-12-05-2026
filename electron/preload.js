const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  exportJSON: (data) => ipcRenderer.invoke('export-json', data),
  importJSON: () => ipcRenderer.invoke('import-json'),
  exportPDF: (opts) => ipcRenderer.invoke('export-pdf', opts),
  printPayslip: (opts) => ipcRenderer.invoke('print-payslip', opts),
  showNotification: (opts) => ipcRenderer.invoke('show-notification', opts),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  readPdfRegistry: () => ipcRenderer.invoke('read-pdf-registry'),
  readPdfTaxes:    () => ipcRenderer.invoke('read-pdf-taxes'),
  platform: process.platform
})
