const fs = require('fs')
const path = require('path')

module.exports = async function afterPack(context) {
  const unpackedRoot = path.join(context.appOutDir, 'resources', 'app.asar.unpacked')
  const nativeSource = path.join(unpackedRoot, 'node_modules', 'better-sqlite3')
  const standaloneTarget = path.join(
    unpackedRoot,
    '.next',
    'standalone',
    'node_modules',
    'better-sqlite3'
  )

  if (!fs.existsSync(nativeSource)) {
    throw new Error(`Target native SQLite module was not packaged: ${nativeSource}`)
  }

  fs.rmSync(standaloneTarget, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(standaloneTarget), { recursive: true })
  fs.cpSync(nativeSource, standaloneTarget, { recursive: true })

  const nativeBinary = path.join(
    standaloneTarget,
    'build',
    'Release',
    'better_sqlite3.node'
  )

  if (!fs.existsSync(nativeBinary)) {
    throw new Error(`Standalone native SQLite binary was not synchronized: ${nativeBinary}`)
  }

  console.log(`Synchronized ${context.electronPlatformName} SQLite binary into standalone server`)
}
