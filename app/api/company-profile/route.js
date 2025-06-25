import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import db from '@/lib/db'

export async function GET() {
  try {
    const rows = await db.query('SELECT * FROM company_profile LIMIT 1')
    const profile = rows[0]

    if (!profile) {
      return NextResponse.json({ error: 'No profile found' }, { status: 404 })
    }

    return NextResponse.json(JSON.parse(JSON.stringify(profile)))
  } catch (err) {
    console.error('[GET PROFILE ERROR]', err)
    return NextResponse.json({ error: 'Failed to fetch company profile' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData()

    const company_name = formData.get('company_name')
    const company_code = formData.get('company_code')
    const city = formData.get('city')
    const branch = formData.get('branch')
    const contact = formData.get('contact')
    const address = formData.get('address')
    const company_email = formData.get('company_email')
    const logo = formData.get('logo')
    const existing_logo = formData.get('existing_logo')

    let logo_url = existing_logo

    if (logo && typeof logo === 'object') {
      const buffer = Buffer.from(await logo.arrayBuffer())
      const ext = logo.name.split('.').pop()
      const filename = `logo.${ext}`
      const savePath = path.join(process.cwd(), 'public', 'logo', filename)

      fs.writeFileSync(savePath, buffer)
      logo_url = `/logo/${filename}`
    }

    const updateQuery = `
      UPDATE company_profile SET
        company_name = ?, company_code = ?, city = ?, branch = ?,
        contact = ?, address = ?, company_email = ?, logo_url = ?
      WHERE id = 1
    `

    const result = await db.query(updateQuery, [
      company_name,
      company_code,
      city,
      branch,
      contact,
      address,
      company_email,
      logo_url,
    ])

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'No profile row to update' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[UPDATE PROFILE ERROR]', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
