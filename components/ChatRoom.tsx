'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api-client'
import { CET_ZONE, EST_ZONE, ROLE_LABEL, STATUSES, stepLabel } from '@/lib/constants'
import { formatBytes, safeHref } from '@/lib/format'
import { formatClock, formatWeekday, formatWhen, interviewInstants } from '@/lib/time'
import type { ChatMessage, InterviewView } from '@/lib/types'
import { useCurrentUser, useToast } from './AppShell'

export function RoomScreen({ id }: { id: string }) {
  return <Room id={id} />
}

function Room({ id }: { id: string }) {
  const user = useCurrentUser()
  const toast = useToast()
  const listRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const [interview, setInterview] = useState<InterviewView | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [supportLink, setSupportLink] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [missing, setMissing] = useState(false)
  const [sending, setSending] = useState(false)
  const [savingLinks, setSavingLinks] = useState(false)
  const [materialsOpen, setMaterialsOpen] = useState(false)

  async function loadInterview() {
    try {
      const data = await api<{ interview: InterviewView }>(`/api/interviews/${id}`)
      setInterview(data.interview)
      setSupportLink(data.interview.supportMeetingLink)
      setMissing(false)
    } catch (caught) {
      if (caught instanceof Error && caught.message === 'Sign in required.') return
      setMissing(true)
      setError(caught instanceof Error ? caught.message : 'This room is unavailable.')
    }
  }

  async function loadMessages() {
    try {
      const data = await api<{ messages: ChatMessage[] }>(`/api/interviews/${id}/messages`)
      setMessages(data.messages)
    } catch (caught) {
      if (caught instanceof Error && caught.message === 'Sign in required.') return
      setMissing(true)
    }
  }

  useEffect(() => {
    void loadInterview()
    void loadMessages()
    const timer = window.setInterval(() => void loadMessages(), 2000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!materialsOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMaterialsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [materialsOpen])

  const lastId = messages[messages.length - 1]?.id
  useEffect(() => {
    const list = listRef.current
    if (!list || !stickRef.current) return
    list.scrollTop = list.scrollHeight
  }, [lastId])

  async function saveLinks() {
    setSavingLinks(true)
    setError('')
    try {
      const data = await api<{ interview: InterviewView }>(`/api/interviews/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ supportMeetingLink: supportLink }),
      })
      setInterview(data.interview)
      setSupportLink(data.interview.supportMeetingLink)
      toast('Support link saved')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the links.')
    } finally {
      setSavingLinks(false)
    }
  }

  async function send(event?: FormEvent) {
    event?.preventDefault()
    const text = body.trim()
    if (!text || sending) return
    setSending(true)
    setError('')
    try {
      await api(`/api/interviews/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      })
      setBody('')
      stickRef.current = true
      await loadMessages()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send that message.')
    } finally {
      setSending(false)
    }
  }

  if (missing) {
    return (
      <section className="narrow-card">
        <h1>Room unavailable</h1>
        <p>{error || 'You don’t have access to this interview.'}</p>
        <Link className="btn btn-primary" href="/">Back to calendar</Link>
      </section>
    )
  }

  if (!interview) {
    return <section className="narrow-card">Opening the room…</section>
  }

  const range = interviewInstants(interview.date, interview.startMinutes, interview.durationMinutes)
  const status = STATUSES.find((item) => item.value === interview.status)?.label ?? interview.status
  const linksDirty = supportLink !== interview.supportMeetingLink
  const realHref = safeHref(interview.realMeetingLink)
  const supportHref = safeHref(supportLink)
  const jdHref = safeHref(interview.jdLink)
  const docHref = safeHref(interview.docLink)

  return (
    <section className="room">
      <div className="room-top">
        <div className="room-heading">
          <div>
            <Link className="back-link" href="/">Back to calendar</Link>
            <h1>{interview.candidateName.trim() || interview.title}</h1>
          </div>
          <button className="btn btn-ghost" type="button" onClick={() => setMaterialsOpen(true)}>
            Materials
          </button>
        </div>
        <p className="room-meta">
          {formatWeekday(interview.date, 'long')} {interview.date.slice(8, 10)} · {formatClock(range.start, CET_ZONE)}–{formatClock(range.end, CET_ZONE)} CET
          {' · '}
          {formatClock(range.start, EST_ZONE)}–{formatClock(range.end, EST_ZONE)} EST
          {interview.step ? ` · ${stepLabel(interview.step)}` : ''} · {interview.interviewerName} · {status}
        </p>
        {error ? <div className="form-error" style={{ marginBottom: 10 }}>{error}</div> : null}
        <div className="link-grid">
          <label className="field">
            <span className="field-label">Real meeting link</span>
            <input className="input" value={interview.realMeetingLink} placeholder="https://" disabled readOnly />
            {realHref ? <a className="open-link" href={realHref} target="_blank" rel="noreferrer">Open</a> : null}
          </label>
          <label className="field">
            <span className="field-label">Support meeting link</span>
            <input className="input" value={supportLink} placeholder="https://" onChange={(event) => setSupportLink(event.target.value)} />
            {supportHref ? <a className="open-link" href={supportHref} target="_blank" rel="noreferrer">Open</a> : null}
          </label>
        </div>
        <div className="link-actions">
          <button className="btn btn-primary" type="button" disabled={!linksDirty || savingLinks} onClick={() => void saveLinks()}>
            {savingLinks ? 'Saving…' : 'Save support link'}
          </button>
        </div>
      </div>
      {materialsOpen ? (
        <div className="sheet-backdrop" onClick={() => setMaterialsOpen(false)}>
          <aside className="sheet" role="dialog" aria-label="Interview materials" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-head">
              <div>
                <h2>Materials</h2>
                <p className="room-meta">{interview.title}</p>
              </div>
              <button className="btn btn-ghost" type="button" onClick={() => setMaterialsOpen(false)}>Close</button>
            </div>
            <div className="sheet-body material-list">
              <article className="material-card">
                <h3>Job description</h3>
                {jdHref ? (
                  <div className="material-row">
                    <a className="material-url" href={jdHref} target="_blank" rel="noreferrer">{interview.jdLink}</a>
                    <a className="btn btn-primary" href={jdHref} target="_blank" rel="noreferrer">Open</a>
                  </div>
                ) : (
                  <p className="material-empty">No job description.</p>
                )}
              </article>
              <article className="material-card">
                <h3>Resume</h3>
                {interview.resume ? (
                  <div className="material-row">
                    <span>{interview.resume.originalName} · {formatBytes(interview.resume.size)}</span>
                    <a className="btn btn-primary" href={`/api/interviews/${id}/resume`}>Download</a>
                  </div>
                ) : (
                  <p className="material-empty">No resume uploaded.</p>
                )}
              </article>
              {docHref ? (
                <article className="material-card">
                  <h3>Document</h3>
                  <div className="material-row">
                    <a className="material-url" href={docHref} target="_blank" rel="noreferrer">{interview.docLink}</a>
                    <a className="btn btn-primary" href={docHref} target="_blank" rel="noreferrer">Open</a>
                  </div>
                </article>
              ) : null}
              <article className="material-card">
                <h3>Note</h3>
                {interview.note.trim() ? <p>{interview.note}</p> : <p className="material-empty">No note.</p>}
              </article>
            </div>
          </aside>
        </div>
      ) : null}
      <div
        className="thread"
        ref={listRef}
        onScroll={(event) => {
          const element = event.currentTarget
          stickRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120
        }}
      >
        {messages.length === 0 ? <div className="empty">No messages yet. Share a link or a note for the team.</div> : null}
        {messages.map((message) => {
          const mine = message.userId === user.id
          return (
            <div className={mine ? 'msg-row mine' : 'msg-row'} key={message.id}>
              <div className="bubble">
                <div className="msg-name">
                  {mine ? 'You' : message.userName}
                  <span className="msg-time">{mine ? ' · ' : ` · ${ROLE_LABEL[message.userRole]} · `}{formatWhen(message.createdAt)}</span>
                </div>
                <div className="msg-body">{message.body}</div>
              </div>
            </div>
          )
        })}
      </div>
      <form className="composer" onSubmit={(event) => void send(event)}>
        <textarea
          className="textarea"
          value={body}
          placeholder="Write to the room"
          rows={2}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send()
            }
          }}
        />
        <button className="btn btn-primary" type="submit" disabled={sending || !body.trim()}>Send</button>
      </form>
    </section>
  )
}
