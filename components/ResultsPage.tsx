'use client'

import { useMemo, useState } from 'react'
import { STATUSES, STEPS, stepLabel } from '@/lib/constants'
import { canManageInterview } from '@/lib/policy'
import type { InterviewView, Person, Status, StepId } from '@/lib/types'
import { useCurrentUser } from './AppShell'
import { useDeskData } from './DeskData'
import { editDraft, InterviewSheet } from './InterviewSheet'

type Filter = 'all' | Status

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...STATUSES,
]

export function ResultsScreen() {
  return <ResultsBoard />
}

function groupKey(interview: InterviewView) {
  const candidate = interview.candidateName.trim().toLowerCase()
  if (candidate) return `candidate:${candidate}`
  return `title:${interview.title.trim().toLowerCase() || interview.id}`
}

function stageMap(items: InterviewView[]) {
  const cells = new Map<StepId, { status: Status; interview: InterviewView }>()
  const oldestFirst = [...items].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.date.localeCompare(b.date))
  for (const interview of oldestFirst) {
    for (const step of STEPS) {
      const status = interview.stepResults[step.value]
      if (status) cells.set(step.value, { status, interview })
    }
  }
  return cells
}

function journeyLabel(cells: Map<StepId, { status: Status }>) {
  const latest = STEPS.map((step) => {
    const cell = cells.get(step.value)
    return cell ? { step: step.value, status: cell.status } : null
  }).filter((item): item is { step: StepId; status: Status } => Boolean(item))
  const failed = [...latest].reverse().find((item) => item.status === 'failed')
  if (failed) return { text: `Failed at ${stepLabel(failed.step)}`, tone: 'failed' }
  if (cells.get('offer')?.status === 'passed' || latest.some((item) => item.status === 'offer')) return { text: 'Got the offer', tone: 'offer' }
  const hold = [...latest].reverse().find((item) => item.status === 'hold')
  if (hold) return { text: `Hold at ${stepLabel(hold.step)}`, tone: 'hold' }
  const waiting = [...latest].reverse().find((item) => item.status === 'waiting')
  if (waiting) return { text: `Waiting at ${stepLabel(waiting.step)}`, tone: 'waiting' }
  const passed = [...latest].reverse().find((item) => item.status === 'passed')
  if (passed) return { text: `Passed ${stepLabel(passed.step)}`, tone: 'passed' }
  const scheduled = latest[latest.length - 1]
  if (scheduled) return { text: `Scheduled · ${stepLabel(scheduled.step)}`, tone: '' }
  return { text: 'Not started', tone: '' }
}

function hasStatus(interview: InterviewView, status: Status) {
  if (interview.status === status) return true
  return Object.values(interview.stepResults).includes(status)
}

function ResultsBoard() {
  const user = useCurrentUser()
  const canManage = canManageInterview(user.role)
  const { interviews, people, error, reload } = useDeskData()
  const [filter, setFilter] = useState<Filter>('all')
  const [draft, setDraft] = useState<ReturnType<typeof editDraft> | null>(null)

  const groups = useMemo(() => {
    const list = interviews ?? []
    const matched = new Set(
      (filter === 'all' ? list : list.filter((interview) => hasStatus(interview, filter))).map(groupKey),
    )
    const buckets = new Map<string, InterviewView[]>()
    for (const interview of list) {
      const key = groupKey(interview)
      if (!matched.has(key)) continue
      const bucket = buckets.get(key) ?? []
      bucket.push(interview)
      buckets.set(key, bucket)
    }
    return [...buckets.values()]
      .map((items) => {
        const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date) || b.startMinutes - a.startMinutes)
        const cells = stageMap(sorted)
        const candidate = sorted.find((item) => item.candidateName.trim())?.candidateName.trim() || sorted[0]?.title || 'Untitled'
        const interviewers = [...new Set(sorted.map((item) => item.interviewerName).filter(Boolean))]
        return { title: candidate, interviewTitle: sorted[0]?.title || '', interviewers, items: sorted, cells, journey: journeyLabel(cells) }
      })
      .sort((a, b) => b.items[0].date.localeCompare(a.items[0].date) || b.items[0].startMinutes - a.items[0].startMinutes)
  }, [interviews, filter])

  const counts = useMemo(() => {
    const tally: Record<Filter, number> = { all: interviews?.length ?? 0, scheduled: 0, waiting: 0, passed: 0, hold: 0, failed: 0, offer: 0 }
    for (const interview of interviews ?? []) {
      const seen = new Set<Status>([interview.status])
      for (const status of Object.values(interview.stepResults)) {
        if (status) seen.add(status)
      }
      for (const status of seen) tally[status] += 1
    }
    return tally
  }, [interviews])

  const subtitle = canManage
    ? 'Follow each candidate from Intro through Tech and Final to Offer. Open a stage to record the result.'
    : 'The stages of the interviews you took, from Intro through Offer.'

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Results</h1>
          <p>{subtitle}</p>
        </div>
      </header>
      {error ? <div className="form-error" style={{ marginBottom: 12 }}>{error}</div> : null}
      <div className="result-filters">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`pill pill-${item.value}${filter === item.value ? ' active' : ''}`}
            onClick={() => setFilter(item.value)}
          >
            {item.label} · {counts[item.value]}
          </button>
        ))}
      </div>
      <div className="panel">
        <table className="grid-table pipeline">
          <thead>
            <tr>
              <th>Candidate</th>
              {canManage ? <th>Interviewer</th> : null}
              {STEPS.map((step, index) => (
                <th key={step.value}>{index + 1} · {step.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {interviews === null ? (
              <tr><td colSpan={STEPS.length + (canManage ? 2 : 1)} className="empty">Loading results…</td></tr>
            ) : groups.length === 0 ? (
              <tr><td colSpan={STEPS.length + (canManage ? 2 : 1)} className="empty">{interviews.length === 0 ? 'No interviews yet.' : 'Nothing matches this result.'}</td></tr>
            ) : groups.map((group) => (
              <tr key={group.items.map((item) => item.id).join('-')}>
                <td>
                  <div className="person-name">{group.title}</div>
                  {group.interviewTitle && group.interviewTitle !== group.title ? <div className="person-meta">{group.interviewTitle}</div> : null}
                  <div className={`journey ${group.journey.tone}`}>{group.journey.text}</div>
                </td>
                {canManage ? <td>{group.interviewers.join(', ') || '—'}</td> : null}
                {STEPS.map((step) => {
                  const cell = group.cells.get(step.value)
                  const label = cell ? STATUSES.find((item) => item.value === cell.status)?.label ?? cell.status : ''
                  return (
                    <td key={step.value}>
                      {cell ? (
                        <button
                          className={`pill pill-${cell.status} step-letter`}
                          type="button"
                          onClick={() => setDraft(editDraft(cell.interview))}
                        >
                          {label}
                        </button>
                      ) : (
                        <span className="step-empty">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {draft ? (
        <InterviewSheet
          initial={draft}
          people={people}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null)
            void reload()
          }}
        />
      ) : null}
    </section>
  )
}
