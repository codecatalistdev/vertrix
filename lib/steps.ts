import { STEPS } from './constants'
import type { Status, StepId, StepResults } from './types'

const STEP_IDS = new Set<string>(STEPS.map((step) => step.value))
const STATUSES = new Set<Status>(['scheduled', 'waiting', 'passed', 'hold', 'failed', 'offer'])
const KEPT_WHEN_SCHEDULED = new Set<Status>(['waiting', 'offer'])

export function isStep(value: string): value is StepId {
  return STEP_IDS.has(value)
}

function isStatus(value: string): value is Status {
  return STATUSES.has(value as Status)
}

export function decodeStep(raw: string, status: Status) {
  const [head, tail = ''] = String(raw ?? '').split('|')
  const step = head
  const results: StepResults = {}
  for (const piece of tail.split(',')) {
    if (!piece) continue
    const [key, value] = piece.split(':')
    if (isStep(key) && isStatus(value)) results[key] = value
  }
  if (isStep(step)) {
    const recorded = results[step]
    if (!(recorded && KEPT_WHEN_SCHEDULED.has(recorded) && status === 'scheduled')) results[step] = status
  }
  return { step, results: passEarlierSteps(results) }
}

export function displayedStatus(step: string, results: StepResults, stored: Status): Status {
  if (isStep(step) && results[step]) return results[step]
  return stored
}

export function encodeStep(step: string, results: StepResults) {
  const parts = STEPS.flatMap((item) => (results[item.value] ? [`${item.value}:${results[item.value]}`] : []))
  return parts.length ? `${step}|${parts.join(',')}` : step
}

export function passEarlierSteps(results: StepResults) {
  const next: StepResults = { ...results }
  const reached = STEPS.reduce((index, item, position) => (next[item.value] ? position : index), -1)
  for (const item of STEPS.slice(0, reached)) {
    const current = next[item.value]
    if (!current || current === 'scheduled') next[item.value] = 'passed'
  }
  return next
}

export function mergeStepResults(previous: StepResults | undefined, incoming: unknown, step: string, status: Status) {
  const source = incoming && typeof incoming === 'object' ? incoming : previous ?? {}
  const results: StepResults = {}
  for (const item of STEPS) {
    const raw = (source as Record<string, unknown>)[item.value]
    if (typeof raw === 'string' && isStatus(raw)) results[item.value] = raw
  }
  if (isStep(step)) results[step] = status
  return passEarlierSteps(results)
}
