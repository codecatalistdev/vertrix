'use client'

import { useMemo, useState } from 'react'
import { STATUSES, STEPS } from '@/lib/constants'
import { canManageInterview } from '@/lib/policy'
import { cetToday, formatMonthDay, formatWeekday } from '@/lib/time'
import type { InterviewView, Person, Status, StepId } from '@/lib/types'
import { useCurrentUser } from './AppShell'
import { useDeskData } from './DeskData'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const SERIES = [
  { key: 'total', label: 'Interviews', color: '#0f9d8a' },
  { key: 'passed', label: 'Passed', color: '#16a34a' },
  { key: 'failed', label: 'Failed', color: '#e11d48' },
] as const

const STATUS_COLOR: Record<Status, string> = {
  scheduled: '#2563eb',
  waiting: '#7c3aed',
  passed: '#16a34a',
  hold: '#d97706',
  failed: '#e11d48',
  offer: '#0f766e',
}

const RESULT_ORDER = ['scheduled', 'waiting', 'passed', 'hold', 'failed', 'offer'] as const

type MonthStat = {
  key: string
  label: string
  total: number
  passed: number
  failed: number
  hold: number
  waiting: number
  offer: number
  scheduled: number
}

type InterviewerStat = {
  id: string
  name: string
  total: number
  passed: number
  failed: number
  hold: number
  waiting: number
  offer: number
  scheduled: number
}

export function DashboardScreen() {
  return <DashboardBoard />
}

function DashboardBoard() {
  const user = useCurrentUser()
  const canManage = canManageInterview(user.role)
  const { interviews, people, error } = useDeskData()
  const currentYear = cetToday().slice(0, 4)
  const [year, setYear] = useState(currentYear)

  const years = useMemo(() => {
    const found = new Set<string>([currentYear])
    for (const interview of interviews ?? []) found.add(interview.date.slice(0, 4))
    return [...found].sort((a, b) => b.localeCompare(a))
  }, [interviews, currentYear])

  const yearly = useMemo(
    () => (interviews ?? []).filter((interview) => interview.date.startsWith(year)),
    [interviews, year],
  )
  const months = useMemo(() => monthStats(year, yearly), [year, yearly])
  const interviewers = useMemo(() => interviewerStats(yearly, canManage ? people : []), [yearly, people, canManage])
  const counts = useMemo(() => countStatuses(yearly), [yearly])
  const steps = useMemo(() => stepStats(yearly), [yearly])
  const activeMonths = months.filter((month) => month.total > 0)
  const listed = useMemo(
    () => [...yearly].sort((a, b) => b.date.localeCompare(a.date) || b.startMinutes - a.startMinutes),
    [yearly],
  )

  const subtitle = canManage
    ? 'Every interview, with the result of each step, each month, and each proxy interviewer.'
    : 'Interviews assigned to you, with the result of each step.'

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p suppressHydrationWarning>{subtitle}</p>
        </div>
        <label className="year-field">
          <span>Year</span>
          <select className="select year-select" value={year} onChange={(event) => setYear(event.target.value)}>
            {years.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
      </header>
      {error ? <div className="form-error" style={{ marginBottom: 12 }}>{error}</div> : null}
      <div className="dash-grid">
        <Stat label="Interviews" value={interviews === null ? '…' : String(counts.total)} />
        <Stat label="Passed" value={interviews === null ? '…' : String(counts.passed)} tone="passed" />
        <Stat label="Failed" value={interviews === null ? '…' : String(counts.failed)} tone="failed" />
        <Stat label="Hold" value={interviews === null ? '…' : String(counts.hold)} tone="hold" />
        <Stat label="Waiting" value={interviews === null ? '…' : String(counts.waiting)} tone="waiting" />
        <Stat label="Offer" value={interviews === null ? '…' : String(counts.offer)} tone="offer" />
        <Stat label="Scheduled" value={interviews === null ? '…' : String(counts.scheduled)} tone="scheduled" />
      </div>
      <article className="chart-card">
        <div className="chart-head">
          <div>
            <h2>Each step</h2>
            <p suppressHydrationWarning>Intro, Tech, Final, and Offer, so the current stage is visible beside the earlier results.</p>
          </div>
          <Legend
            items={[
              { label: 'Scheduled', color: STATUS_COLOR.scheduled },
              { label: 'Waiting', color: STATUS_COLOR.waiting },
              { label: 'Passed', color: STATUS_COLOR.passed },
              { label: 'Hold', color: STATUS_COLOR.hold },
              { label: 'Failed', color: STATUS_COLOR.failed },
              { label: 'Offer', color: STATUS_COLOR.offer },
            ]}
          />
        </div>
        {interviews === null ? <p suppressHydrationWarning className="chart-empty">Loading…</p> : <StepChart rows={steps} />}
      </article>
      <article className="chart-card">
        <div className="chart-head">
          <div>
            <h2>{canManage ? 'Interview status' : 'Your interviews'}</h2>
            <p suppressHydrationWarning>{canManage ? 'The result saved for every step. The outlined result is the current stage.' : 'The result of every step on interviews assigned to you. The outlined result is the current stage.'}</p>
          </div>
        </div>
        {interviews === null ? (
          <p suppressHydrationWarning className="chart-empty">Loading…</p>
        ) : listed.length === 0 ? (
          <p suppressHydrationWarning className="chart-empty">No interviews in {year}.</p>
        ) : (
          <div className="status-scroll">
            <table className="status-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  {canManage ? <th>Interviewer</th> : null}
                  <th>Date</th>
                  {STEPS.map((step) => <th key={step.value}>{step.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {listed.map((interview) => (
                  <tr key={interview.id}>
                    <td>
                      <div className="person-name">{interview.candidateName.trim() || interview.title}</div>
                      {interview.candidateName.trim() && interview.candidateName.trim() !== interview.title ? <div className="person-meta">{interview.title}</div> : null}
                    </td>
                    {canManage ? <td>{interview.interviewerName}</td> : null}
                    <td>{formatWeekday(interview.date)} {formatMonthDay(interview.date)}</td>
                    {STEPS.map((step) => (
                      <td key={step.value}>
                        <StepMark
                          status={interview.stepResults[step.value]}
                          current={interview.step === step.value}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
      <article className="chart-card">
        <div className="chart-head">
          <div>
            <h2>Each month</h2>
            <p suppressHydrationWarning>How many interviews were scheduled, and how many passed or failed.</p>
          </div>
          <Legend items={SERIES.map((item) => ({ label: item.label, color: item.color }))} />
        </div>
        {interviews === null ? (
          <p suppressHydrationWarning className="chart-empty">Loading…</p>
        ) : activeMonths.length === 0 ? (
          <p suppressHydrationWarning className="chart-empty">No interviews in {year}.</p>
        ) : (
          <>
            <MonthChart months={months} />
            <table className="month-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Interviews</th>
                  <th>Passed</th>
                  <th>Failed</th>
                </tr>
              </thead>
              <tbody>
                {activeMonths.map((month) => (
                  <tr key={month.key}>
                    <td>{month.label}</td>
                    <td>{month.total}</td>
                    <td>{month.passed}</td>
                    <td>{month.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </article>
      {canManage ? (
        <article className="chart-card">
          <div className="chart-head">
            <div>
              <h2>Each proxy interviewer</h2>
              <p suppressHydrationWarning>Interviews assigned in {year}, split by the current result.</p>
            </div>
            <Legend
              items={[
                { label: 'Scheduled', color: STATUS_COLOR.scheduled },
                { label: 'Waiting', color: STATUS_COLOR.waiting },
                { label: 'Passed', color: STATUS_COLOR.passed },
                { label: 'Hold', color: STATUS_COLOR.hold },
                { label: 'Failed', color: STATUS_COLOR.failed },
              { label: 'Offer', color: STATUS_COLOR.offer },
              ]}
            />
          </div>
          {interviews === null ? (
            <p suppressHydrationWarning className="chart-empty">Loading…</p>
          ) : interviewers.length === 0 ? (
            <p suppressHydrationWarning className="chart-empty">No proxy interviewers yet.</p>
          ) : (
            <InterviewerChart rows={interviewers} />
          )}
        </article>
      ) : null}
    </section>
  )
}

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={tone ? `stat-card ${tone}` : 'stat-card'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="legend">
      {items.map((item) => (
        <span key={item.label}><i style={{ background: item.color }} />{item.label}</span>
      ))}
    </div>
  )
}

function MonthChart({ months }: { months: MonthStat[] }) {
  const width = 720
  const height = 268
  const padL = 32
  const padR = 8
  const padT = 18
  const padB = 28
  const plotW = width - padL - padR
  const plotH = height - padT - padB
  const max = Math.max(1, ...months.map((month) => month.total))
  const ticks = axisTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const groupW = plotW / months.length
  const barW = Math.min(16, (groupW - 16) / 3)

  return (
    <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Interviews, passed, and failed for each month">
      {ticks.map((tick) => {
        const y = padT + plotH - (tick / top) * plotH
        return (
          <g key={tick}>
            <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="#e3edf8" />
            <text x={padL - 8} y={y + 4} textAnchor="end" className="chart-axis">{tick}</text>
          </g>
        )
      })}
      {months.map((month, index) => {
        const center = padL + groupW * index + groupW / 2
        const bars = [
          { key: 'total', value: month.total, color: SERIES[0].color, label: 'interviews' },
          { key: 'passed', value: month.passed, color: SERIES[1].color, label: 'passed' },
          { key: 'failed', value: month.failed, color: SERIES[2].color, label: 'failed' },
        ]
        return (
          <g key={month.key}>
            {bars.map((bar, barIndex) => {
              const barHeight = (bar.value / top) * plotH
              const x = center - (barW * 1.5 + 4) + barIndex * (barW + 4)
              const y = padT + plotH - barHeight
              return (
                <g key={bar.key}>
                  <rect
                    x={x}
                    y={bar.value ? y : padT + plotH}
                    width={barW}
                    height={bar.value ? Math.max(barHeight, 3) : 0}
                    rx="3"
                    fill={bar.color}
                  >
                    <title>{`${month.label}: ${bar.value} ${bar.label}`}</title>
                  </rect>
                  {bar.value > 0 ? (
                    <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="chart-value">{bar.value}</text>
                  ) : null}
                </g>
              )
            })}
            <text x={center} y={height - 8} textAnchor="middle" className="chart-axis">{month.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function StepChart({ rows }: { rows: ReturnType<typeof stepStats> }) {
  const max = Math.max(1, ...rows.map((row) => row.total))
  return (
    <div className="proxy-list">
      {rows.map((row) => (
        <div className="proxy-row" key={row.label}>
          <div className="proxy-name">{row.label}</div>
          <div
            className="proxy-track"
            title={`${row.passed} passed · ${row.failed} failed · ${row.hold} hold · ${row.waiting} waiting · ${row.offer} offer · ${row.scheduled} scheduled`}
          >
            {RESULT_ORDER.map((status) => (
              row[status] > 0 ? (
                <span key={status} style={{ width: `${(row[status] / max) * 100}%`, background: STATUS_COLOR[status] }} />
              ) : null
            ))}
          </div>
          <div className="proxy-total">{row.total}</div>
        </div>
      ))}
    </div>
  )
}

function StepMark({ status, current }: { status?: Status; current: boolean }) {
  if (!status) return <span className="step-empty">—</span>
  const label = STATUSES.find((item) => item.value === status)?.label ?? status
  return <span className={`pill pill-${status}${current ? ' is-current' : ''}`} title={current ? 'Current stage' : undefined}>{label}</span>
}

function InterviewerChart({ rows }: { rows: InterviewerStat[] }) {
  const max = Math.max(1, ...rows.map((row) => row.total))
  return (
    <div className="proxy-list">
      {rows.map((row) => (
        <div className="proxy-row" key={row.id}>
          <div className="proxy-name" title={row.name}>{row.name}</div>
          <div
            className="proxy-track"
            title={`${row.total} interviews · ${row.passed} passed · ${row.failed} failed · ${row.hold} hold · ${row.waiting} waiting · ${row.offer} offer · ${row.scheduled} scheduled`}
          >
            {RESULT_ORDER.map((status) => (
              row[status] > 0 ? (
                <span key={status} style={{ width: `${(row[status] / max) * 100}%`, background: STATUS_COLOR[status] }} />
              ) : null
            ))}
          </div>
          <div className="proxy-total">{row.total}</div>
        </div>
      ))}
    </div>
  )
}

function monthStats(year: string, interviews: InterviewView[]): MonthStat[] {
  return MONTHS.map((label, index) => {
    const key = `${year}-${String(index + 1).padStart(2, '0')}`
    const items = interviews.filter((interview) => interview.date.startsWith(key))
    const counts = countStatuses(items)
    return { key, label, ...counts }
  })
}

function interviewerStats(interviews: InterviewView[], people: Person[]): InterviewerStat[] {
  const rows = new Map<string, InterviewerStat>()
  for (const person of people) {
    rows.set(person.id, { id: person.id, name: person.name, total: 0, passed: 0, failed: 0, hold: 0, waiting: 0, offer: 0, scheduled: 0 })
  }
  for (const interview of interviews) {
    const current = rows.get(interview.interviewerId) ?? {
      id: interview.interviewerId,
      name: interview.interviewerName || 'Unassigned',
      total: 0,
      passed: 0,
      failed: 0,
      hold: 0,
      waiting: 0,
      offer: 0,
      scheduled: 0,
    }
    current.total += 1
    current[interview.status] += 1
    rows.set(interview.interviewerId, current)
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
}

function stepStats(interviews: InterviewView[]) {
  return STEPS.map((step) => {
    const counts = { passed: 0, failed: 0, hold: 0, waiting: 0, offer: 0, scheduled: 0 }
    for (const interview of interviews) {
      const status = interview.stepResults[step.value as StepId]
      if (status) counts[status] += 1
    }
    return {
      label: step.label,
      total: counts.passed + counts.failed + counts.hold + counts.waiting + counts.offer + counts.scheduled,
      ...counts,
    }
  })
}

function countStatuses(interviews: InterviewView[]) {
  const counts = { total: interviews.length, passed: 0, failed: 0, hold: 0, waiting: 0, offer: 0, scheduled: 0 }
  for (const interview of interviews) counts[interview.status] += 1
  return counts
}

function axisTicks(max: number) {
  const step = max <= 4 ? 1 : Math.ceil(max / 4)
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let value = 0; value <= top; value += step) ticks.push(value)
  return ticks
}
