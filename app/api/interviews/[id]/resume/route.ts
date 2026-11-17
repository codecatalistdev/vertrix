import { assertOrigin, requireUser } from '@/lib/auth'
import { HttpError } from '@/lib/errors'
import { fail, json } from '@/lib/http'
import { readResume, removeResume, saveResume } from '@/lib/store'
import { NextResponse, type NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request)
    const { id } = await context.params
    const { resume, bytes } = await readResume(user, id)
    const ascii = resume.originalName.replace(/[^\w.\- ()]/g, '_') || 'resume'
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': resume.mime,
        'Content-Length': String(bytes.length),
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(resume.originalName)}`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return fail(error)
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    assertOrigin(request)
    const user = await requireUser(request)
    const { id } = await context.params
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new HttpError(400, 'Choose a resume file.')
    const interview = await saveResume(user, id, {
      name: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
    })
    return json({ interview })
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertOrigin(request)
    const user = await requireUser(request)
    const { id } = await context.params
    return json({ interview: await removeResume(user, id) })
  } catch (error) {
    return fail(error)
  }
}
