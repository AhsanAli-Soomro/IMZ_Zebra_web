// app/api/login/route.js

import db from '@/lib/db'
import jwt from 'jsonwebtoken'
import { NextResponse } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || '12345'

export async function POST(req) {
    try {
        const { email, password } = await req.json()

        if (!email || !password) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Email and password are required',
                },
                { status: 400 }
            )
        }

        const query = `
      SELECT *
      FROM users
      WHERE LOWER(email) = LOWER(?)
        AND password = ?
      LIMIT 1
    `

        const result = await db.query(query, [
            String(email).trim(),
            String(password),
        ])

        if (!result || result.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Invalid email or password',
                },
                { status: 401 }
            )
        }

        const user = result[0]

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role || 'user',
                user_type: user.user_type,
            },
            JWT_SECRET,
            {
                expiresIn: '7d',
            }
        )

        return NextResponse.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name || '',
                email: user.email,
                user_type: user.user_type || 'Employee',
                status: String(user.status || 'active').toLowerCase(),
            },
        })
    } catch (error) {
        console.error('LOGIN API ERROR:', error)
        console.error('LOGIN API STACK:', error?.stack)

        return NextResponse.json(
            {
                success: false,
                message: 'Login API failed',
                error: error?.message || String(error),
            },
            { status: 500 }
        )
    }
}