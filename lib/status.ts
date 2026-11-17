import type { Status } from './types'

const FROM_STORED: Record<string, Status> = {
  scheduled: 'scheduled',
  passed: 'passed',
  hold: 'hold',
  failed: 'failed',
  completed: 'passed',
  no_show: 'hold',
  cancelled: 'failed',
}

const TO_STORED: Record<Status, string> = {
  scheduled: 'scheduled',
  waiting: 'scheduled',
  offer: 'scheduled',
  passed: 'completed',
  hold: 'no_show',
  failed: 'cancelled',
}

export function fromStoredStatus(value: string): Status {
  return FROM_STORED[value] ?? 'scheduled'
}

export function toStoredStatus(value: Status) {
  return TO_STORED[value]
}
