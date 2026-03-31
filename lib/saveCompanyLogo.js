import fs from 'fs'
import path from 'path'

function getLogoDir() {
  if (process.env.APP_USER_DATA_PATH) {
    return path.join(process.env.APP_USER_DATA_PATH, 'images', 'logo')
  }

  return path.join(process.cwd(), 'public', 'logo')
}

export async function saveCompanyLogo(file) {
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = (file.name?.split('.').pop() || 'png').toLowerCase()
  const filename = `company-logo.${ext}`
  const dir = getLogoDir()

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const filePath = path.join(dir, filename)
  fs.writeFileSync(filePath, buffer)

  if (process.env.APP_USER_DATA_PATH) {
    return `/api/company-logo/${filename}`
  }

  return `/logo/${filename}`
}