import { assertOrigin, requireUser } from '@/lib/auth'
import { HttpError } from '@/lib/errors'
import { fail, json } from '@/lib/http'
import { deleteInterview, getInterview, updateInterview } from '@/lib/store'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request)
    const { id } = await context.params
    return json({ interview: await getInterview(user, id) })
  } catch (error) {
    return fail(error)
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    assertOrigin(request)
    const user = await requireUser(request)
    const { id } = await context.params
    const body = await request.json().catch(() => null)
    if (!body) throw new HttpError(400, 'The request could not be read.')
    return json({ interview: await updateInterview(user, id, body) })
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertOrigin(request)
    const user = await requireUser(request)
    const { id } = await context.params
    await deleteInterview(user, id)
    return json({ ok: true })
  } catch (error) {
    return fail(error)
  }
}
