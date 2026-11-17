import { assertOrigin, requireUser } from '@/lib/auth'
import { pushInterview } from '@/lib/google-calendar'
import { HttpError } from '@/lib/errors'
import { fail, json } from '@/lib/http'
import { createInterview, listInterviews } from '@/lib/store'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    return json({ interviews: await listInterviews(user) })
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
    const interview = await createInterview(user, body)
    await pushInterview(interview)
    return json({ interview }, 201)
  } catch (error) {
    return fail(error)
  }
}
