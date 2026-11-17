import { assertOrigin, requireUser } from '@/lib/auth'
import { HttpError } from '@/lib/errors'
import { fail, json } from '@/lib/http'
import { createUser, listUsers } from '@/lib/store'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    return json({ users: await listUsers(user) })
  } catch (error) {
    return fail(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    assertOrigin(request)
    const user = await requireUser(request)
    const body = await request.json().catch(() => null)
    if (!body) throw new HttpError(400, 'The request could not be read.')
    const created = await createUser(user, body)
    return json({ user: created }, 201)
  } catch (error) {
    return fail(error)
  }
}
