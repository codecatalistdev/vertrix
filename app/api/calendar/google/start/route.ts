import { requireUser } from '@/lib/auth'
import { googleAuthUrl, googleConfigured, googleRedirectUri, requestOrigin, signGoogleState } from '@/lib/google-calendar'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const origin = requestOrigin(request)
  try {
    const user = await requireUser(request)
    const redirectUri = googleRedirectUri(origin)
    if (!googleConfigured()) return NextResponse.redirect(new URL('/?google=setup', origin))
    const state = signGoogleState({ uid: user.id, exp: Date.now() + 10 * 60 * 1000, redirectUri })
    const url = state ? googleAuthUrl(state, redirectUri) : null
    if (!url) return NextResponse.redirect(new URL('/?google=setup', origin))
    return NextResponse.redirect(url)
  } catch {
    return NextResponse.redirect(new URL('/login', origin))
  }
}
