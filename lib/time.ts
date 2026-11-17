import { CET_ZONE, EST_ZONE } from './constants'

export function zonedLocalToUtc(isoDate: string, minutes: number, timeZone: string): Date {
  const [year, month, dayPart] = isoDate.split('-').map(Number)
  let day = dayPart
  let mins = minutes
  while (mins < 0) {
    mins += 1440
    day -= 1
  }
  while (mins >= 1440) {
    mins -= 1440
    day += 1
  }
  const hour = Math.floor(mins / 60)
  const minute = mins % 60
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  const offset1 = zoneOffsetMs(utcGuess, timeZone)
  let utc = new Date(utcGuess.getTime() - offset1)
  const offset2 = zoneOffsetMs(utc, timeZone)
  if (offset2 !== offset1) utc = new Date(utcGuess.getTime() - offset2)
  return utc
}

function zoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const map: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  let hour = Number(map.hour)
  if (hour === 24) hour = 0
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  )
  return asUtc - date.getTime()
}

export function cetToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CET_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function nowMinutesInZone(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now)
  const map: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  let hour = Number(map.hour)
  if (hour === 24) hour = 0
  return hour * 60 + Number(map.minute)
}

export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export function mondayOnOrBefore(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const diff = weekday === 0 ? -6 : 1 - weekday
  return addDays(iso, diff)
}

export function weekDates(monday: string) {
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

export function monthStart(iso: string) {
  return `${iso.slice(0, 7)}-01`
}

export function addMonths(iso: string, months: number) {
  const [year, month] = monthStart(iso).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + months, 1))
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${date.getUTCFullYear()}-${nextMonth}-01`
}

export function monthDates(iso: string) {
  const first = monthStart(iso)
  const start = mondayOnOrBefore(first)
  const last = addDays(addMonths(first, 1), -1)
  const end = addDays(mondayOnOrBefore(last), 6)
  const days: string[] = []
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day)
  return days
}

export function formatMonthTitle(iso: string) {
  const [year, month, day] = monthStart(iso).split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export function formatClock(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

export function formatIsoInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatWeekday(iso: string, style: 'short' | 'long' = 'short') {
  const [year, month, day] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    weekday: style,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export function formatMonthDay(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export function formatWeekRange(monday: string) {
  const sunday = addDays(monday, 6)
  const [y1, m1] = monday.split('-')
  const [y2, m2] = sunday.split('-')
  const start = formatMonthDay(monday)
  const endDay = Number(sunday.slice(8, 10))
  const end = formatMonthDay(sunday)
  if (y1 === y2 && m1 === m2) return `${start} – ${endDay}, ${y1}`
  if (y1 === y2) return `${start} – ${end}, ${y1}`
  return `${start}, ${y1} – ${end}, ${y2}`
}

export function interviewInstants(date: string, startMinutes: number, durationMinutes: number) {
  const start = zonedLocalToUtc(date, startMinutes, CET_ZONE)
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
  return { start, end }
}

export function formatZoneRange(start: Date, end: Date, timeZone: string, cetDate: string) {
  const startDay = formatIsoInZone(start, timeZone)
  const endDay = formatIsoInZone(end, timeZone)
  const startClock = formatClock(start, timeZone)
  const endClock = formatClock(end, timeZone)
  if (startDay === cetDate && endDay === cetDate) return `${startClock} – ${endClock}`
  const startLabel = startDay === cetDate ? startClock : `${startClock} ${formatWeekday(startDay)}`
  const endLabel = endDay === startDay ? endClock : `${endClock} ${formatWeekday(endDay)}`
  return `${startLabel} – ${endLabel}`
}

export function hourLabels(referenceDate: string, hour: number) {
  const utc = zonedLocalToUtc(referenceDate, hour * 60, CET_ZONE)
  const estDay = formatIsoInZone(utc, EST_ZONE)
  return {
    cet: formatClock(utc, CET_ZONE),
    est: formatClock(utc, EST_ZONE),
    estWeekday: estDay === referenceDate ? '' : formatWeekday(estDay),
  }
}

export function minutesToInput(minutes: number) {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function inputToMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0
  return hour * 60 + minute
}

export function formatWhen(iso: string) {
  return `${new Intl.DateTimeFormat('en-US', {
    timeZone: CET_ZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))} CET`
}
