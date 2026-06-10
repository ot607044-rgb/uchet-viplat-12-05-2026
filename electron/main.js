const { app, BrowserWindow, ipcMain, dialog, Notification, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

const DATA_FILE = path.join(app.getPath('userData'), 'payroll-data.json')

const DEFAULT_DATA = {
  employees: [],
  payrolls: [],
  departments: [],
  managers: [],
  financeByMonth: [],
  settings: {
    advanceDay: 30,
    salaryDay: 15,
    reminderDaysBefore: 3,
    backgroundColor: '#f8f9fb',
    companyName: 'Моя компания'
  }
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf-8')
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ensureDataFile()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Проверяем обновления через 3 секунды после запуска (только в production)
  if (app.isPackaged) {
    setTimeout(() => autoUpdater.checkForUpdates(), 3000)
  }
})

// ── Auto-updater events ────────────────────────────────────────────────────────
autoUpdater.on('update-available', (info) => {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  dialog.showMessageBox(win, {
    type: 'info',
    title: 'Доступно обновление',
    message: `Доступна новая версия ${info.version}`,
    detail: 'Нажмите «Скачать» — программа обновится автоматически и перезапустится.',
    buttons: ['Скачать', 'Позже'],
    defaultId: 0
  }).then(({ response }) => {
    if (response === 0) {
      autoUpdater.downloadUpdate()
      win.webContents.send('update-downloading')
    }
  })
})

autoUpdater.on('update-downloaded', () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  dialog.showMessageBox(win, {
    type: 'info',
    title: 'Обновление готово',
    message: 'Обновление загружено. Перезапустить сейчас?',
    buttons: ['Перезапустить', 'Позже'],
    defaultId: 0
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall()
  })
})

autoUpdater.on('update-not-available', () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  dialog.showMessageBox(win, {
    type: 'info',
    title: 'Обновлений нет',
    message: 'У вас установлена последняя версия программы.',
    buttons: ['OK']
  })
})

autoUpdater.on('error', (err) => {
  console.error('Auto-updater error:', err)
  const win = BrowserWindow.getAllWindows()[0]
  if (win) {
    dialog.showMessageBox(win, {
      type: 'error',
      title: 'Ошибка обновления',
      message: 'Не удалось проверить обновления.',
      detail: err.message,
      buttons: ['OK']
    })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle('load-data', () => {
  try {
    ensureDataFile()
    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    const data = JSON.parse(raw)
    // Merge with defaults to handle new fields
    return { ...DEFAULT_DATA, ...data, settings: { ...DEFAULT_DATA.settings, ...data.settings } }
  } catch (e) {
    console.error('load-data error:', e)
    return DEFAULT_DATA
  }
})

ipcMain.handle('save-data', (_, data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
    return { ok: true }
  } catch (e) {
    console.error('save-data error:', e)
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('export-json', async (_, data) => {
  const win = BrowserWindow.getFocusedWindow()
  const { filePath } = await dialog.showSaveDialog(win, {
    title: 'Экспорт данных',
    defaultPath: `payroll-export-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (!filePath) return { ok: false }
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    return { ok: true, filePath }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('import-json', async () => {
  const win = BrowserWindow.getFocusedWindow()
  const { filePaths } = await dialog.showOpenDialog(win, {
    title: 'Импорт данных',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (!filePaths || filePaths.length === 0) return { ok: false }
  try {
    const raw = fs.readFileSync(filePaths[0], 'utf-8')
    const data = JSON.parse(raw)
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('export-pdf', async (_, { html, filename }) => {
  const win = BrowserWindow.getFocusedWindow()
  const { filePath } = await dialog.showSaveDialog(win, {
    title: 'Сохранить расчётный листок',
    defaultPath: filename || 'payslip.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (!filePath) return { ok: false }

  // Записываем HTML во временный файл (избегаем лимита data: URI)
  const tmpFile = path.join(app.getPath('temp'), `payslip_tmp_${Date.now()}.html`)
  fs.writeFileSync(tmpFile, html, 'utf-8')

  const pdfWin = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, javascript: true }
  })

  try {
    await pdfWin.loadFile(tmpFile)
    // Небольшая пауза чтобы шрифты и стили успели применититься
    await new Promise(resolve => setTimeout(resolve, 400))
    const pdfBuffer = await pdfWin.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      marginsType: 0
    })
    fs.writeFileSync(filePath, pdfBuffer)
    pdfWin.close()
    fs.unlinkSync(tmpFile)
    shell.openPath(filePath)
    return { ok: true, filePath }
  } catch (e) {
    pdfWin.close()
    try { fs.unlinkSync(tmpFile) } catch {}
    console.error('export-pdf error:', e)
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('print-payslip', async (_, { html }) => {
  // Записываем HTML во временный файл
  const tmpFile = path.join(app.getPath('temp'), `payslip_print_${Date.now()}.html`)
  fs.writeFileSync(tmpFile, html, 'utf-8')

  const pdfWin = new BrowserWindow({
    show: true,
    width: 820,
    height: 750,
    webPreferences: { contextIsolation: true }
  })

  try {
    await pdfWin.loadFile(tmpFile)
    await new Promise(resolve => setTimeout(resolve, 400))
    pdfWin.webContents.print({ silent: false, printBackground: true }, (success, reason) => {
      if (!success) console.error('Print failed:', reason)
      pdfWin.close()
      try { fs.unlinkSync(tmpFile) } catch {}
    })
  } catch (e) {
    pdfWin.close()
    try { fs.unlinkSync(tmpFile) } catch {}
    console.error('print-payslip error:', e)
  }
  return { ok: true }
})

ipcMain.handle('show-notification', (_, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
})

ipcMain.handle('get-data-path', () => DATA_FILE)
ipcMain.handle('get-version', () => app.getVersion())
ipcMain.handle('check-for-updates', () => autoUpdater.checkForUpdates())

// ── Налоги и взносы (ЗУП) reader ──────────────────────────────────────────────
ipcMain.handle('read-pdf-taxes', async () => {
  const win = BrowserWindow.getFocusedWindow()
  const { filePaths } = await dialog.showOpenDialog(win, {
    title: 'Загрузить отчёт «Налоги и взносы (кратко)» из ЗУП',
    filters: [{ name: 'PDF файлы', extensions: ['pdf'] }],
    properties: ['openFile']
  })
  if (!filePaths || filePaths.length === 0) return { ok: false }

  try {
    const pdfParse = require('pdf-parse')
    const buffer = fs.readFileSync(filePaths[0])
    const data = await pdfParse(buffer)
    const text = data.text

    // ── Определяем период ─────────────────────────────────────────────────────
    const MONTH_MAP = [
      ['январ', 1], ['феврал', 2], ['март', 3], ['апрел', 4],
      ['мае', 5], ['май', 5], ['июн', 6], ['июл', 7],
      ['август', 8], ['сентябр', 9], ['октябр', 10], ['ноябр', 11], ['декабр', 12]
    ]
    let month = null, year = null
    const periodMatch = text.match(/([а-яёА-ЯЁ]{3,})\s+(\d{4})/i)
    if (periodMatch) {
      year = parseInt(periodMatch[2])
      const mStr = periodMatch[1].toLowerCase()
      for (const [key, val] of MONTH_MAP) {
        if (mStr.startsWith(key)) { month = val; break }
      }
    }

    // ── Парсим строки сотрудников ─────────────────────────────────────────────
    const parseRuNum = s => parseFloat(s.replace(/\s/g, '').replace(',', '.'))

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const rows = []
    let inData = false

    for (const line of lines) {
      // Маркер начала данных
      if (/^[Сс]отрудник/.test(line)) { inData = true; continue }
      if (!inData) continue
      // Стоп на «Итого»
      if (/^[Ии]того/.test(line)) break

      // ФИО: начинается с заглавной буквы кириллицы, 2–5 слов (могут быть инициалы)
      const nameMatch = line.match(/^([А-ЯЁ][а-яёА-ЯЁ\-]{1,}(?:\s+[А-ЯЁа-яёА-ЯЁ][а-яёА-ЯЁ\-\.]{0,}){0,4})/)
      if (!nameMatch) continue

      const name = nameMatch[1].trim()
      const rest = line.slice(name.length)

      // Числа в русском формате: «34 000,90»
      const numMatches = rest.match(/\d[\d ]{0,9},\d{2}/g)
      if (!numMatches || numMatches.length < 2) continue

      const nums = numMatches.map(parseRuNum)
      // Колонки: Начислено | НДФЛ | Единый тариф (СВ) | [ДСО=0] | Несч.случаи (НСП)
      // ДСО всегда 0 — не выводится в текст, поэтому 4-я цифра = НСП
      rows.push({
        name,
        officialBase: nums[0] || 0,
        ndfl:         nums[1] || 0,
        sv:           nums[2] || 0,
        nsp:          nums[3] || 0
      })
    }

    return { ok: true, rows, month, year, filename: path.basename(filePaths[0]) }
  } catch (e) {
    console.error('read-pdf-taxes error:', e)
    return { ok: false, error: e.message }
  }
})

// ── PDF Registry reader ────────────────────────────────────────────────────
ipcMain.handle('read-pdf-registry', async () => {
  const win = BrowserWindow.getFocusedWindow()
  const { filePaths } = await dialog.showOpenDialog(win, {
    title: 'Загрузить реестр выплат (PDF)',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    properties: ['openFile']
  })
  if (!filePaths || filePaths.length === 0) return { ok: false }

  try {
    const pdfParse = require('pdf-parse')
    const buffer = fs.readFileSync(filePaths[0])
    const data = await pdfParse(buffer)
    const text = data.text

    // Формат реестра банка:
    // "140817810346006538636Адилова Римма Хайруловна15 252,31 "
    // номер строки (1-3 цифры) + счёт 20 цифр + ФИО + сумма
    // Некоторые ФИО переносятся на следующую строку

    // Объединяем весь текст, убираем переносы (чтобы починить перенесённые ФИО)
    const flatText = text.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ')

    const rows = []

    // Паттерн 1: номер + счёт (20 цифр, начинается с цифры) + ФИО (2-4 слова) + сумма с запятой
    // Счёт банка обычно начинается с 40817 или 42301 или 408
    const reBank = /\d{16,23}([А-ЯЁ][а-яёА-ЯЁ\-]+(?:\s+[А-ЯЁ][а-яёА-ЯЁ\-]+){1,3})\s*([\d][\d ]{0,8},\d{2})/g
    let m
    while ((m = reBank.exec(flatText)) !== null) {
      const name = m[1].replace(/\s+/g, ' ').trim()
      const amountStr = m[2].replace(/\s/g, '').replace(',', '.')
      const amount = parseFloat(amountStr)
      const skip = ['итого', 'всего', 'фамилия', 'счёт', 'бухгалтер', 'руководитель'].some(k => name.toLowerCase().includes(k))
      if (!skip && name.length >= 5 && amount > 0 && amount < 10000000) {
        rows.push({ name, amount })
      }
    }

    // Паттерн 2 (запасной): строки без счёта — просто ФИО + сумма
    if (rows.length === 0) {
      const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean)
      const nameRe = /^(?:\d+\s+)?([А-ЯЁ][а-яёА-ЯЁ\-]+(?:\s+[А-ЯЁ][а-яёА-ЯЁ\-]+){1,3})\s+([\d\s]+[.,]\d{2})\s*$/
      lines.forEach(line => {
        const lm = line.match(nameRe)
        if (!lm) return
        const name = lm[1].trim()
        const amount = parseFloat(lm[2].replace(/\s/g, '').replace(',', '.'))
        const skip = ['итого', 'всего', 'фамилия', 'счёт', 'бухгалтер'].some(k => name.toLowerCase().includes(k))
        if (!skip && name.length >= 5 && amount > 0 && amount < 10000000) rows.push({ name, amount })
      })
    }

    // Дедупликация по имени
    const seen = new Map()
    rows.forEach(r => { if (!seen.has(r.name)) seen.set(r.name, r) })

    return { ok: true, rows: Array.from(seen.values()), filename: path.basename(filePaths[0]), text }
  } catch (e) {
    console.error('read-pdf-registry error:', e)
    return { ok: false, error: e.message }
  }
})
