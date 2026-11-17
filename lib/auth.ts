import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE } from './constants'
import { HttpError } from './errors'
import { hashPassword, verifyPassword } from './password'
import { getSessionSecret } from './secret'
import { findUserByEmail, findUserById } from './store'
import type { Role, UserRecord } from './types'

type Payload = { uid: string; exp: number }

let dummyHash = ''

async function dummyPasswordHash() {
  if (!dummyHash) dummyHash = await hashPassword(randomBytes(16).toString('base64url'))
  return dummyHash
}

export async function signSession(userId: string) {
  const payload: Payload = { uid: userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const secret = await getSessionSecret()
  const signature = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${signature}`
}

export async function readSession(token: string | undefined) {
  if (!token) return null
  const [body, signature] = token.split('.')
  if (!body || !signature) return null
  const secret = await getSessionSecret()
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as Payload
    if (!payload?.uid || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function cookieOptions(maxAge = 7 * 24 * 60 * 60) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

export async function userFromRequest(request: NextRequest) {
  const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value)
  if (!session) return null
  return findUserById(session.uid)
}

export async function requireUser(request: NextRequest) {
  const user = await userFromRequest(request)
  if (!user) throw new HttpError(401, 'Sign in required.')
  return user
}

export async function requireRole(request: NextRequest, roles: Role[]) {
  const user = await requireUser(request)
  if (!roles.includes(user.role)) throw new HttpError(403, 'You do not have access to that.')
  return user
}

export function assertOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin) return
  const host = request.headers.get('host')
  if (!host || new URL(origin).host !== host) throw new HttpError(403, 'Blocked request.')
}

export async function authenticate(email: string, password: string): Promise<UserRecord | null> {
  const user = await findUserByEmail(email.trim().toLowerCase())
  const hash = user?.passwordHash ?? (await dummyPasswordHash())
  const match = await verifyPassword(password, hash)
  if (!user || !match) return null
  return user
}
