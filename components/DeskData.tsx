'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api-client'
import type { InterviewView, Person } from '@/lib/types'

type DeskData = {
  interviews: InterviewView[] | null
  people: Person[]
  error: string
  reload: () => Promise<void>
}

const DeskDataContext = createContext<DeskData | null>(null)

export function DeskDataProvider({ canManage, children }: { canManage: boolean; children: React.ReactNode }) {
  const [interviews, setInterviews] = useState<InterviewView[] | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [error, setError] = useState('')
  const request = useRef(0)

  const reload = useCallback(async () => {
    const id = request.current + 1
    request.current = id
    try {
      const interviewRequest = api<{ interviews: InterviewView[] }>('/api/interviews')
      const peopleRequest = canManage
        ? api<{ people: Person[] }>('/api/people')
        : Promise.resolve({ people: [] as Person[] })
      const [interviewData, peopleData] = await Promise.all([interviewRequest, peopleRequest])
      if (request.current !== id) return
      setInterviews(interviewData.interviews)
      setPeople(peopleData.people)
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
    const onFocus = () => void reload()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [reload])

  const value = useMemo(() => ({ interviews, people, error, reload }), [interviews, people, error, reload])
  return <DeskDataContext.Provider value={value}>{children}</DeskDataContext.Provider>
}

export function useDeskData() {
  const value = useContext(DeskDataContext)
  if (!value) throw new Error('Missing interview data')
  return value
}
