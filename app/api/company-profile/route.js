import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { saveCompanyLogo } from '@/lib/saveCompanyLogo'

export async function GET() {
  try {
    const rows = await db.query('SELECT * FROM company_profile LIMIT 1')
    const profile = rows[0]

    if (!profile) {
      return NextResponse.json({
        company_name: '',
        company_code: '',
        city: '',
        branch: '',
        contact: '',
        address: '',
        company_email: '',
        logo_url: '',
      })
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

    const company_name = formData.get('company_name') || ''
    const company_code = formData.get('company_code') || ''
    const city = formData.get('city') || ''
    const branch = formData.get('branch') || ''
    const contact = formData.get('contact') || ''
    const address = formData.get('address') || ''
    const company_email = formData.get('company_email') || ''
    const logo = formData.get('logo')
    const existing_logo = formData.get('existing_logo') || ''

    let logo_url = existing_logo

    if (logo && typeof logo.arrayBuffer === 'function' && logo.name) {
      logo_url = await saveCompanyLogo(logo)
    }

    const rows = await db.query('SELECT id FROM company_profile WHERE id = 1 LIMIT 1')

    if (rows.length > 0) {
      await db.query(
        `UPDATE company_profile SET
          company_name = ?, company_code = ?, city = ?, branch = ?,
          contact = ?, address = ?, company_email = ?, logo_url = ?
         WHERE id = 1`,
        [
          company_name,
          company_code,
          city,
          branch,
          contact,
          address,
          company_email,
          logo_url,
        ]
      )
    } else {
      await db.query(
        `INSERT INTO company_profile
          (id, company_name, company_code, city, branch, contact, address, company_email, logo_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          1,
          company_name,
          company_code,
          city,
          branch,
          contact,
          address,
          company_email,
          logo_url,
        ]
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[UPDATE PROFILE ERROR]', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}