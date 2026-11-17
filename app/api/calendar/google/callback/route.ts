import { requireUser } from '@/lib/auth'
import { connectGoogle, readGoogleState, requestOrigin } from '@/lib/google-calendar'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function back(origin: string, result: string) {
  const url = new URL('/', origin)
  url.searchParams.set('google', result)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const origin = requestOrigin(request)
  const state = readGoogleState(request.nextUrl.searchParams.get('state') ?? '')
  const returnOrigin = state ? new URL(state.redirectUri).origin : origin
  if (!state) return back(origin, 'failed')
  if (request.nextUrl.searchParams.get('error')) return back(returnOrigin, 'denied')
  const code = request.nextUrl.searchParams.get('code')
  if (!code) return back(returnOrigin, 'failed')
  try {
    const user = await requireUser(request)
    if (user.id !== state.uid) return back(returnOrigin, 'failed')
    await connectGoogle(user, code, state.redirectUri)
    return back(returnOrigin, 'connected')
  } catch (error) {
    console.error(error)
    return back(returnOrigin, 'failed')
  }
}
