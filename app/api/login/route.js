// app/api/login/route.js

import db from '@/lib/db'
import jwt from 'jsonwebtoken'
import { NextResponse } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET

export async function POST(req) {
    try {
        const { email, password } = await req.json()

        if (!email || !password) {
            return NextResponse.json(
                { success: false, message: 'Email and password are required' },
                { status: 400 }
            )
        }

        const query = 'SELECT * FROM users WHERE email = ? AND password = ? LIMIT 1'
        const result = await db.query(query, [email, password])

        if (result.length === 0) {
            return NextResponse.json(
                { success: false, message: 'Invalid email or password' },
                { status: 401 }
            )
        }

        const user = result[0]

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role || 'user',
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        )

        return NextResponse.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                user_type: user.user_type, // <--- important
                status: user.status,// in case you're using "active" check
            },
        })
    } catch (error) {
        console.error('Login error:', error)
        return NextResponse.json(
            { success: false, message: 'Server error' },
            { status: 500 }
        )
    }
}
