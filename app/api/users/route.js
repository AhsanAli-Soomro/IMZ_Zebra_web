// app/api/users/route.js
import { db } from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await db.query('SELECT * FROM users');
    return Response.json(rows);
  } catch (error) {
    console.error('MySQL error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}


// app/api/users/route.js
export async function POST(req) {
  const { name, email } = await req.json();
  try {
    const [result] = await db.execute(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      [name, email]
    );
    return Response.json({ insertedId: result.insertId });
  } catch (error) {
    return new Response('Error inserting user', { status: 500 });
  }
}
