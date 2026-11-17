import { assertOrigin, requireUser } from '@/lib/auth'
import { removeAvailability } from '@/lib/availability'
import { fail, json } from '@/lib/http'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertOrigin(request)
    const user = await requireUser(request)
    const { id } = await context.params
    return json(await removeAvailability(user, id))
  } catch (error) {
    return fail(error)
  }
}
