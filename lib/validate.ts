import { EVENT_COLORS, STEPS } from './constants'
import { HttpError } from './errors'
import type { Database, Interview, Role, Status } from './types'

const STATUSES = new Set<Status>(['scheduled', 'waiting', 'passed', 'hold', 'failed', 'offer'])
const STEP_VALUES = new Set<string>(STEPS.map((step) => step.value))
const ROLES = new Set<Role>(['admin', 'proxy', 'supporter'])
const HEX = /^#[0-9a-fA-F]{6}$/

export function cleanText(value: unknown, max: number) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function cleanNote(value: unknown) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, 4000)
}

export function cleanLink(value: unknown, label: string) {
  const text = String(value ?? '').trim().slice(0, 500)
  if (!text) return ''
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new HttpError(400, `${label} must be a full http or https link.`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, `${label} must be a full http or https link.`)
  }
  return url.toString()
}

export function assertEmail(value: unknown) {
  const email = String(value ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    throw new HttpError(400, 'Enter a valid email address.')
  }
  return email
}

export function assertPassword(value: unknown) {
  const password = String(value ?? '')
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.')
  if (password.length > 200) throw new HttpError(400, 'Password is too long.')
  return password
}

export function assertRole(value: unknown): Role {
  if (!ROLES.has(value as Role)) throw new HttpError(400, 'Choose a role.')
  return value as Role
}

export function assertStep(value: unknown) {
  const step = String(value ?? '').trim()
  if (!STEP_VALUES.has(step)) throw new HttpError(400, 'Choose a step.')
  return step
}

export function assertName(value: unknown) {
  const name = cleanText(value, 80)
  if (name.length < 2) throw new HttpError(400, 'Enter a name.')
  return name
}

type InterviewInput = Partial<Interview>

export function normalizeInterview(input: InterviewInput, previousId: string | null, db: Database): Omit<Interview, 'id' | 'createdById' | 'createdAt' | 'updatedAt' | 'resume' | 'stepResults'> {
  const title = cleanText(input.title, 140)
  if (!title) throw new HttpError(400, 'Enter a title.')
  const candidateName = cleanText(input.candidateName, 80)
  if (candidateName.length < 2) throw new HttpError(400, 'Enter the candidate name.')
  const status = input.status
  if (!status || !STATUSES.has(status)) throw new HttpError(400, 'Choose a status.')
  const color = String(input.color ?? '').trim()
  if (!HEX.test(color)) throw new HttpError(400, 'Choose a color.')
  if (!EVENT_COLORS.includes(color) && !HEX.test(color)) {
    throw new HttpError(400, 'Choose a color.')
  }
  const date = String(input.date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'Choose a date.')
  const startMinutes = Number(input.startMinutes)
  const durationMinutes = Number(input.durationMinutes)
  if (!Number.isInteger(startMinutes) || startMinutes < 0 || startMinutes > 1425) {
    throw new HttpError(400, 'Choose a start time.')
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 720) {
    throw new HttpError(400, 'Duration must be between 15 and 720 minutes.')
  }
  if (startMinutes + durationMinutes > 1440) {
    throw new HttpError(400, 'That interview ends after midnight CET. Shorten it or start earlier.')
  }
  const interviewerId = String(input.interviewerId ?? '')
  const interviewer = db.users.find((user) => user.id === interviewerId)
  if (!interviewer) throw new HttpError(400, 'Choose a proxy interviewer.')
  if (interviewer.role !== 'proxy' && interviewerId !== previousId) {
    throw new HttpError(400, 'Assign the interview to a proxy interviewer.')
  }
  return {
    title,
    candidateName,
    status,
    color,
    interviewerId,
    date,
    startMinutes,
    durationMinutes,
    step: assertStep(input.step),
    realMeetingLink: cleanLink(input.realMeetingLink, 'Real meeting link'),
    supportMeetingLink: cleanLink(input.supportMeetingLink, 'Support meeting link'),
    jdLink: cleanLink(input.jdLink, 'Job description link'),
    docLink: cleanLink(input.docLink, 'Doc link'),
    note: cleanNote(input.note),
  }
}
