'use client'

import { useRouter } from 'next/navigation'
import { PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api-client'
import { CET_ZONE, EST_ZONE, STATUSES, stepLabel } from '@/lib/constants'
import { hexToRgba } from '@/lib/format'
import { placeEvents } from '@/lib/layout-events'
import { canManageInterview } from '@/lib/policy'
import {
  addDays,
  addMonths,
  cetToday,
  formatClock,
  formatMonthTitle,
  formatWeekday,
  formatWeekRange,
  hourLabels,
  interviewInstants,
  mondayOnOrBefore,
  monthDates,
  monthStart,
  nowMinutesInZone,
  weekDates,
  zonedLocalToUtc,
} from '@/lib/time'
import type { AvailabilitySlot } from '@/lib/availability'
import type { InterviewView } from '@/lib/types'
import { useCurrentUser, useToast } from './AppShell'
import { useDeskData } from './DeskData'
import { IconChevron } from './icons'
import { createDraft, Draft, editDraft, InterviewSheet } from './InterviewSheet'

const HOUR = 48

function MonthGrid({
  days,
  month,
  today,
  interviews,
  availability,
  canCreate,
  onOpenDay,
  onOpenInterview,
  onOpenSlot,
  onRemoveSlot,
}: {
  days: string[]
  month: string
  today: string
  interviews: InterviewView[]
  availability: AvailabilitySlot[]
  canCreate: boolean
  onOpenDay: (date: string) => void
  onOpenInterview: (interview: InterviewView) => void
  onOpenSlot: (slot: AvailabilitySlot) => void
  onRemoveSlot: (id: string) => void
}) {
  const weekdays = days.slice(0, 7)
  return (
    <div className="month-board">
      <div className="month-grid month-head">
        {weekdays.map((day) => (
          <div className="month-dow" key={day}>{formatWeekday(day)}</div>
        ))}
      </div>
      <div className="month-grid">
        {days.map((day) => {
          const events = interviews
            .filter((interview) => interview.date === day)
            .sort((a, b) => a.startMinutes - b.startMinutes)
          const outside = day.slice(0, 7) !== month.slice(0, 7)
          return (
            <div
              key={day}
              className={`month-day${outside ? ' is-outside' : ''}${day === today ? ' is-today' : ''}${canCreate ? ' can-create' : ''}`}
              onClick={() => onOpenDay(day)}
            >
              <span className={day === today ? 'month-dom is-today' : 'month-dom'}>{Number(day.slice(8, 10))}</span>
              {events.map((interview) => {
                const range = interviewInstants(interview.date, interview.startMinutes, interview.durationMinutes)
                const cet = `${formatClock(range.start, CET_ZONE)} CET`
                const est = `${formatClock(range.start, EST_ZONE)} EST`
                const result = interview.status === 'scheduled' ? '' : STATUSES.find((item) => item.value === interview.status)?.label ?? ''
                return (
                  <button
                    key={interview.id}
                    className={`month-chip${interview.status === 'failed' ? ' is-failed' : ''}`}
                    type="button"
                    style={{
                      background: hexToRgba(interview.color, 0.24),
                      ['--event-color' as string]: interview.color,
                    }}
                    title={`${interview.candidateName.trim() || interview.title}${interview.candidateName.trim() && interview.candidateName.trim() !== interview.title ? `\n${interview.title}` : ''}\n${cet}\n${est}\n${interview.interviewerName}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenInterview(interview)
                    }}
                  >
                    <span className="month-chip-time">{formatClock(range.start, CET_ZONE)}</span>
                    <span className="month-chip-title">{interview.step ? `${stepLabel(interview.step)} · ` : ''}{interview.candidateName.trim() || interview.title}</span>
                    {result ? <span className={`result-mark result-${interview.status}`}>{result}</span> : null}
                  </button>
                )
              })}
              {availability.filter((slot) => slot.date === day).map((slot) => (
                <button
                  key={slot.id}
                  className="month-free"
                  type="button"
                  title={canCreate ? `Schedule with ${slot.userName}` : 'Remove this free time'}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (!canCreate) onRemoveSlot(slot.id)
                    else onOpenSlot(slot)
                  }}
                >
                  <span>{slot.userName}</span>
                  <span>{formatClock(zonedLocalToUtc(day, slot.startMinutes, CET_ZONE), CET_ZONE)}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function CalendarScreen() {
  return <CalendarBoard />
}

function GoogleConnect() {
  const [connected, setConnected] = useState(false)
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)

  function loadStatus() {
    return api<{ connected: boolean; error: string | null }>('/api/calendar/google')
      .then((data) => {
        setConnected(data.connected)
        setProblem(data.error ?? '')
      })
      .catch((caught) => {
        if (caught instanceof Error && caught.message === 'Sign in required.') return
        setProblem(caught instanceof Error ? caught.message : 'Could not reach Google Calendar.')
      })
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('google')) {
      params.delete('google')
      const next = params.toString()
      window.history.replaceState(null, '', next ? `/?${next}` : '/')
    }
    void loadStatus()
  }, [])

  async function disconnect() {
    setBusy(true)
    try {
      await api('/api/calendar/google', { method: 'DELETE' })
      setConnected(false)
    } finally {
      setBusy(false)
    }
  }

  if (connected) {
    return (
      <div className="google-connect">
        <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void disconnect()}>
          {busy ? 'Disconnecting…' : 'Disconnect Google Calendar'}
        </button>
        {problem ? <p suppressHydrationWarning className="form-error">{problem}</p> : null}
      </div>
    )
  }

  return (
    <div className="google-connect">
      <a className="btn btn-primary" href="/api/calendar/google/start">Connect Google Calendar</a>
    </div>
  )
}

function CalendarBoard() {
  const user = useCurrentUser()
  const toast = useToast()
  const router = useRouter()
  const canCreate = canManageInterview(user.role)
  const canMark = user.role === 'proxy'
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ date: string; anchor: number; current: number } | null>(null)
  const [cursor, setCursor] = useState(() => cetToday())
  const [view, setView] = useState<'week' | 'month'>('week')
  const { interviews, people, availability, error, reload } = useDeskData()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [selection, setSelection] = useState<{ date: string; start: number; end: number } | null>(null)
  const [optimistic, setOptimistic] = useState<AvailabilitySlot[]>([])
  const hideLiveOn = useRef<string | null>(null)
  const [nowMinutes, setNowMinutes] = useState(() => nowMinutesInZone(CET_ZONE))

  const monday = mondayOnOrBefore(cursor)
  const days = useMemo(() => weekDates(monday), [monday])
  const monthDays = useMemo(() => monthDates(cursor), [cursor])
  const today = cetToday()
  const reference = addDays(monday, 2)
  const periodDays = view === 'week' ? days : monthDays

  useEffect(() => {
    const stored = window.localStorage.getItem('Vertrix-calendar-view')
    if (stored === 'week' || stored === 'month') setView(stored)
  }, [])

  function chooseView(next: 'week' | 'month') {
    setView(next)
    window.localStorage.setItem('Vertrix-calendar-view', next)
  }

  function shift(direction: -1 | 1) {
    if (view === 'week') setCursor(addDays(monday, direction * 7))
    else setCursor(addMonths(monthStart(cursor), direction))
  }

  function proxiesFree(date: string, start: number, end: number) {
    const ids = new Set<string>()
    for (const slot of availability) {
      if (slot.date === date && slot.startMinutes <= start && slot.endMinutes >= end) ids.add(slot.userId)
    }
    return [...ids]
  }

  function draftFor(date: string, start: number, duration: number, interviewerId = '') {
    const end = start + duration
    const free = proxiesFree(date, start, end)
    const chosen = interviewerId || (free.length === 1 ? free[0] : people.length === 1 ? people[0].id : '')
    return { ...createDraft({ date, startMinutes: start, durationMinutes: duration, interviewerId: chosen }), freeProxyIds: free }
  }

  function openDay(date: string) {
    if (!canCreate) return
    setDraft(draftFor(date, 9 * 60, 60))
  }

  const freeTime = useMemo(() => {
    const extra = optimistic.filter((slot) => !availability.some((saved) =>
      saved.userId === slot.userId && saved.date === slot.date && saved.startMinutes <= slot.startMinutes && saved.endMinutes >= slot.endMinutes,
    ))
    return extra.length ? [...availability, ...extra] : availability
  }, [availability, optimistic])

  function liveBand(date: string) {
    return scrollRef.current?.querySelector<HTMLElement>(`[data-live="${date}"]`) ?? null
  }

  function paintLive(date: string, start: number, end: number) {
    const node = liveBand(date)
    if (!node) return
    const shownEnd = Math.max(end, Math.min(1440, start + 15))
    node.style.display = 'block'
    node.style.top = `${(start / 60) * HOUR}px`
    node.style.height = `${Math.max(((shownEnd - start) / 60) * HOUR, 16)}px`
    const label = node.querySelector('span')
    if (label) {
      const from = formatClock(zonedLocalToUtc(date, start, CET_ZONE), CET_ZONE)
      const to = formatClock(zonedLocalToUtc(date, shownEnd, CET_ZONE), CET_ZONE)
      label.textContent = `${from} – ${to}`
    }
  }

  async function markFree(date: string, start: number, end: number, localId: string) {
    try {
      await api('/api/availability', {
        method: 'POST',
        body: JSON.stringify({ date, startMinutes: start, endMinutes: end }),
      })
      await reload()
    } catch (caught) {
      setOptimistic((current) => current.filter((slot) => slot.id !== localId))
      toast(caught instanceof Error ? caught.message : 'Could not save free time.')
    }
  }

  async function removeFree(id: string) {
    try {
      await api(`/api/availability/${id}`, { method: 'DELETE' })
      toast('Free time removed')
      await reload()
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not remove free time.')
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNowMinutes(nowMinutesInZone(CET_ZONE)), 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const date = hideLiveOn.current
    if (!date) return
    hideLiveOn.current = null
    const node = liveBand(date)
    if (node) node.style.display = 'none'
  }, [optimistic])

  useEffect(() => {
    const drag = dragRef.current
    if (!canMark || !drag) return
    paintLive(drag.date, Math.min(drag.anchor, drag.current), Math.max(drag.anchor, drag.current))
  })

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller || view !== 'week') return
    const minutes = days.includes(today) ? Math.max(0, nowMinutesInZone(CET_ZONE) - 90) : 8 * 60
    scroller.scrollTop = (minutes / 60) * HOUR
  }, [monday, days, today, view])

  const visible = (interviews ?? []).filter((interview) => periodDays.includes(interview.date))
  const clockShifts = useMemo(() => {
    const mondayClock = formatClock(zonedLocalToUtc(monday, 12 * 60, CET_ZONE), EST_ZONE)
    const sundayClock = formatClock(zonedLocalToUtc(addDays(monday, 6), 12 * 60, CET_ZONE), EST_ZONE)
    return mondayClock !== sundayClock
  }, [monday])

  function minutesFromPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const y = Math.min(Math.max(0, event.clientY - rect.top), rect.height)
    const raw = (y / Math.max(rect.height, 1)) * 1440
    return Math.max(0, Math.min(1440, Math.round(raw / 15) * 15))
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>, date: string) {
    if (!(canCreate || canMark) || event.button !== 0 || event.pointerType === 'touch') return
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* The pointer can already be gone. The drag still tracks move and up. */
    }
    const minutes = minutesFromPointer(event)
    dragRef.current = { date, anchor: minutes, current: minutes }
    if (canMark) paintLive(date, minutes, minutes)
    else setSelection({ date, start: minutes, end: minutes })
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    const minutes = minutesFromPointer(event)
    drag.current = minutes
    const start = Math.min(drag.anchor, minutes)
    const end = Math.max(drag.anchor, minutes)
    if (canMark) paintLive(drag.date, start, end)
    else setSelection({ date: drag.date, start, end })
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    setSelection(null)
    let start = Math.min(drag.anchor, drag.current)
    let end = Math.max(drag.anchor, drag.current)
    if (end - start < 15) {
      if (start >= 1440) start = 1380
      end = Math.min(1440, start + 60)
      if (end - start < 15) {
        end = 1440
        start = 1425
      }
    }
    if (canMark) {
      const localId = `local-${Date.now()}`
      hideLiveOn.current = drag.date
      setOptimistic((current) => [
        ...current,
        { id: localId, userId: user.id, userName: user.name, date: drag.date, startMinutes: start, endMinutes: end },
      ])
      void markFree(drag.date, start, end, localId)
    } else {
      setDraft(draftFor(drag.date, start, end - start))
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const subtitle = canMark
    ? view === 'month'
      ? 'Gray time is when you are free. Use Week and drag a day to change it.'
      : 'Drag across a day to mark when you are free. Click a gray block to remove it. Times are CET, with EST shown beside them.'
    : view === 'month'
      ? 'Select a day to assign an interview. Gray time is when a proxy interviewer is free.'
      : 'Drag across a day to assign an interview. Gray time is when a proxy interviewer is free.'
  const rangeLabel = view === 'week' ? 'week' : 'month'

  return (
    <section className="calendar-page">
      <header className="page-head">
        <div>
          <h1>Calendar</h1>
          <p suppressHydrationWarning>{subtitle}</p>
        </div>
      </header>
      {error ? <div className="form-error" style={{ marginBottom: 12 }}>{error}</div> : null}
      <GoogleConnect />
      <div className="calendar">
        <div className="cal-toolbar">
          <div className="week-nav">
            <button className="icon-btn" type="button" aria-label={`Previous ${rangeLabel}`} onClick={() => shift(-1)}>
              <IconChevron direction="left" />
            </button>
            <button className="icon-btn" type="button" aria-label={`Next ${rangeLabel}`} onClick={() => shift(1)}>
              <IconChevron direction="right" />
            </button>
            <div className="week-label">{view === 'week' ? formatWeekRange(monday) : formatMonthTitle(cursor)}</div>
            <button className="btn btn-ghost" type="button" onClick={() => setCursor(today)}>Today</button>
          </div>
          <div className="cal-tools">
            <div className="view-switch" role="group" aria-label="Calendar range">
              <button className={view === 'week' ? 'active' : ''} type="button" onClick={() => chooseView('week')}>Week</button>
              <button className={view === 'month' ? 'active' : ''} type="button" onClick={() => chooseView('month')}>Month</button>
            </div>
            <div className="week-count">
              {interviews === null ? 'Loading…' : visible.length === 1 ? '1 interview' : `${visible.length} interviews`}
            </div>
          </div>
        </div>
        {view === 'week' && clockShifts ? (
          <div className="cal-note">Clocks change this week, so the EST labels follow Wednesday.</div>
        ) : null}
        {view === 'month' ? (
          <MonthGrid
            days={monthDays}
            month={monthStart(cursor)}
            today={today}
            interviews={visible}
            availability={freeTime.filter((slot) => monthDays.includes(slot.date))}
            canCreate={canCreate}
            onOpenDay={openDay}
            onOpenInterview={(interview) => setDraft(editDraft(interview))}
            onOpenSlot={(slot) => setDraft(draftFor(slot.date, slot.startMinutes, slot.endMinutes - slot.startMinutes, slot.userId))}
            onRemoveSlot={(id) => void removeFree(id)}
          />
        ) : (
        <div className="cal-scroll" ref={scrollRef}>
          <div className="cal-head">
            <div className="time-head">
              <span>CET</span>
              <span>EST</span>
            </div>
            {days.map((day) => (
              <div className={day === today ? 'day-head is-today' : 'day-head'} key={day}>
                <span className="dow">{formatWeekday(day)}</span>
                <span className="dom">{Number(day.slice(8, 10))}</span>
              </div>
            ))}
          </div>
          <div className="cal-body">
            <div className="gutter">
              {Array.from({ length: 24 }, (_, hour) => {
                const labels = hourLabels(reference, hour)
                return (
                  <div className="gutter-hour" key={hour}>
                    <span className="cet">{labels.cet.replace(':00', '')}</span>
                    <span className="est" title={labels.estWeekday ? `EST is still ${labels.estWeekday}` : undefined}>
                      {labels.est.replace(':00', '')}
                    </span>
                  </div>
                )
              })}
            </div>
            {days.includes(today) ? <div className="now-line" style={{ top: (nowMinutes / 60) * HOUR }} /> : null}
            {days.map((day) => {
              const dayEvents = visible.filter((interview) => interview.date === day)
              const dayFree = freeTime.filter((slot) => slot.date === day)
              const freePlaced = placeEvents(dayFree.map((slot) => ({ id: slot.id, start: slot.startMinutes, end: slot.endMinutes })))
              const placed = placeEvents(dayEvents.map((interview) => ({
                id: interview.id,
                start: interview.startMinutes,
                end: interview.startMinutes + interview.durationMinutes,
              })))
              return (
                <div
                  key={day}
                  className={`cal-col${day === today ? ' is-today' : ''}${canCreate || canMark ? ' can-create' : ''}`}
                  onPointerDown={(event) => onPointerDown(event, day)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={`h-${hour}`} className="hour-line" style={{ top: (hour + 1) * HOUR }} />
                  ))}
                  {canMark ? (
                    <div className="availability mine is-live" data-live={day}>
                      <strong>{user.name}</strong>
                      <span />
                    </div>
                  ) : null}
                  {dayFree.map((slot) => {
                    const spot = freePlaced.get(slot.id) ?? { col: 0, cols: 1 }
                    const startLabel = formatClock(zonedLocalToUtc(day, slot.startMinutes, CET_ZONE), CET_ZONE)
                    const endLabel = formatClock(zonedLocalToUtc(day, slot.endMinutes, CET_ZONE), CET_ZONE)
                    return (
                      <div
                        key={slot.id}
                        className={canMark ? 'availability mine' : 'availability'}
                        style={{
                          top: (slot.startMinutes / 60) * HOUR,
                          height: Math.max(((slot.endMinutes - slot.startMinutes) / 60) * HOUR, 14),
                          left: `calc(${spot.col} * (100% / ${spot.cols}))`,
                          width: `calc(100% / ${spot.cols})`,
                        }}
                        title={canMark ? 'Click to remove this free time' : `${slot.userName} is free ${startLabel} – ${endLabel} CET`}
                        onPointerDown={canMark ? (event) => event.stopPropagation() : undefined}
                        onClick={canMark ? (event) => {
                          event.stopPropagation()
                          void removeFree(slot.id)
                        } : undefined}
                      >
                        <strong>{slot.userName}</strong>
                        <span>{startLabel} – {endLabel}</span>
                      </div>
                    )
                  })}
                  {dayEvents.map((interview) => {
                    const spot = placed.get(interview.id) ?? { col: 0, cols: 1 }
                    const range = interviewInstants(interview.date, interview.startMinutes, interview.durationMinutes)
                    const cet = `${formatClock(range.start, CET_ZONE)} CET`
                    const est = `${formatClock(range.start, EST_ZONE)} EST`
                    const showRoom = interview.durationMinutes >= 40 && spot.cols < 3
                    const result = interview.status === 'scheduled' ? '' : STATUSES.find((item) => item.value === interview.status)?.label ?? ''
                    return (
                      <div
                        key={interview.id}
                        className={`cal-event${interview.status === 'failed' ? ' is-failed' : ''}${showRoom ? ' has-room' : ''}`}
                        role="button"
                        tabIndex={0}
                        style={{
                          top: (interview.startMinutes / 60) * HOUR + 1,
                          height: Math.max((interview.durationMinutes / 60) * HOUR - 3, 18),
                          left: `calc(${spot.col} * (100% / ${spot.cols}) + 3px)`,
                          width: `calc(100% / ${spot.cols} - 6px)`,
                          background: hexToRgba(interview.color, 0.24),
                          ['--event-color' as string]: interview.color,
                        }}
                        title={`${interview.candidateName.trim() || interview.title}${interview.candidateName.trim() && interview.candidateName.trim() !== interview.title ? `\n${interview.title}` : ''}\n${cet}\n${est}\n${interview.interviewerName}`}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => setDraft(editDraft(interview))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') setDraft(editDraft(interview))
                        }}
                      >
                        <div className="event-time">{cet}{result ? <span className={`result-mark result-${interview.status}`}> · {result}</span> : null}</div>
                        <div className="event-title">{interview.step ? `${stepLabel(interview.step)} · ` : ''}{interview.candidateName.trim() || interview.title}</div>
                        {interview.durationMinutes >= 45 ? <div className="event-meta">{interview.interviewerName}</div> : null}
                        {showRoom ? (
                          <button
                            className="event-room"
                            type="button"
                            aria-label={`Join room for ${interview.title}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              router.push(`/interviews/${interview.id}/room`)
                            }}
                          >
                            Join
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                  {selection?.date === day ? (
                    <div
                      className="cal-selection"
                      style={{
                        top: (selection.start / 60) * HOUR,
                        height: Math.max(((Math.max(selection.end, selection.start + 15) - selection.start) / 60) * HOUR, 16),
                      }}
                    >
                      <span>
                        {formatClock(zonedLocalToUtc(day, selection.start, CET_ZONE), CET_ZONE)}
                        {' – '}
                        {formatClock(zonedLocalToUtc(day, Math.max(selection.end, selection.start + 15), CET_ZONE), CET_ZONE)} CET
                      </span>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
        )}
      </div>
      {draft ? (
        <InterviewSheet
          key={draft.id ?? `${draft.date}-${draft.startMinutes}-${draft.durationMinutes}`}
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
