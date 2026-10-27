const { app, BrowserWindow, utilityProcess, dialog, ipcMain, shell, nativeImage } = require('electron')
const { isActivated, activateWithKey, clearActivation } = require('./license')
const path = require('path')
const http = require('http')
const net = require('net')
const fs = require('fs')
const os = require('os')
const license = require('./license')
const { autoUpdater } = require('electron-updater')
let mainWindow = null
let nextProcess = null
let isStarting = false
let updateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  availableVersion: null,
  progress: 0,
  message: '',
}

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

function publishUpdateState(patch) {
  updateState = { ...updateState, ...patch, currentVersion: app.getVersion() }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:status', updateState)
  }
  return updateState
}

autoUpdater.on('checking-for-update', () => {
  publishUpdateState({ status: 'checking', message: 'Checking for updates...' })
})

autoUpdater.on('update-available', (info) => {
  publishUpdateState({
    status: 'available',
    availableVersion: info.version,
    progress: 0,
    message: `Version ${info.version} is available.`,
  })
})

autoUpdater.on('update-not-available', () => {
  publishUpdateState({
    status: 'up-to-date',
    availableVersion: null,
    progress: 0,
    message: 'Software is up to date.',
  })
})

autoUpdater.on('download-progress', (progress) => {
  publishUpdateState({
    status: 'downloading',
    progress: Math.round(progress.percent || 0),
    message: `Downloading update... ${Math.round(progress.percent || 0)}%`,
  })
})

autoUpdater.on('update-downloaded', (info) => {
  publishUpdateState({
    status: 'downloaded',
    availableVersion: info.version,
    progress: 100,
    message: 'Update ready. Restart to install.',
  })
})

autoUpdater.on('error', (error) => {
  publishUpdateState({
    status: 'error',
    message: error?.message || 'Update check failed. Please check your internet connection.',
  })
})

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
  try {
    if (app && typeof app.getPath === 'function') {
      const customIcon = path.join(app.getPath('userData'), 'images', 'logo', 'client-icon.ico')
      if (fs.existsSync(customIcon)) {
        return customIcon
      }
    }
  } catch {}

  const iconPath = getBundledPath('build', 'icon.ico')

  if (iconPath) {
    return iconPath
  }

  return path.join(__dirname, '..', 'build', 'icon.ico')
}
function getLocalLanIp() {
  try {
    const ifaces = os.networkInterfaces()
    for (const dev in ifaces) {
      for (const details of ifaces[dev]) {
        if (details.family === 'IPv4' && !details.internal) {
          return details.address
        }
      }
    }
  } catch {}
  return '127.0.0.1'
}

function getNetworkConfig() {
  try {
    const cfgPath = path.join(app.getPath('userData'), 'network-config.json')
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, 'utf-8'))
    }
  } catch (err) {
    console.warn('Could not read network-config.json:', err.message)
  }
  return null
}

function saveNetworkConfig(cfg) {
  try {
    const cfgPath = path.join(app.getPath('userData'), 'network-config.json')
    if (cfg === null) {
      if (fs.existsSync(cfgPath)) fs.unlinkSync(cfgPath)
      return true
    }
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('Could not save network-config.json:', err)
    return false
  }
}

function createWindow(port, route = '/') {
  createWindowDirect(`http://127.0.0.1:${port}${route}`)
}

function createWindowDirect(fullUrl) {
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
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools()
  }
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
    const netCfg = getNetworkConfig()
    if (netCfg && netCfg.mode === 'counter' && mainWindow && !mainWindow.isDestroyed()) {
      dialog
        .showMessageBox(mainWindow, {
          type: 'warning',
          title: 'Main Server Not Reachable',
          message: `Could not connect to Main Server at ${netCfg.serverUrl}.\n\n1. Make sure Main Server PC is turned on and Zebra IMS is running.\n2. Make sure this PC is connected to the same Wi-Fi or LAN router.\n\nWould you like to retry or change server settings?`,
          buttons: ['Retry Connection', 'Change Server IP'],
        })
        .then(({ response }) => {
          if (response === 1) {
            saveNetworkConfig(null)
            app.relaunch()
            app.exit(0)
          } else {
            mainWindow.loadURL(fullUrl)
          }
        })
    }
  })

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('render-process-gone:', details)
  })

  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log('renderer console:', { level, message, line, sourceId })
  })

  mainWindow.loadURL(fullUrl)
}

/* =========================
   LICENSE IPC HANDLERS
========================= */

ipcMain.handle('license:check', async () => {
  try {
    return await isActivated()
  } catch (err) {
    console.error('license:check error', err)
    return {
      ok: false,
      reason: 'check_failed',
      message: err.message || 'Activation check failed',
    }
  }
})
ipcMain.handle('license:check-online', async () => {
  try {
    return await license.checkActivationOnline()
  } catch (err) {
    console.error('license:check-online error', err)
    return {
      ok: false,
      reason: 'check_failed',
      message: err.message || 'Online activation check failed',
    }
  }
})
ipcMain.handle('license:get-machine-info', async () => {
  try {
    return license.getSystemInfo()
  } catch (err) {
    console.error('license:get-machine-info error', err)
    return null
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
   SOFTWARE UPDATE IPC HANDLERS
========================= */

ipcMain.handle('update:get-state', async () => updateState)

ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) {
    return publishUpdateState({
      status: 'development',
      message: 'Update checks are available in the installed application.',
    })
  }

  if (updateState.status === 'checking' || updateState.status === 'downloading') {
    return updateState
  }

  try {
    publishUpdateState({ status: 'checking', message: 'Checking for updates...' })
    await autoUpdater.checkForUpdates()
    return updateState
  } catch (error) {
    console.error('update:check error', error)
    return publishUpdateState({
      status: 'error',
      message: 'Unable to check for updates. Please check your internet connection.',
    })
  }
})

ipcMain.handle('update:download', async () => {
  if (updateState.status !== 'available') return updateState

  try {
    publishUpdateState({ status: 'downloading', progress: 0, message: 'Downloading update... 0%' })
    await autoUpdater.downloadUpdate()
    return updateState
  } catch (error) {
    console.error('update:download error', error)
    return publishUpdateState({
      status: 'error',
      message: 'Update download failed. Please check your internet connection.',
    })
  }
})

ipcMain.handle('update:install', async () => {
  if (updateState.status !== 'downloaded') {
    return publishUpdateState({
      status: 'error',
      message: 'Download the update before installing it.',
    })
  }

  const installingState = publishUpdateState({
    status: 'installing',
    message: 'Restarting to install update...',
  })
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
  return installingState
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

function convertPngToIco(pngBuffer) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)

  const entry = Buffer.alloc(16)
  entry.writeUInt8(0, 0) // 256px
  entry.writeUInt8(0, 1) // 256px
  entry.writeUInt8(0, 2)
  entry.writeUInt8(0, 3)
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(pngBuffer.length, 8)
  entry.writeUInt32LE(22, 12)

  return Buffer.concat([header, entry, pngBuffer])
}

function ensureClientIcon() {
  try {
    const userData = app.getPath('userData')
    const logoDir = path.join(userData, 'images', 'logo')
    const icoPath = path.join(logoDir, 'client-icon.ico')

    const searchDirs = [
      logoDir,
      path.join(__dirname, '..', 'public', 'logo'),
    ]

    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir)
        const logoFile = files.find((f) => /^company-logo\.(png|jpe?g|webp)$/i.test(f))
        if (logoFile) {
          const srcPath = path.join(dir, logoFile)
          if (typeof nativeImage !== 'undefined') {
            const img = nativeImage.createFromPath(srcPath)
            if (!img.isEmpty()) {
              const resized = img.resize({ width: 256, height: 256 })
              const pngBuf = resized.toPNG()
              const icoBuf = convertPngToIco(pngBuf)
              if (!fs.existsSync(logoDir)) {
                fs.mkdirSync(logoDir, { recursive: true })
              }
              fs.writeFileSync(icoPath, icoBuf)
              return icoPath
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error generating client-icon.ico:', err)
  }

  return getIconPath()
}

ipcMain.handle('shortcut:create-client', async (_event, payload) => {
  try {
    const companyName = payload?.companyName?.trim() || 'Zebra IMS'
    const safeName = companyName.replace(/[\\/:*?"<>|]/g, '').trim() || 'Zebra IMS'

    const iconPath = ensureClientIcon()

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(`${safeName} - Zebra IMS`)
      if (iconPath && fs.existsSync(iconPath)) {
        try {
          mainWindow.setIcon(iconPath)
        } catch (e) {}
      }
    }

    if (process.platform === 'win32') {
      const desktopDir = app.getPath('desktop')
      const exePath = process.execPath
      const targetDir = path.dirname(exePath)
      const newShortcutPath = path.join(desktopDir, `${safeName}.lnk`)

      let written = false
      if (typeof shell.writeShortcutLink === 'function') {
        try {
          written = shell.writeShortcutLink(newShortcutPath, 'create', {
            target: exePath,
            cwd: targetDir,
            description: safeName,
            icon: iconPath,
            iconIndex: 0,
          })
        } catch (err) {
          console.warn('shell.writeShortcutLink error, trying PowerShell fallback:', err)
        }
      }

      if (!written) {
        const { exec } = require('child_process')
        const escapedShortcut = newShortcutPath.replace(/'/g, "''")
        const escapedExe = exePath.replace(/'/g, "''")
        const escapedDir = targetDir.replace(/'/g, "''")
        const escapedDesc = safeName.replace(/'/g, "''")
        const escapedIcon = iconPath.replace(/'/g, "''")

        const psCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('${escapedShortcut}'); $Shortcut.TargetPath = '${escapedExe}'; $Shortcut.WorkingDirectory = '${escapedDir}'; $Shortcut.Description = '${escapedDesc}'; $Shortcut.IconLocation = '${escapedIcon}'; $Shortcut.Save()"`

        await new Promise((resolve) => {
          exec(psCommand, (err) => {
            if (err) console.error('PowerShell shortcut error:', err)
            resolve()
          })
        })
      }

      // Remove default generic shortcut if different name
      if (safeName.toLowerCase() !== 'zebra ims') {
        const defaultShortcutPath = path.join(desktopDir, 'Zebra IMS.lnk')
        if (fs.existsSync(defaultShortcutPath)) {
          try {
            fs.unlinkSync(defaultShortcutPath)
          } catch (e) {}
        }
      }

      return { success: true, shortcutPath: newShortcutPath, iconPath }
    }

    return { success: true, platform: process.platform }
  } catch (err) {
    console.error('shortcut:create-client error:', err)
    return { success: false, error: err.message }
  }
})

ipcMain.handle('network:get-config', async () => {
  const cfg = getNetworkConfig()
  return {
    ...cfg,
    localIp: getLocalLanIp(),
  }
})

ipcMain.handle('network:save-config', async (_event, cfg) => {
  saveNetworkConfig(cfg)
  return { success: true }
})

ipcMain.handle('network:get-local-ip', async () => {
  return getLocalLanIp()
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
    const netCfg = getNetworkConfig()

    // 1. Counter Mode: Direct connect to Main Server (No local DB, no local server needed!)
    if (netCfg && netCfg.mode === 'counter' && netCfg.serverUrl) {
      console.log('Starting in Counter PC Mode. Connecting to Main Server:', netCfg.serverUrl)
      createWindowDirect(`${netCfg.serverUrl}/login`)
      return
    }

    const activation = await isActivated()
    const dbPath = ensureDatabaseExists()

    if (!isDev) {
      await runMigrationScript(dbPath)
    } else {
      console.log('Skipping Electron migration in dev mode')
    }

    // Determine initial route: if first install and no network config, prompt network setup!
    let initialRoute = '/'
    if (!netCfg) {
      initialRoute = '/network-setup'
    } else if (!activation.ok) {
      initialRoute = '/activate'
    } else {
      initialRoute = '/login'
    }

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
        HOSTNAME: '0.0.0.0', // Binds to all interfaces for local LAN Counter PCs!
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
