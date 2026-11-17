import { randomUUID } from 'crypto'
import path from 'path'
import { HttpError } from './errors'
import { hashPassword } from './password'
import { canManageInterview, canViewInterview } from './policy'
import { decodeStep, displayedStatus, encodeStep, mergeStepResults } from './steps'
import { fromStoredStatus, toStoredStatus } from './status'
import { supabase } from './supabase'
import type {
  ChatMessage,
  Database,
  Interview,
  InterviewView,
  Person,
  PublicUser,
  ResumeRecord,
  Role,
  UserRecord,
} from './types'
import { assertEmail, assertName, assertPassword, assertRole, cleanLink, cleanNote, normalizeInterview } from './validate'

const BUCKET = 'resumes'

const RESUME_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.rtf': 'application/rtf',
}

type UserRow = {
  id: string
  name: string
  email: string
  password_hash: string
  role: Role
  created_at: string
}

type InterviewRow = {
  id: string
  title: string
  status: string
  color: string
  interviewer_id: string
  created_by_id: string
  date: string
  start_minutes: number
  duration_minutes: number
  step: string
  real_meeting_link: string
  support_meeting_link: string
  jd_link: string
  doc_link: string
  note: string
  resume_original_name: string | null
  resume_stored_name: string | null
  resume_mime: string | null
  resume_size: number | null
  created_at: string
  updated_at: string
  interviewer?: { name: string; email: string } | { name: string; email: string }[] | null
  creator?: { name: string } | { name: string }[] | null
}

type MessageRow = {
  id: string
  interview_id: string
  user_id: string
  user_name: string
  user_role: Role
  body: string
  created_at: string
}

const INTERVIEW_SELECT = `
  id, title, status, color, interviewer_id, created_by_id, date, start_minutes, duration_minutes,
  step, real_meeting_link, support_meeting_link, jd_link, doc_link, note,
  resume_original_name, resume_stored_name, resume_mime, resume_size, created_at, updated_at,
  interviewer:users!interviews_interviewer_id_fkey(name, email),
  creator:users!interviews_created_by_id_fkey(name)
`

let ready: Promise<void> | null = null

function db() {
  return supabase()
}

function throwDb(error: { message: string; code?: string }): never {
  console.error(error)
  if (error.code === '23505') throw new HttpError(409, 'A user with this email already exists.')
  if (error.code === 'PGRST205' || /schema cache/i.test(error.message)) {
    throw new HttpError(500, 'The Vertrix tables are not set up in Supabase yet.')
  }
  throw new HttpError(500, 'Something went wrong.')
}

function iso(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

function one<T>(value: T | T[] | null | undefined) {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function userFromRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: iso(row.created_at),
  }
}

function storedStep(step: string, results: Interview['stepResults'], candidateName: string) {
  const encoded = encodeStep(step, results)
  const name = candidateName.trim()
  if (!name) return encoded
  const withResults = encoded.includes('|') ? encoded : `${encoded}|`
  return `${withResults}|${encodeURIComponent(name)}`
}

function candidateFromStep(raw: string) {
  const pieces = String(raw ?? '').split('|')
  if (pieces.length < 3) return ''
  try {
    return decodeURIComponent(pieces.slice(2).join('|'))
  } catch {
    return ''
  }
}

function interviewFromRow(row: InterviewRow): Interview {
  const resume =
    row.resume_stored_name && row.resume_original_name && row.resume_mime && row.resume_size != null
      ? {
          originalName: row.resume_original_name,
          storedName: row.resume_stored_name,
          mime: row.resume_mime,
          size: row.resume_size,
        }
      : null
  const stage = decodeStep(row.step, fromStoredStatus(row.status))
  return {
    id: row.id,
    title: row.title,
    candidateName: candidateFromStep(row.step),
    status: displayedStatus(stage.step, stage.results, fromStoredStatus(row.status)),
    color: row.color,
    interviewerId: row.interviewer_id,
    createdById: row.created_by_id,
    date: String(row.date).slice(0, 10),
    startMinutes: row.start_minutes,
    durationMinutes: row.duration_minutes,
    step: stage.step,
    stepResults: stage.results,
    realMeetingLink: row.real_meeting_link,
    supportMeetingLink: row.support_meeting_link,
    jdLink: row.jd_link,
    docLink: row.doc_link,
    note: row.note,
    resume,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function toView(row: InterviewRow, viewer: UserRecord): InterviewView {
  const interview = interviewFromRow(row)
  const interviewer = one(row.interviewer)
  const creator = one(row.creator)
  const manager = canManageInterview(viewer.role)
  const { resume, ...rest } = interview
  return {
    ...rest,
    resume: resume ? { originalName: resume.originalName, size: resume.size } : null,
    interviewerName: interviewer?.name ?? 'Unassigned',
    interviewerEmail: manager ? interviewer?.email ?? null : null,
    createdByName: creator?.name ?? 'Former teammate',
  }
}

async function ensureAdmin() {
  const { count, error } = await db().from('users').select('id', { count: 'exact', head: true })
  if (error) throwDb(error)
  if ((count ?? 0) > 0) return
  const passwordHash = await hashPassword('123123')
  const { error: insertError } = await db().from('users').insert({
    name: 'Admin',
    email: 'admin@Vertrix.com',
    password_hash: passwordHash,
    role: 'admin',
  })
  if (insertError && insertError.code !== '23505') throwDb(insertError)
}

async function ensureBucket() {
  const existing = await db().storage.getBucket(BUCKET)
  if (existing.data) return
  const created = await db().storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 8 * 1024 * 1024,
  })
  if (created.error && !/already exists/i.test(created.error.message)) {
    console.error(created.error)
  }
}

async function ensureReady() {
  const { error } = await db().from('users').select('id').limit(1)
  if (error) throwDb(error)
  await ensureAdmin()
  await ensureBucket()
}

function whenReady() {
  if (!ready) {
    ready = ensureReady().catch((error) => {
      ready = null
      throw error
    })
  }
  return ready
}

async function directory(): Promise<Database> {
  const { data, error } = await db().from('users').select('id, role')
  if (error) throwDb(error)
  return {
    users: (data ?? []).map((row) => ({
      id: row.id as string,
      name: '',
      email: '',
      passwordHash: '',
      role: row.role as Role,
      createdAt: '',
    })),
    interviews: [],
    messages: [],
  }
}

async function loadInterview(id: string) {
  const { data, error } = await db().from('interviews').select(INTERVIEW_SELECT).eq('id', id).maybeSingle()
  if (error) throwDb(error)
  return (data as InterviewRow | null) ?? null
}

export function toPublic(user: UserRecord): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  }
}

export async function storageMode() {
  await whenReady()
  return 'supabase'
}

export async function findUserById(id: string) {
  await whenReady()
  const { data, error } = await db().from('users').select('*').eq('id', id).maybeSingle()
  if (error) throwDb(error)
  return data ? userFromRow(data as UserRow) : null
}

export async function findUserByEmail(email: string) {
  await whenReady()
  const { data, error } = await db().from('users').select('*').eq('email', email.toLowerCase()).maybeSingle()
  if (error) throwDb(error)
  return data ? userFromRow(data as UserRow) : null
}

export async function listUsers(actor: UserRecord) {
  if (actor.role !== 'admin') throw new HttpError(403, 'Only an administrator can manage the team.')
  await whenReady()
  const { data, error } = await db().from('users').select('id, name, email, role, created_at')
  if (error) throwDb(error)
  const rank = { admin: 0, supporter: 1, proxy: 2 }
  return (data ?? [])
    .map((row) =>
      toPublic({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role as Role,
        passwordHash: '',
        createdAt: iso(row.created_at),
      }),
    )
    .sort((a, b) => rank[a.role] - rank[b.role] || a.name.localeCompare(b.name))
}

export async function createUser(actor: UserRecord, input: { name: unknown; email: unknown; password: unknown; role: unknown }) {
  if (actor.role !== 'admin') throw new HttpError(403, 'Only an administrator can manage the team.')
  const name = assertName(input.name)
  const email = assertEmail(input.email)
  const password = assertPassword(input.password)
  const role = assertRole(input.role)
  const passwordHash = await hashPassword(password)
  await whenReady()
  const { data, error } = await db()
    .from('users')
    .insert({ id: randomUUID(), name, email, password_hash: passwordHash, role })
    .select('id, name, email, role, created_at')
    .single()
  if (error) throwDb(error)
  return toPublic({
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role as Role,
    passwordHash: '',
    createdAt: iso(data.created_at),
  })
}

export async function updateUser(
  actor: UserRecord,
  id: string,
  input: { name?: unknown; role?: unknown; password?: unknown },
) {
  if (actor.role !== 'admin') throw new HttpError(403, 'Only an administrator can manage the team.')
  const name = input.name === undefined ? undefined : assertName(input.name)
  const role = input.role === undefined ? undefined : assertRole(input.role)
  const password = input.password ? assertPassword(input.password) : undefined
  const passwordHash = password ? await hashPassword(password) : undefined
  await whenReady()
  const { data: existing, error } = await db().from('users').select('id, role').eq('id', id).maybeSingle()
  if (error) throwDb(error)
  if (!existing) throw new HttpError(404, 'That person was not found.')
  if (role && role !== 'admin' && existing.role === 'admin') {
    const { count, error: countError } = await db().from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin')
    if (countError) throwDb(countError)
    if ((count ?? 0) <= 1) throw new HttpError(400, 'Keep at least one administrator.')
  }
  const patch: { name?: string; role?: Role; password_hash?: string } = {}
  if (name) patch.name = name
  if (role) patch.role = role
  if (passwordHash) patch.password_hash = passwordHash
  const { data, error: updateError } = await db()
    .from('users')
    .update(patch)
    .eq('id', id)
    .select('id, name, email, role, created_at')
    .single()
  if (updateError) throwDb(updateError)
  return toPublic({
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role as Role,
    passwordHash: '',
    createdAt: iso(data.created_at),
  })
}

export async function deleteUser(actor: UserRecord, id: string) {
  if (actor.role !== 'admin') throw new HttpError(403, 'Only an administrator can manage the team.')
  await whenReady()
  const { data: user, error } = await db().from('users').select('id, role').eq('id', id).maybeSingle()
  if (error) throwDb(error)
  if (!user) throw new HttpError(404, 'That person was not found.')
  if (user.id === actor.id) throw new HttpError(400, 'You cannot remove your own account.')
  if (user.role === 'admin') {
    const { count, error: countError } = await db().from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin')
    if (countError) throwDb(countError)
    if ((count ?? 0) <= 1) throw new HttpError(400, 'Keep at least one administrator.')
  }
  const { count, error: assignedError } = await db()
    .from('interviews')
    .select('id', { count: 'exact', head: true })
    .eq('interviewer_id', user.id)
  if (assignedError) throwDb(assignedError)
  if ((count ?? 0) > 0) throw new HttpError(400, 'Reassign this person’s interviews before removing them.')
  const { error: deleteError } = await db().from('users').delete().eq('id', id)
  if (deleteError) throwDb(deleteError)
  return { ok: true }
}

export async function changePassword(userId: string, password: string) {
  const passwordHash = await hashPassword(password)
  await whenReady()
  const { data, error } = await db().from('users').update({ password_hash: passwordHash }).eq('id', userId).select('id')
  if (error) throwDb(error)
  if (!data?.length) throw new HttpError(404, 'That person was not found.')
}

export async function listProxies(actor: UserRecord): Promise<Person[]> {
  if (!canManageInterview(actor.role)) throw new HttpError(403, 'You do not have access to that.')
  await whenReady()
  const { data, error } = await db().from('users').select('id, name, email, role').eq('role', 'proxy').order('name')
  if (error) throwDb(error)
  return (data ?? []).map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
  }))
}

export async function listInterviews(actor: UserRecord) {
  await whenReady()
  let query = db().from('interviews').select(INTERVIEW_SELECT).order('date').order('start_minutes')
  if (actor.role === 'proxy') query = query.eq('interviewer_id', actor.id)
  const { data, error } = await query
  if (error) throwDb(error)
  return ((data ?? []) as InterviewRow[]).filter((row) => canViewInterview(actor, { interviewerId: row.interviewer_id })).map((row) => toView(row, actor))
}

export async function getInterview(actor: UserRecord, id: string) {
  await whenReady()
  const row = await loadInterview(id)
  if (!row || !canViewInterview(actor, { interviewerId: row.interviewer_id })) {
    throw new HttpError(404, 'That interview was not found.')
  }
  return toView(row, actor)
}

export async function createInterview(actor: UserRecord, input: Partial<Interview>) {
  if (!canManageInterview(actor.role)) throw new HttpError(403, 'You cannot assign interviews.')
  await whenReady()
  const fields = normalizeInterview(input, null, await directory())
  const now = new Date().toISOString()
  const id = randomUUID()
  const { error } = await db().from('interviews').insert({
    id,
    title: fields.title,
    status: toStoredStatus(fields.status),
    color: fields.color,
    interviewer_id: fields.interviewerId,
    created_by_id: actor.id,
    date: fields.date,
    start_minutes: fields.startMinutes,
    duration_minutes: fields.durationMinutes,
    step: storedStep(fields.step, mergeStepResults(undefined, input.stepResults, fields.step, fields.status), fields.candidateName),
    real_meeting_link: fields.realMeetingLink,
    support_meeting_link: fields.supportMeetingLink,
    jd_link: fields.jdLink,
    doc_link: fields.docLink,
    note: fields.note,
    created_at: now,
    updated_at: now,
  })
  if (error) throwDb(error)
  return getInterview(actor, id)
}

export async function updateInterview(actor: UserRecord, id: string, input: Partial<Interview>) {
  await whenReady()
  const row = await loadInterview(id)
  if (!row || !canViewInterview(actor, { interviewerId: row.interviewer_id })) {
    throw new HttpError(404, 'That interview was not found.')
  }
  const current = interviewFromRow(row)
  const manager = canManageInterview(actor.role)
  const patch: Record<string, string | number> = { updated_at: new Date().toISOString() }
  if (manager) {
    const next = normalizeInterview({ ...current, ...input }, current.interviewerId, await directory())
    Object.assign(patch, {
      title: next.title,
      status: toStoredStatus(next.status),
      color: next.color,
      interviewer_id: next.interviewerId,
      date: next.date,
      start_minutes: next.startMinutes,
      duration_minutes: next.durationMinutes,
      step: storedStep(next.step, mergeStepResults(current.stepResults, input.stepResults, next.step, next.status), next.candidateName),
      real_meeting_link: next.realMeetingLink,
      support_meeting_link: next.supportMeetingLink,
      jd_link: next.jdLink,
      doc_link: next.docLink,
      note: next.note,
    })
  } else {
    const scheduleKeys = ['title', 'candidateName', 'status', 'color', 'interviewerId', 'date', 'startMinutes', 'durationMinutes', 'step', 'jdLink', 'docLink', 'realMeetingLink'] as const
    for (const key of scheduleKeys) {
      if (key in input && String(input[key] ?? '') !== String(current[key] ?? '')) {
        throw new HttpError(403, 'You can update the support meeting link and the note.')
      }
    }
    if ('supportMeetingLink' in input) patch.support_meeting_link = cleanLink(input.supportMeetingLink, 'Support meeting link')
    if ('note' in input) patch.note = cleanNote(input.note)
  }
  const { error } = await db().from('interviews').update(patch).eq('id', id)
  if (error) throwDb(error)
  return getInterview(actor, id)
}

export async function deleteInterview(actor: UserRecord, id: string) {
  if (!canManageInterview(actor.role)) throw new HttpError(403, 'You cannot delete interviews.')
  await whenReady()
  const row = await loadInterview(id)
  if (!row) throw new HttpError(404, 'That interview was not found.')
  const storedName = row.resume_stored_name
  const { error: messagesError } = await db().from('messages').delete().eq('interview_id', id)
  if (messagesError) throwDb(messagesError)
  const { error } = await db().from('interviews').delete().eq('id', id)
  if (error) throwDb(error)
  if (storedName) await db().storage.from(BUCKET).remove([path.basename(storedName)])
  return { ok: true }
}

function resumeName(original: string, ext: string) {
  const base = path.basename(original).replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 160)
  if (!base || base === ext) return `resume${ext}`
  return base.toLowerCase().endsWith(ext) ? base : `${base}${ext}`
}

export async function saveResume(actor: UserRecord, id: string, file: { name: string; bytes: Buffer }) {
  if (!canManageInterview(actor.role)) throw new HttpError(403, 'You cannot upload a resume.')
  const ext = path.extname(file.name).toLowerCase()
  const mime = RESUME_EXT[ext]
  if (!mime) throw new HttpError(400, 'Resume must be a PDF, DOC, DOCX, RTF, or TXT file.')
  if (file.bytes.length === 0) throw new HttpError(400, 'That resume file is empty.')
  if (file.bytes.length > 8 * 1024 * 1024) throw new HttpError(400, 'Resume must be 8 MB or smaller.')
  await whenReady()
  const row = await loadInterview(id)
  if (!row || !canViewInterview(actor, { interviewerId: row.interviewer_id })) {
    throw new HttpError(404, 'That interview was not found.')
  }
  const storedName = `${randomUUID()}${ext}`
  const uploaded = await db().storage.from(BUCKET).upload(storedName, file.bytes, { contentType: mime, upsert: false })
  if (uploaded.error) throwDb(uploaded.error)
  const { error } = await db()
    .from('interviews')
    .update({
      resume_original_name: resumeName(file.name, ext),
      resume_stored_name: storedName,
      resume_mime: mime,
      resume_size: file.bytes.length,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) {
    await db().storage.from(BUCKET).remove([storedName])
    throwDb(error)
  }
  if (row.resume_stored_name && row.resume_stored_name !== storedName) {
    await db().storage.from(BUCKET).remove([path.basename(row.resume_stored_name)])
  }
  return getInterview(actor, id)
}

export async function removeResume(actor: UserRecord, id: string) {
  if (!canManageInterview(actor.role)) throw new HttpError(403, 'You cannot remove a resume.')
  await whenReady()
  const row = await loadInterview(id)
  if (!row || !canViewInterview(actor, { interviewerId: row.interviewer_id })) {
    throw new HttpError(404, 'That interview was not found.')
  }
  const { error } = await db()
    .from('interviews')
    .update({
      resume_original_name: null,
      resume_stored_name: null,
      resume_mime: null,
      resume_size: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throwDb(error)
  if (row.resume_stored_name) await db().storage.from(BUCKET).remove([path.basename(row.resume_stored_name)])
  return getInterview(actor, id)
}

export async function readResume(actor: UserRecord, id: string) {
  await whenReady()
  const row = await loadInterview(id)
  const interview = row ? interviewFromRow(row) : null
  if (!row || !interview?.resume || !canViewInterview(actor, { interviewerId: row.interviewer_id })) {
    throw new HttpError(404, 'No resume is attached to this interview.')
  }
  const downloaded = await db().storage.from(BUCKET).download(path.basename(interview.resume.storedName))
  if (downloaded.error || !downloaded.data) throw new HttpError(404, 'No resume is attached to this interview.')
  const bytes = Buffer.from(await downloaded.data.arrayBuffer())
  return { resume: interview.resume, bytes }
}

function messageFromRow(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    interviewId: row.interview_id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    body: row.body,
    createdAt: iso(row.created_at),
  }
}

export async function listMessages(actor: UserRecord, interviewId: string) {
  await whenReady()
  const row = await loadInterview(interviewId)
  if (!row || !canViewInterview(actor, { interviewerId: row.interviewer_id })) {
    throw new HttpError(404, 'That interview was not found.')
  }
  const { data, error } = await db()
    .from('messages')
    .select('id, interview_id, user_id, user_name, user_role, body, created_at')
    .eq('interview_id', interviewId)
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throwDb(error)
  return ((data ?? []) as MessageRow[]).map(messageFromRow).reverse()
}

export async function addMessage(actor: UserRecord, interviewId: string, body: string) {
  const text = String(body ?? '').replace(/\r\n/g, '\n').trim()
  if (!text) throw new HttpError(400, 'Write a message first.')
  if (text.length > 2000) throw new HttpError(400, 'Messages are limited to 2000 characters.')
  await whenReady()
  const row = await loadInterview(interviewId)
  if (!row || !canViewInterview(actor, { interviewerId: row.interviewer_id })) {
    throw new HttpError(404, 'That interview was not found.')
  }
  const message: ChatMessage = {
    id: randomUUID(),
    interviewId,
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    body: text,
    createdAt: new Date().toISOString(),
  }
  const { error } = await db().from('messages').insert({
    id: message.id,
    interview_id: message.interviewId,
    user_id: message.userId,
    user_name: message.userName,
    user_role: message.userRole,
    body: message.body,
    created_at: message.createdAt,
  })
  if (error) throwDb(error)
  const { data: room, error: roomError } = await db()
    .from('messages')
    .select('id')
    .eq('interview_id', interviewId)
    .order('created_at', { ascending: true })
  if (roomError) throwDb(roomError)
  if ((room?.length ?? 0) > 1000) {
    const extra = (room ?? []).slice(0, (room?.length ?? 0) - 1000).map((item) => item.id as string)
    if (extra.length) {
      const { error: trimError } = await db().from('messages').delete().in('id', extra)
      if (trimError) throwDb(trimError)
    }
  }
  return message
}
