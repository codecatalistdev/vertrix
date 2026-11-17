import { cookieOptions, assertOrigin } from '@/lib/auth'
import { SESSION_COOKIE } from '@/lib/constants'
import { fail, json } from '@/lib/http'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    assertOrigin(request)
    const response = json({ ok: true })
    response.cookies.set(SESSION_COOKIE, '', cookieOptions(0))
    return response
  } catch (error) {
    return fail(error)
  }
}
