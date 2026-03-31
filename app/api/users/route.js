import db from '@/lib/db'

export async function GET() {
  try {
    const rows = await db.query('SELECT * FROM users')
    return Response.json(rows)
  } catch (error) {
    console.error('MySQL error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function POST(req) {
  const { name, email } = await req.json()
  try {
    const result = await db.query(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      [name, email]
    )
    return Response.json({ insertedId: result.insertId })
  } catch (error) {
    console.error('Error inserting user:', error)
    return new Response('Error inserting user', { status: 500 })
  }
}