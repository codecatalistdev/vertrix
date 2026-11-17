import { randomUUID } from 'crypto'
import { HttpError } from './errors'
import { supabase } from './supabase'
import type { UserRecord } from './types'

const BUCKET = 'availability'

export type AvailabilitySlot = {
  id: string
  userId: string
  userName: string
  date: string
  startMinutes: number
  endMinutes: number
}

type StoredSlot = {
  id: string
  date: string
  startMinutes: number
  endMinutes: number
}

const writes = new Map<string, Promise<void>>()

function queue<T>(userId: string, job: () => Promise<T>) {
  const previous = writes.get(userId) ?? Promise.resolve()
  const run = previous.then(job, job)
  writes.set(userId, run.then(() => undefined, () => undefined))
  return run
}

async function bucket() {
  const client = supabase()
  const found = await client.storage.getBucket(BUCKET)
  if (found.error) {
    const created = await client.storage.createBucket(BUCKET, { public: false })
    if (created.error && !/already exists|duplicate/i.test(created.error.message)) {
      throw new HttpError(500, 'Free time could not be saved.')
    }
  }
  return client.storage.from(BUCKET)
}

function isSlot(value: unknown): value is StoredSlot {
  if (!value || typeof value !== 'object') return false
  const slot = value as StoredSlot
  return typeof slot.id === 'string' && typeof slot.date === 'string' && Number.isInteger(slot.startMinutes) && Number.isInteger(slot.endMinutes)
}

async function readSlots(userId: string) {
  const file = await (await bucket()).download(`${userId}.json`)
  if (file.error || !file.data) return [] as StoredSlot[]
  try {
    const parsed = JSON.parse(await file.data.text()) as unknown
    return Array.isArray(parsed) ? parsed.filter(isSlot) : []
  } catch {
    return []
  }
}

async function writeSlots(userId: string, slots: StoredSlot[]) {
  const uploaded = await (await bucket()).upload(`${userId}.json`, Buffer.from(JSON.stringify(slots)), {
    contentType: 'application/json',
    upsert: true,
  })
  if (uploaded.error) throw new HttpError(500, 'Free time could not be saved.')
}

function mergeSlots(slots: StoredSlot[]) {
  const byDate = new Map<string, StoredSlot[]>()
  for (const slot of slots) {
    const list = byDate.get(slot.date) ?? []
    list.push(slot)
    byDate.set(slot.date, list)
  }
  const merged: StoredSlot[] = []
  for (const list of byDate.values()) {
    const sorted = [...list].sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes)
    let current = { ...sorted[0] }
    for (const next of sorted.slice(1)) {
      if (next.startMinutes <= current.endMinutes) current.endMinutes = Math.max(current.endMinutes, next.endMinutes)
      else {
        merged.push(current)
        current = { ...next }
      }
    }
    merged.push(current)
  }
  return merged.sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes)
}

function assertRange(input: { date?: unknown; startMinutes?: unknown; endMinutes?: unknown }) {
  const date = String(input.date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'Choose a date.')
  const startMinutes = Number(input.startMinutes)
  const endMinutes = Number(input.endMinutes)
  if (!Number.isInteger(startMinutes) || !Number.isInteger(endMinutes) || startMinutes < 0 || endMinutes > 1440 || endMinutes - startMinutes < 15) {
    throw new HttpError(400, 'Choose a time of at least 15 minutes.')
  }
  return { date, startMinutes, endMinutes }
}

async function namesFor(ids: string[]) {
  const names = new Map<string, string>()
  if (ids.length === 0) return names
  const { data, error } = await supabase().from('users').select('id, name').in('id', ids)
  if (error) throw new HttpError(500, 'Could not load free time.')
  for (const user of data ?? []) names.set(user.id, user.name)
  return names
}

export async function listAvailability(actor: UserRecord): Promise<AvailabilitySlot[]> {
  if (actor.role === 'proxy') {
    const slots = await readSlots(actor.id)
    return slots.map((slot) => ({ ...slot, userId: actor.id, userName: actor.name }))
  }
  if (actor.role !== 'admin' && actor.role !== 'supporter') return []
  const listed = await (await bucket()).list('', { limit: 1000 })
  if (listed.error || !listed.data) return []
  const ids = listed.data.map((file) => file.name.replace(/\.json$/, '')).filter((id) => id && !id.includes('/'))
  const names = await namesFor(ids)
  const groups = await Promise.all(ids.map(async (id) => {
    const slots = await readSlots(id)
    const userName = names.get(id)
    if (!userName) return []
    return slots.map((slot) => ({ ...slot, userId: id, userName }))
  }))
  return groups.flat().sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes || a.userName.localeCompare(b.userName))
}

export async function addAvailability(actor: UserRecord, input: { date?: unknown; startMinutes?: unknown; endMinutes?: unknown }) {
  if (actor.role !== 'proxy') throw new HttpError(403, 'Only a proxy interviewer can mark free time.')
  const range = assertRange(input)
  return queue(actor.id, async () => {
    const slots = await readSlots(actor.id)
    slots.push({ id: randomUUID(), ...range })
    const merged = mergeSlots(slots)
    await writeSlots(actor.id, merged)
    return merged.map((slot) => ({ ...slot, userId: actor.id, userName: actor.name }))
  })
}

export async function removeAvailability(actor: UserRecord, id: string) {
  if (actor.role !== 'proxy') throw new HttpError(403, 'Only a proxy interviewer can change free time.')
  if (!id) throw new HttpError(400, 'That free time was not found.')
  return queue(actor.id, async () => {
    const slots = await readSlots(actor.id)
    const next = slots.filter((slot) => slot.id !== id)
    if (next.length === slots.length) throw new HttpError(404, 'That free time was not found.')
    await writeSlots(actor.id, next)
    return { ok: true }
  })
}
