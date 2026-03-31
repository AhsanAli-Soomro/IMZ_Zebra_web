import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

function getUploadDir() {
  if (process.env.APP_USER_DATA_PATH) {
    return path.join(process.env.APP_USER_DATA_PATH, 'images', 'stock')
  }

  return path.join(process.cwd(), 'public', 'images', 'stock')
}

function getContentType(ext) {
  switch (ext.toLowerCase()) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    default:
      return 'application/octet-stream'
  }
}

export async function GET(req, { params }) {
  try {
    const filename = params.filename
    const filePath = path.join(getUploadDir(), filename)

    if (!fs.existsSync(filePath)) {
      return new NextResponse('Image not found', { status: 404 })
    }

    const buffer = fs.readFileSync(filePath)
    const ext = path.extname(filePath)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': getContentType(ext),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('stock-image route error:', error)
    return new NextResponse('Failed to load image', { status: 500 })
  }
}