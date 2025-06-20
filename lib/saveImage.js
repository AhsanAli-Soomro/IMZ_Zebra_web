import fs from 'fs'
import path from 'path'

export async function saveImageFile(file) {
  const buffer = Buffer.from(await file.arrayBuffer())
  const filename = `${Date.now()}-${file.name}`
  const dir = path.join(process.cwd(), 'public/images/stock')

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const filePath = path.join(dir, filename)
  fs.writeFileSync(filePath, buffer)

  return `/images/stock/${filename}`
}
