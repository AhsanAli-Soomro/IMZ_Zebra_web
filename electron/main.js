const { app, BrowserWindow, utilityProcess, dialog, ipcMain } = require('electron')
const { isActivated, activateWithKey, clearActivation } = require('./license')
const path = require('path')
const http = require('http')
const net = require('net')
const fs = require('fs')
const license = require('./license')
let mainWindow = null
let nextProcess = null
let isStarting = false

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = address.port
      server.close(() => resolve(port))
    })

    server.on('error', reject)
  })
}

function pathExists(p) {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

function getBundledPath(...parts) {
  const candidates = app.isPackaged
    ? [
      path.join(process.resourcesPath, 'app.asar.unpacked', ...parts),
      path.join(process.resourcesPath, 'app.asar', ...parts),
      path.join(process.resourcesPath, ...parts),
    ]
    : [
      path.join(app.getAppPath(), ...parts),
      path.join(__dirname, '..', ...parts),
    ]

  for (const p of candidates) {
    if (pathExists(p)) return p
  }

  return null
}

function findStandaloneServer() {
  const candidates = app.isPackaged
    ? [
      path.join(process.resourcesPath, 'app.asar.unpacked', '.next', 'standalone', 'server.js'),
      path.join(process.resourcesPath, 'app.asar', '.next', 'standalone', 'server.js'),
      path.join(process.resourcesPath, '.next', 'standalone', 'server.js'),
    ]
    : [
      path.join(app.getAppPath(), '.next', 'standalone', 'server.js'),
      path.join(__dirname, '..', '.next', 'standalone', 'server.js'),
    ]

  for (const p of candidates) {
    if (pathExists(p)) return p
  }

  throw new Error(`server.js not found. Checked:\n${candidates.join('\n')}`)
}

async function runMigrationScript(dbPath) {
  try {
    const migrationScriptPath = getBundledPath('lib', 'migrate.js')
    const schemaPath = getBundledPath('database', 'schema.sql')

    if (!migrationScriptPath) {
      console.log('Migration module not found, skipping')
      return
    }

    console.log('Migration module path:', migrationScriptPath)
    console.log('Migration DB path:', dbPath)
    console.log('Migration schema path:', schemaPath)

    process.env.SQLITE_DB_PATH = dbPath
    process.env.DATABASE_URL = dbPath
    process.env.SQLITE_SCHEMA_PATH = schemaPath || ''

    const migrationModule = await import(`file://${migrationScriptPath}`)

    if (!migrationModule || typeof migrationModule.runMigrations !== 'function') {
      throw new Error('lib/migrate.js must export runMigrations(dbPath, schemaPath)')
    }

    migrationModule.runMigrations(dbPath, schemaPath)

    console.log('Migration script completed')
  } catch (err) {
    console.error('Migration failed:', err)
    throw new Error(`Migration failed: ${err.message || String(err)}`)
  }
}

function waitForServer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()

    function check() {
      http
        .get(url, (res) => {
          res.resume()
          resolve()
        })
        .on('error', () => {
          if (Date.now() - start > timeout) {
            reject(new Error(`Server did not start in time: ${url}`))
          } else {
            setTimeout(check, 500)
          }
        })
    }

    check()
  })
}
function getIconPath() {
  const iconPath = getBundledPath('build', 'icon.ico')

  if (iconPath) {
    return iconPath
  }

  return path.join(__dirname, '..', 'build', 'icon.ico')
}
function createWindow(port, route = '/') {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    show: false,
    icon: getIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('did-fail-load:', code, desc)
  })

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('render-process-gone:', details)
  })

  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log('renderer console:', { level, message, line, sourceId })
  })

  mainWindow.loadURL(`http://127.0.0.1:${port}${route}`)
}

/* =========================
   LICENSE IPC HANDLERS
========================= */

ipcMain.handle('license:check', async () => {
  try {
    return isActivated()
  } catch (err) {
    console.error('license:check error', err)
    return {
      ok: false,
      reason: 'check_failed',
      message: err.message || 'Activation check failed',
    }
  }
})
ipcMain.handle('license:reset', async () => {
  return license.clearActivation()
})
ipcMain.handle('license:activate', async (_event, key) => {
  try {
    return activateWithKey(key)
  } catch (err) {
    console.error('license:activate error', err)
    return {
      ok: false,
      message: err.message || 'Activation failed',
    }
  }
})

ipcMain.handle('license:clear', async () => {
  try {
    return clearActivation()
  } catch (err) {
    console.error('license:clear error', err)
    return {
      ok: false,
      message: err.message || 'Clear activation failed',
    }
  }
})

/* =========================
   PRINT / PDF IPC HANDLERS
========================= */

ipcMain.handle('get-printers', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender)
    const printers = await win.webContents.getPrintersAsync()
    return printers || []
  } catch {
    return []
  }
})

ipcMain.handle('print-invoice', async (event, payload) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender)
    const printers = await win.webContents.getPrintersAsync()
    const isThermal = payload?.mode === 'thermal'

    if (!printers || printers.length === 0) {
      return {
        success: false,
        code: 'NO_PRINTER',
        message: 'Printer available nahi hai. PDF download kar lein.',
      }
    }

    const defaultPrinter = printers.find((p) => p.isDefault) || printers[0]

    return await new Promise((resolve) => {
      win.webContents.print(
        isThermal
          ? {
            silent: false,
            printBackground: true,
            deviceName: defaultPrinter.name,
            margins: { marginType: 'none' },
            usePrinterDefaultPageSize: true,
          }
          : {
            silent: false,
            printBackground: true,
            pageSize: 'A4',
            margins: { marginType: 'default' },
          },
        (success, failureReason) => {
          resolve({
            success,
            code: success ? 'PRINTED' : 'PRINT_FAILED',
            message: success ? 'Printed successfully' : failureReason || 'Print failed',
          })
        }
      )
    })
  } catch (err) {
    return {
      success: false,
      code: 'ERROR',
      message: err.message || 'Print failed',
    }
  }
})

ipcMain.handle('download-invoice-pdf', async (event, payload) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender)
    const isThermal = payload?.mode === 'thermal'
    const fileName = payload?.fileName || 'invoice'

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Save Invoice PDF',
      defaultPath: `${fileName}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    })

    if (canceled || !filePath) {
      return {
        success: false,
        code: 'CANCELLED',
        message: 'PDF save cancel ho gayi',
      }
    }

    const pdfOptions = isThermal
      ? {
        printBackground: true,
        landscape: false,
        preferCSSPageSize: true,
        pageSize: {
          width: 3.15,
          height: 14,
        },
        margins: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      }
      : {
        printBackground: true,
        landscape: false,
        preferCSSPageSize: false,
        pageSize: 'A4',
        margins: {
          top: 0.2,
          bottom: 0.2,
          left: 0.2,
          right: 0.2,
        },
      }

    const pdfData = await win.webContents.printToPDF(pdfOptions)
    fs.writeFileSync(filePath, pdfData)

    return {
      success: true,
      code: 'PDF_SAVED',
      filePath,
      message: 'PDF save ho gayi',
    }
  } catch (err) {
    console.error('download-invoice-pdf error:', err)
    return {
      success: false,
      code: 'PDF_ERROR',
      message: err.message || 'PDF save failed',
    }
  }
})

function ensureDatabaseExists() {
  const userDataPath = app.getPath('userData')
  const targetDbPath = path.join(userDataPath, 'ims.sqlite')

  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true })
  }

  if (fs.existsSync(targetDbPath)) {
    console.log('Using existing DB:', targetDbPath)
    return targetDbPath
  }

  const sourceDbPath = getBundledPath('database', 'ims.sqlite')

  if (!sourceDbPath) {
    throw new Error(
      'Bundled database not found. Expected database/ims.sqlite. ' +
      'Please make sure database/ims.sqlite exists and is included in electron-builder extraResources.'
    )
  }

  fs.copyFileSync(sourceDbPath, targetDbPath)

  console.log('Copied DB from:', sourceDbPath)
  console.log('Copied DB to:', targetDbPath)

  return targetDbPath
}

async function startApp() {
  if (isStarting) {
    return
  }

  isStarting = true

  try {
    const isDev = !app.isPackaged
    const activation = isActivated()
    const dbPath = ensureDatabaseExists()

    if (!isDev) {
      await runMigrationScript(dbPath)
    } else {
      console.log('Skipping Electron migration in dev mode')
    }

    const initialRoute = activation.ok ? '/login' : '/activate'

    if (isDev) {
      const devPort = 3002
      await waitForServer(`http://127.0.0.1:${devPort}`)
      createWindow(devPort, initialRoute)
      return
    }

    const port = await getFreePort()
    const standaloneServerPath = findStandaloneServer()
    const userDataPath = app.getPath('userData')

    console.log('Standalone server path:', standaloneServerPath)
    console.log('Standalone server cwd:', path.dirname(standaloneServerPath))
    console.log('SQLite DB path:', dbPath)

    nextProcess = utilityProcess.fork(standaloneServerPath, [], {
      cwd: path.dirname(standaloneServerPath),
      env: {
        ...process.env,
        PORT: String(port),
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
        SQLITE_DB_PATH: dbPath,
        DATABASE_URL: dbPath,
        APP_USER_DATA_PATH: userDataPath,
        JWT_SECRET: process.env.JWT_SECRET || '12345',
        DEFAULT_ADMIN_NAME: 'Admin',
        DEFAULT_ADMIN_EMAIL: 'admin@gmail.com',
        DEFAULT_ADMIN_PASSWORD: '123456',
        DEFAULT_ADMIN_USER_TYPE: 'Admin',
        DEFAULT_ADMIN_STATUS: 'active',
        DEFAULT_ADMIN_ROLE: 'user',
      },
      stdio: 'inherit',
    })

    nextProcess.on('spawn', () => {
      console.log('Next standalone server started')
    })

    nextProcess.on('exit', (code) => {
      console.log('Next standalone server exited with code:', code)
      nextProcess = null
    })

    nextProcess.on('error', (err) => {
      console.error('Failed to start Next standalone server:', err)
    })

    await waitForServer(`http://127.0.0.1:${port}`, 45000)
    createWindow(port, initialRoute)
  } catch (err) {
    console.error('App startup failed:', err)
    dialog.showErrorBox(
      'App startup failed',
      err && err.message ? err.message : String(err)
    )
    app.quit()
  } finally {
    isStarting = false
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(startApp).catch((err) => {
    console.error('Fatal startup error:', err)
    dialog.showErrorBox(
      'Fatal startup error',
      err && err.message ? err.message : String(err)
    )
    app.quit()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (nextProcess) {
    try {
      nextProcess.kill()
    } catch (err) {
      console.error('Failed to kill Next process:', err)
    }
    nextProcess = null
  }
})

app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    startApp()
    return
  }

  mainWindow.show()
})