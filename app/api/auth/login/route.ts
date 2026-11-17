import { cookieOptions, signSession, authenticate, assertOrigin } from '@/lib/auth'
import { SESSION_COOKIE } from '@/lib/constants'
import { fail, json } from '@/lib/http'
import { toPublic } from '@/lib/store'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    assertOrigin(request)
    const body = await request.json().catch(() => ({}))
    const email = String(body.email ?? '')
    const password = String(body.password ?? '')
    const user = await authenticate(email, password)
    if (!user) return json({ error: 'Email or password is incorrect.' }, 401)
    const response = json({ user: toPublic(user) })
    response.cookies.set(SESSION_COOKIE, await signSession(user.id), cookieOptions())
    return response
  } catch (error) {
    return fail(error)
  }
}
