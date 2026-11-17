'use client'

import { useRouter } from 'next/navigation'
import { PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
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
import type { InterviewView } from '@/lib/types'
import { useCurrentUser } from './AppShell'
import { useDeskData } from './DeskData'
import { IconChevron } from './icons'
import { createDraft, Draft, editDraft, InterviewSheet } from './InterviewSheet'

const HOUR = 64

function MonthGrid({
  days,
  month,
  today,
  interviews,
  canCreate,
  onOpenDay,
  onOpenInterview,
}: {
  days: string[]
  month: string
  today: string
  interviews: InterviewView[]
  canCreate: boolean
  onOpenDay: (date: string) => void
  onOpenInterview: (interview: InterviewView) => void
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
                    title={`${interview.title}\n${cet}\n${est}\n${interview.interviewerName}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenInterview(interview)
                    }}
                  >
                    <span className="month-chip-time">{formatClock(range.start, CET_ZONE)}</span>
                    <span className="month-chip-title">{interview.step ? `${stepLabel(interview.step)} · ` : ''}{interview.title}</span>
                    {result ? <span className={`result-mark result-${interview.status}`}>{result}</span> : null}
                  </button>
                )
              })}
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

function CalendarBoard() {
  const user = useCurrentUser()
  const router = useRouter()
  const canCreate = canManageInterview(user.role)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ date: string; anchor: number; current: number } | null>(null)
  const [cursor, setCursor] = useState(() => cetToday())
  const [view, setView] = useState<'week' | 'month'>('week')
  const { interviews, people, error, reload } = useDeskData()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [selection, setSelection] = useState<{ date: string; start: number; end: number } | null>(null)
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

  function openDay(date: string) {
    if (!canCreate) return
    const onlyProxy = people.length === 1 ? people[0].id : ''
    setDraft(createDraft({ date, startMinutes: 9 * 60, durationMinutes: 60, interviewerId: onlyProxy }))
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNowMinutes(nowMinutesInZone(CET_ZONE)), 30000)
    return () => window.clearInterval(timer)
  }, [])

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
    if (!canCreate || event.button !== 0 || event.pointerType === 'touch') return
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* The pointer can already be gone. The drag still tracks move and up. */
    }
    const minutes = minutesFromPointer(event)
    dragRef.current = { date, anchor: minutes, current: minutes }
    setSelection({ date, start: minutes, end: minutes })
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    const minutes = minutesFromPointer(event)
    drag.current = minutes
    setSelection({
      date: drag.date,
      start: Math.min(drag.anchor, minutes),
      end: Math.max(drag.anchor, minutes),
    })
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
    const onlyProxy = people.length === 1 ? people[0].id : ''
    setDraft(createDraft({ date: drag.date, startMinutes: start, durationMinutes: end - start, interviewerId: onlyProxy }))
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const subtitle = view === 'month'
    ? canCreate
      ? 'Select a day to assign an interview. Times are CET, with EST shown beside them.'
      : 'Interviews assigned to you. Times are CET, with EST shown beside them.'
    : canCreate
      ? 'Drag across a day to assign an interview. The schedule clock is CET, with EST shown beside it.'
      : 'Interviews assigned to you. Times are CET, with EST shown beside them.'
  const rangeLabel = view === 'week' ? 'week' : 'month'

  return (
    <section className="calendar-page">
      <header className="page-head">
        <div>
          <h1>Calendar</h1>
          <p>{subtitle}</p>
        </div>
      </header>
      {error ? <div className="form-error" style={{ marginBottom: 12 }}>{error}</div> : null}
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
            canCreate={canCreate}
            onOpenDay={openDay}
            onOpenInterview={(interview) => setDraft(editDraft(interview))}
          />
        ) : (
        <div className="cal-scroll" ref={scrollRef}>
          <div className="cal-head">
            <div className="cal-corner">
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
                    <span className="cet">{labels.cet}</span>
                    <span className="est">{labels.est}{labels.estWeekday ? ' · prev' : ''}</span>
                  </div>
                )
              })}
            </div>
            {days.includes(today) ? <div className="now-line" style={{ top: (nowMinutes / 60) * HOUR }} /> : null}
            {days.map((day) => {
              const dayEvents = visible.filter((interview) => interview.date === day)
              const placed = placeEvents(dayEvents.map((interview) => ({
                id: interview.id,
                start: interview.startMinutes,
                end: interview.startMinutes + interview.durationMinutes,
              })))
              return (
                <div
                  key={day}
                  className={`cal-col${day === today ? ' is-today' : ''}${canCreate ? ' can-create' : ''}`}
                  onPointerDown={(event) => onPointerDown(event, day)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={`h-${hour}`} className="hour-line" style={{ top: (hour + 1) * HOUR }} />
                  ))}
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={`m-${hour}`} className="hour-line half" style={{ top: hour * HOUR + HOUR / 2 }} />
                  ))}
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
                        title={`${interview.title}\n${cet}\n${est}\n${interview.interviewerName}`}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => setDraft(editDraft(interview))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') setDraft(editDraft(interview))
                        }}
                      >
                        <div className="event-time">{cet}{result ? <span className={`result-mark result-${interview.status}`}> · {result}</span> : null}</div>
                        <div className="event-title">{interview.step ? `${stepLabel(interview.step)} · ` : ''}{interview.title}</div>
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
