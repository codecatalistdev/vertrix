import { requireUser } from '@/lib/auth'
import { disconnectGoogle, googleConfigured, googleRedirectUri, requestOrigin, syncUserCalendar } from '@/lib/google-calendar'
import { fail, json } from '@/lib/http'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const account = googleConfigured() ? await syncUserCalendar(user) : null
    return json({
      configured: googleConfigured(),
      redirectUri: googleRedirectUri(requestOrigin(request)),
      connected: Boolean(account),
      email: account?.email ?? null,
      error: account?.error ?? null,
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
