import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from './constants'
import { HttpError } from './errors'

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export function fail(error: unknown) {
  if (error instanceof HttpError) {
    const response = json({ error: error.message }, error.status)
    if (error.status === 401) {
      response.cookies.set(SESSION_COOKIE, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0,
      })
    }
    return response
  }
  console.error(error)
  return json({ error: 'Something went wrong.' }, 500)
}
