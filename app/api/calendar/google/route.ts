import { requireUser } from '@/lib/auth'
import { disconnectGoogle, googleAccountStatus, googleConfigured, googleRedirectUri, requestOrigin } from '@/lib/google-calendar'
import { fail, json } from '@/lib/http'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const status = await googleAccountStatus(user.id)
    return json({
      configured: googleConfigured(),
      redirectUri: googleRedirectUri(requestOrigin(request)),
      ...status,
    })
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser(request)
    await disconnectGoogle(user.id)
    return json({ ok: true })
  } catch (error) {
    return fail(error)
  }
}
