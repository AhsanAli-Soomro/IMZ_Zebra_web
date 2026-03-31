import fs from 'fs'
import path from 'path'

function getUploadDir() {
  if (process.env.APP_USER_DATA_PATH) {
    return path.join(process.env.APP_USER_DATA_PATH, 'images', 'stock')
  }

  return path.join(process.cwd(), 'public', 'images', 'stock')
}

export async function saveImageFile(file) {
  console.log('--- saveImageFile START ---')

  console.log('ENV PATH:', process.env.APP_USER_DATA_PATH)

  const buffer = Buffer.from(await file.arrayBuffer())

  const safeName = String(file.name || 'image').replace(/[^\w.-]/g, '_')
  const filename = `${Date.now()}-${safeName}`

  console.log('File name:', filename)

  const dir = getUploadDir()
  console.log('Upload dir:', dir)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log('Created dir:', dir)
  }

  const filePath = path.join(dir, filename)
  fs.writeFileSync(filePath, buffer)

  console.log('Saved file at:', filePath)

  const returnPath = process.env.APP_USER_DATA_PATH
    ? `/api/stock-image/${filename}`
    : `/images/stock/${filename}`

  console.log('Returning image path:', returnPath)
  console.log('--- saveImageFile END ---')

  return returnPath
}