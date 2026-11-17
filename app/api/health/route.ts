import { requireUser } from '@/lib/auth'
import { fail, json } from '@/lib/http'
import { storageMode } from '@/lib/store'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireUser(request)
    const storage = await storageMode()
    return json({ storage })
  } catch (error) {
    return fail(error)
  }
}
