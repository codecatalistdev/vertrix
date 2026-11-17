import { assertOrigin, requireUser } from '@/lib/auth'
import { HttpError } from '@/lib/errors'
import { fail, json } from '@/lib/http'
import { deleteUser, updateUser } from '@/lib/store'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertOrigin(request)
    const user = await requireUser(request)
    const { id } = await context.params
    const body = await request.json().catch(() => null)
    if (!body) throw new HttpError(400, 'The request could not be read.')
    return json({ user: await updateUser(user, id, body) })
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertOrigin(request)
    const user = await requireUser(request)
    const { id } = await context.params
    await deleteUser(user, id)
    return json({ ok: true })
  } catch (error) {
    return fail(error)
  }
}
