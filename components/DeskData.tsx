'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api-client'
import type { AvailabilitySlot } from '@/lib/availability'
import type { InterviewView, Person } from '@/lib/types'

type DeskData = {
  interviews: InterviewView[] | null
  people: Person[]
  availability: AvailabilitySlot[]
  error: string
  reload: () => Promise<void>
  putInterview: (interview: InterviewView) => void
  dropInterview: (id: string) => void
}

const DeskDataContext = createContext<DeskData | null>(null)

export function DeskDataProvider({ canManage, children }: { canManage: boolean; children: React.ReactNode }) {
  const [interviews, setInterviews] = useState<InterviewView[] | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [error, setError] = useState('')
  const request = useRef(0)
  const fresh = useRef(new Map<string, { interview: InterviewView; at: number }>())

  function withFresh(list: InterviewView[]) {
    const ids = new Set(list.map((item) => item.id))
    const now = Date.now()
    const extra: InterviewView[] = []
    for (const [id, entry] of fresh.current) {
      if (ids.has(id) || now - entry.at > 8000) fresh.current.delete(id)
      else extra.push(entry.interview)
    }
    if (!extra.length) return list
    return [...list, ...extra].sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes)
  }

  const putInterview = useCallback((interview: InterviewView) => {
    fresh.current.set(interview.id, { interview, at: Date.now() })
    setInterviews((current) => {
      const list = (current ?? []).filter((item) => item.id !== interview.id)
      list.push(interview)
      list.sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes)
      return list
    })
  }, [])

  const dropInterview = useCallback((id: string) => {
    fresh.current.delete(id)
    setInterviews((current) => (current ? current.filter((item) => item.id !== id) : current))
  }, [])

  const reload = useCallback(async () => {
    const id = request.current + 1
    request.current = id
    try {
      const interviewRequest = api<{ interviews: InterviewView[] }>('/api/interviews')
      const peopleRequest = canManage
        ? api<{ people: Person[] }>('/api/people')
        : Promise.resolve({ people: [] as Person[] })
      const availabilityRequest = api<{ slots: AvailabilitySlot[] }>('/api/availability')
      const [interviewData, peopleData, availabilityData] = await Promise.all([interviewRequest, peopleRequest, availabilityRequest])
      if (request.current !== id) return
      setInterviews(withFresh(interviewData.interviews))
      setPeople(peopleData.people)
      setAvailability(availabilityData.slots)
      setError('')
    } catch (caught) {
      if (request.current !== id) return
      if (caught instanceof Error && caught.message === 'Sign in required.') return
      setError(caught instanceof Error ? caught.message : 'Could not load interviews.')
    }
  }, [canManage])

  useEffect(() => {
    void reload()
    const timer = window.setInterval(() => void reload(), 20000)
    const refreshTimer = window.setInterval(() => {
      api<{ interviews: InterviewView[] }>('/api/interviews')
        .then((data) => setInterviews(withFresh(data.interviews)))
        .catch(() => undefined)
      api<{ slots: AvailabilitySlot[] }>('/api/availability')
        .then((data) => setAvailability(data.slots))
        .catch(() => undefined)
    }, 2000)
    const onFocus = () => void reload()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(timer)
      window.clearInterval(refreshTimer)
      window.removeEventListener('focus', onFocus)
    }
  }, [reload])

  const value = useMemo(
    () => ({ interviews, people, availability, error, reload, putInterview, dropInterview }),
    [interviews, people, availability, error, reload, putInterview, dropInterview],
  )
  return <DeskDataContext.Provider value={value}>{children}</DeskDataContext.Provider>
}

export function useDeskData() {
  const value = useContext(DeskDataContext)
  if (!value) throw new Error('Missing interview data')
  return value
}
