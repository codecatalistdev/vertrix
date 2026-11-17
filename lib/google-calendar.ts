import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { CET_ZONE, EST_ZONE, STATUSES, stepLabel } from './constants'
import { canViewInterview } from './policy'
import { getSessionSecret } from './secret'
import { findUserById, listInterviews } from './store'
import { supabase } from './supabase'
import { formatClock, interviewInstants } from './time'
import type { InterviewView, UserRecord } from './types'

const BUCKET = 'google-calendar'
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const tokenCache = new Map<string, { token: string; exp: number }>()

type Account = {
  email: string
  refreshToken: string
  error: string | null
}

type GoogleState = {
  uid: string
  exp: number
  redirectUri: string
}

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim())
}

export function requestOrigin(request: { headers: Headers; nextUrl: { origin: string } }) {
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host')
  if (proto && host) return `${proto}://${host}`
  return request.nextUrl.origin
}

export function googleRedirectUri(origin: string) {
  return `${origin}/api/calendar/google/callback`
}

export function signGoogleState(state: GoogleState) {
  const secret = getSessionSecret()
  if (!secret) return null
  const body = Buffer.from(JSON.stringify(state)).toString('base64url')
  const signature = createHmac('sha256', secret).update(`google:${body}`).digest('base64url')
  return `${body}.${signature}`
}

export function readGoogleState(token: string): GoogleState | null {
  const secret = getSessionSecret()
  const [body, signature] = token.split('.')
  if (!secret || !body || !signature || token.split('.').length !== 2) return null
  const expected = createHmac('sha256', secret).update(`google:${body}`).digest('base64url')
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null
  try {
    const state = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as GoogleState
    const redirect = new URL(state.redirectUri)
    if (!state.uid || state.exp < Date.now()) return null
    if (redirect.protocol !== 'https:' && redirect.protocol !== 'http:') return null
    if (redirect.pathname !== '/api/calendar/google/callback') return null
    return state
  } catch {
    return null
  }
}

function credentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? ''
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? ''
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

function encryptionKey() {
  const secret = getSessionSecret()
  if (!secret) return null
  return createHmac('sha256', secret).update('google-calendar').digest()
}

function encrypt(value: string) {
  const key = encryptionKey()
  if (!key) throw new Error('SESSION_SECRET is not set.')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
}

function decrypt(value: string) {
  const key = encryptionKey()
  if (!key) throw new Error('SESSION_SECRET is not set.')
  const bytes = Buffer.from(value, 'base64url')
  const iv = bytes.subarray(0, 12)
  const tag = bytes.subarray(12, 28)
  const encrypted = bytes.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

async function bucket() {
  const client = supabase()
  const found = await client.storage.getBucket(BUCKET)
  if (found.error) {
    const created = await client.storage.createBucket(BUCKET, { public: false })
    if (created.error && !/already exists|duplicate/i.test(created.error.message)) throw created.error
  }
  return client.storage.from(BUCKET)
}

async function readJson<T>(path: string): Promise<T | null> {
  const file = await (await bucket()).download(path)
  if (file.error || !file.data) return null
  try {
    return JSON.parse(await file.data.text()) as T
  } catch {
    return null
  }
}

async function writeJson(path: string, value: unknown) {
  const uploaded = await (await bucket()).upload(path, Buffer.from(JSON.stringify(value)), {
    contentType: 'application/json',
    upsert: true,
  })
  if (uploaded.error) throw uploaded.error
}

function accountPath(userId: string) {
  return `accounts/${userId}.json`
}

function eventPath(userId: string, interviewId: string) {
  return `events/${userId}/${interviewId}.json`
}

async function readAccount(userId: string) {
  return readJson<Account>(accountPath(userId))
}

async function writeAccount(userId: string, account: Account) {
  tokenCache.delete(userId)
  await writeJson(accountPath(userId), account)
}

async function listConnectedUserIds() {
  const listed = await (await bucket()).list('accounts', { limit: 1000 })
  if (listed.error || !listed.data) return []
  return listed.data.map((file) => file.name.replace(/\.json$/, '')).filter(Boolean)
}

export async function googleAccountStatus(userId: string) {
  if (!googleConfigured()) return { connected: false, email: null as string | null, error: null as string | null }
  try {
    const account = await readAccount(userId)
    return { connected: Boolean(account), email: account?.email ?? null, error: account?.error ?? null }
  } catch (error) {
    console.error(error)
    return { connected: false, email: null, error: 'Google Calendar storage is unavailable.' }
  }
}

export function googleAuthUrl(state: string, redirectUri: string) {
  const config = credentials()
  if (!config) return null
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPE)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('state', state)
  return url
}

async function exchangeCode(code: string, redirectUri: string) {
  const config = credentials()
  if (!config) throw new Error('Google Calendar is not configured.')
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(8000),
  })
  const data = (await response.json()) as { refresh_token?: string; error?: string; error_description?: string }
  if (!response.ok || !data.refresh_token) {
    throw new Error(data.error_description || 'Google did not return a connection.')
  }
  return data.refresh_token
}

async function accessToken(userId: string, account: Account) {
  const cached = tokenCache.get(userId)
  if (cached && cached.exp > Date.now() + 30_000) return cached.token
  const config = credentials()
  if (!config) throw new Error('Google Calendar is not configured.')
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: decrypt(account.refreshToken),
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(8000),
  })
  const data = (await response.json()) as { access_token?: string; expires_in?: number; error_description?: string }
  if (!response.ok || !data.access_token) throw new Error(data.error_description || 'Google refused the saved connection.')
  tokenCache.set(userId, { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 })
  return data.access_token
}

async function calendarFetch(userId: string, account: Account, path: string, init: RequestInit = {}) {
  const token = await accessToken(userId, account)
  return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(8000),
  })
}

function googleDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CET_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const map: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  const hour = map.hour === '24' ? '00' : map.hour
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}:${map.second}`
}

function eventBody(interview: InterviewView) {
  const range = interviewInstants(interview.date, interview.startMinutes, interview.durationMinutes)
  const status = STATUSES.find((item) => item.value === interview.status)?.label ?? interview.status
  const summary = [
    interview.step ? stepLabel(interview.step) : '',
    interview.title,
    status === 'Scheduled' ? '' : status,
  ].filter(Boolean).join(' · ')
  const description = [
    `Result: ${status}`,
    `Proxy interviewer: ${interview.interviewerName}`,
    `CET: ${formatClock(range.start, CET_ZONE)}–${formatClock(range.end, CET_ZONE)}`,
    `EST: ${formatClock(range.start, EST_ZONE)}–${formatClock(range.end, EST_ZONE)}`,
    interview.realMeetingLink ? `Real meeting: ${interview.realMeetingLink}` : '',
    interview.supportMeetingLink ? `Support meeting: ${interview.supportMeetingLink}` : '',
    interview.note.trim() ? `Note: ${interview.note.trim()}` : '',
  ].filter(Boolean).join('\n')
  return {
    summary,
    description,
    start: { dateTime: googleDateTime(range.start), timeZone: CET_ZONE },
    end: { dateTime: googleDateTime(range.end), timeZone: CET_ZONE },
    extendedProperties: { private: { vertrixId: interview.id } },
  }
}

async function existingEventId(userId: string, account: Account, interviewId: string) {
  const saved = await readJson<{ id: string }>(eventPath(userId, interviewId))
  if (saved?.id) return saved.id
  const query = new URLSearchParams({
    privateExtendedProperty: `vertrixId=${interviewId}`,
    maxResults: '1',
    singleEvents: 'true',
  })
  const response = await calendarFetch(userId, account, `/calendars/primary/events?${query}`)
  if (!response.ok) return null
  const data = (await response.json().catch(() => ({}))) as { items?: { id?: string }[] }
  return data.items?.[0]?.id ?? null
}

async function rememberFailure(userId: string, account: Account, error: unknown) {
  const message = error instanceof Error ? error.message : 'Google Calendar could not be updated.'
  account.error = message
  await writeAccount(userId, account).catch((writeError) => console.error(writeError))
}

async function upsertForUser(userId: string, account: Account, interview: InterviewView) {
  const savedId = await existingEventId(userId, account, interview.id)
  const body = JSON.stringify(eventBody(interview))
  if (savedId) {
    const saved = { id: savedId }
    const updated = await calendarFetch(userId, account, `/calendars/primary/events/${encodeURIComponent(saved.id)}`, {
      method: 'PATCH',
      body,
    })
    if (updated.ok) {
      await writeJson(eventPath(userId, interview.id), { id: saved.id })
      if (account.error) {
        account.error = null
        await writeAccount(userId, account)
      }
      return
    }
    if (updated.status !== 404 && updated.status !== 410) {
      const detail = (await updated.json().catch(() => ({}))) as { error?: { message?: string } }
      throw new Error(detail.error?.message || 'Google Calendar could not update the interview.')
    }
  }
  const created = await calendarFetch(userId, account, '/calendars/primary/events', { method: 'POST', body })
  const data = (await created.json().catch(() => ({}))) as { id?: string; error?: { message?: string } }
  if (!created.ok || !data.id) throw new Error(data.error?.message || 'Google Calendar could not add the interview.')
  await writeJson(eventPath(userId, interview.id), { id: data.id })
  if (account.error) {
    account.error = null
    await writeAccount(userId, account)
  }
}

async function deleteForUser(userId: string, account: Account, interviewId: string) {
  const saved = await readJson<{ id: string }>(eventPath(userId, interviewId))
  if (saved?.id) {
    const removed = await calendarFetch(userId, account, `/calendars/primary/events/${encodeURIComponent(saved.id)}`, {
      method: 'DELETE',
    })
    if (!removed.ok && removed.status !== 404 && removed.status !== 410) {
      const detail = (await removed.json().catch(() => ({}))) as { error?: { message?: string } }
      throw new Error(detail.error?.message || 'Google Calendar could not remove the interview.')
    }
  }
  await (await bucket()).remove([eventPath(userId, interviewId)])
}

async function syncUser(userId: string, interview: InterviewView) {
  const account = await readAccount(userId)
  if (!account) return
  const user = await findUserById(userId)
  if (!user) return
  try {
    if (canViewInterview(user, interview)) await upsertForUser(userId, account, interview)
    else await deleteForUser(userId, account, interview.id)
  } catch (error) {
    console.error(error)
    await rememberFailure(userId, account, error)
  }
}

export async function pushInterview(interview: InterviewView) {
  if (!googleConfigured()) return
  try {
    const userIds = await listConnectedUserIds()
    await Promise.all(userIds.map((userId) => syncUser(userId, interview)))
  } catch (error) {
    console.error(error)
  }
}

export async function removeInterviewFromGoogle(interviewId: string) {
  if (!googleConfigured()) return
  try {
    const userIds = await listConnectedUserIds()
    await Promise.all(userIds.map(async (userId) => {
      const account = await readAccount(userId)
      if (!account) return
      try {
        await deleteForUser(userId, account, interviewId)
      } catch (error) {
        console.error(error)
        await rememberFailure(userId, account, error)
      }
    }))
  } catch (error) {
    console.error(error)
  }
}

async function calendarEmail(userId: string, account: Account) {
  const response = await calendarFetch(userId, account, '/calendars/primary')
  const data = (await response.json().catch(() => ({}))) as { id?: string; summary?: string }
  if (!response.ok) return 'Google Calendar'
  return data.id || data.summary || 'Google Calendar'
}

export async function connectGoogle(user: UserRecord, code: string, redirectUri: string) {
  const refreshToken = await exchangeCode(code, redirectUri)
  const account: Account = { email: 'Google Calendar', refreshToken: encrypt(refreshToken), error: null }
  await writeAccount(user.id, account)
  try {
    account.email = await calendarEmail(user.id, account)
    await writeAccount(user.id, account)
  } catch (error) {
    console.error(error)
  }
  await syncUserCalendar(user)
}

export async function syncUserCalendar(user: UserRecord) {
  if (!googleConfigured()) return null
  const account = await readAccount(user.id)
  if (!account) return null
  const interviews = await listInterviews(user)
  let failure: string | null = null
  for (const interview of interviews) {
    try {
      await upsertForUser(user.id, account, interview)
    } catch (error) {
      console.error(error)
      failure = error instanceof Error ? error.message : 'Google Calendar could not be updated.'
    }
  }
  if (failure) await rememberFailure(user.id, account, new Error(failure))
  else if (account.error) {
    account.error = null
    await writeAccount(user.id, account)
  }
  return readAccount(user.id)
}

export async function disconnectGoogle(userId: string) {
  const account = await readAccount(userId)
  if (account) {
    const listed = await (await bucket()).list(`events/${userId}`, { limit: 1000 })
    const names = listed.data?.map((file) => file.name) ?? []
    for (const name of names) {
      const interviewId = name.replace(/\.json$/, '')
      try {
        await deleteForUser(userId, account, interviewId)
      } catch (error) {
        console.error(error)
      }
    }
  }
  tokenCache.delete(userId)
  await (await bucket()).remove([accountPath(userId)])
}
