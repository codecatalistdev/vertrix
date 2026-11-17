import type { Role, Status } from './types'

export const SESSION_COOKIE = 'Vertrix_session'

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  proxy: 'Proxy interviewer',
  supporter: 'Interview supporter',
}

export const STATUSES: { value: Status; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'passed', label: 'Passed' },
  { value: 'hold', label: 'Hold' },
  { value: 'failed', label: 'Failed' },
  { value: 'offer', label: 'Offer' },
]

export const STEPS = [
  { value: 'intro', label: 'Intro' },
  { value: 'tech', label: 'Tech' },
  { value: 'final', label: 'Final' },
  { value: 'offer', label: 'Offer' },
] as const

export function stepLabel(value: string) {
  return STEPS.find((step) => step.value === value)?.label ?? (value || 'Unset')
}

export const EVENT_COLORS = [
  '#0f9d8a',
  '#2563eb',
  '#7c3aed',
  '#e08a1e',
  '#e11d48',
  '#0891b2',
  '#16a34a',
  '#d97706',
]

export const DEFAULT_COLOR = EVENT_COLORS[0]

export const CET_ZONE = 'Europe/Berlin'
export const EST_ZONE = 'America/New_York'
