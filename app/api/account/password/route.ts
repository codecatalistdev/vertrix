import { assertOrigin, requireUser } from '@/lib/auth'
import { HttpError } from '@/lib/errors'
import { fail, json } from '@/lib/http'
import { verifyPassword } from '@/lib/password'
import { changePassword } from '@/lib/store'
import { assertPassword } from '@/lib/validate'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    assertOrigin(request)
    const user = await requireUser(request)
    const body = await request.json().catch(() => null)
    if (!body) throw new HttpError(400, 'The request could not be read.')
    const nextPassword = assertPassword(body.newPassword)
    if (nextPassword === String(body.currentPassword ?? '')) {
      throw new HttpError(400, 'Choose a different password.')
    }
    const matches = await verifyPassword(String(body.currentPassword ?? ''), user.passwordHash)
    if (!matches) throw new HttpError(400, 'Current password is incorrect.')
    await changePassword(user.id, nextPassword)
    return json({ ok: true })
  } catch (error) {
    return fail(error)
  }
}
