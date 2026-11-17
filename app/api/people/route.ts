import { requireUser } from '@/lib/auth'
import { fail, json } from '@/lib/http'
import { listProxies } from '@/lib/store'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    return json({ people: await listProxies(user) })
  } catch (error) {
    return fail(error)
  }
}
