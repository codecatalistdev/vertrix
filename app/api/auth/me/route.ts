import { requireUser } from '@/lib/auth'
import { fail, json } from '@/lib/http'
import { toPublic } from '@/lib/store'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    return json({ user: toPublic(user) })
  } catch (error) {
    return fail(error)
  }
}
