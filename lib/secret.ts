import { randomBytes } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

const secretFile = path.join(process.cwd(), 'data', 'session.secret')
let cached = process.env.SESSION_SECRET?.trim() || ''

export async function getSessionSecret() {
  if (cached) return cached
  try {
    await mkdir(path.dirname(secretFile), { recursive: true })
    try {
      const existing = (await readFile(secretFile, 'utf8')).trim()
      if (existing) {
        cached = existing
        return existing
      }
    } catch {
      /* create below */
    }
    const created = randomBytes(32).toString('base64url')
    try {
      await writeFile(secretFile, created, { flag: 'wx' })
      cached = created
      return created
    } catch {
      const existing = (await readFile(secretFile, 'utf8')).trim()
      cached = existing || created
      return cached
    }
  } catch {
    cached = randomBytes(32).toString('base64url')
    return cached
  }
}
