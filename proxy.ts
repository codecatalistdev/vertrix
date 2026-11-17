import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE = 'Vertrix_session'
const OPEN = new Set(['/', '/login', '/about', '/approach', '/desk'])

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value)
  if (pathname === '/login' && signedIn) return NextResponse.redirect(new URL('/', request.url))
  if (OPEN.has(pathname)) return NextResponse.next()
  if (!signedIn) return NextResponse.redirect(new URL('/login', request.url))
  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login', '/about', '/approach', '/desk', '/dashboard/:path*', '/team/:path*', '/account/:path*', '/interviews/:path*', '/results/:path*'],
}
