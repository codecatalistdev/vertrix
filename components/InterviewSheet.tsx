'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { api } from '@/lib/api-client'
import { DEFAULT_COLOR, EST_ZONE, EVENT_COLORS, STATUSES, STEPS } from '@/lib/constants'
import { formatBytes, safeHref } from '@/lib/format'
import { canManageInterview } from '@/lib/policy'
import { passEarlierSteps } from '@/lib/steps'
import { formatZoneRange, inputToMinutes, interviewInstants, minutesToInput } from '@/lib/time'
import type { InterviewView, Person, Status, StepId, StepResults } from '@/lib/types'
import { useCurrentUser, useToast } from './AppShell'
import { IconClose } from './icons'

export type Draft = {
  id?: string
  title: string
  candidateName: string
  status: Status
  color: string
  interviewerId: string
  interviewerName?: string
  date: string
  startMinutes: number
  durationMinutes: number
  step: string
  stepResults: StepResults
  realMeetingLink: string
  supportMeetingLink: string
  jdLink: string
  docLink: string
  note: string
  resume: { originalName: string; size: number } | null
  createdByName?: string
}

export function createDraft(input: {
  date: string
  startMinutes: number
  durationMinutes: number
  interviewerId?: string
}): Draft {
  return {
    title: '',
    candidateName: '',
    status: 'scheduled',
    color: DEFAULT_COLOR,
    interviewerId: input.interviewerId ?? '',
    date: input.date,
    startMinutes: input.startMinutes,
    durationMinutes: input.durationMinutes,
    step: 'intro',
    stepResults: { intro: 'scheduled' },
    realMeetingLink: '',
    supportMeetingLink: '',
    jdLink: '',
    docLink: '',
    note: '',
    resume: null,
  }
}

export function editDraft(interview: InterviewView): Draft {
  return {
    id: interview.id,
    title: interview.title,
    candidateName: interview.candidateName,
    status: interview.status,
    color: interview.color,
    interviewerId: interview.interviewerId,
    interviewerName: interview.interviewerName,
    date: interview.date,
    startMinutes: interview.startMinutes,
    durationMinutes: interview.durationMinutes,
    step: interview.step,
    stepResults: { ...interview.stepResults },
    realMeetingLink: interview.realMeetingLink,
    supportMeetingLink: interview.supportMeetingLink,
    jdLink: interview.jdLink,
    docLink: interview.docLink,
    note: interview.note,
    resume: interview.resume,
    createdByName: interview.createdByName,
  }
}

export function InterviewSheet({
  initial,
  people,
  onClose,
  onSaved,
}: {
  initial: Draft
  people: Person[]
  onClose: () => void
  onSaved: () => void
}) {
  const user = useCurrentUser()
  const toast = useToast()
  const router = useRouter()
  const canManage = canManageInterview(user.role)
  const [draft, setDraft] = useState(initial)
  const [file, setFile] = useState<File | null>(null)
  const [removeResume, setRemoveResume] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dirty, setDirty] = useState(false)

  const options = useMemo(() => {
    const list = [...people]
    if (draft.interviewerId && !list.some((person) => person.id === draft.interviewerId)) {
      list.unshift({
        id: draft.interviewerId,
        name: draft.interviewerName || 'Assigned interviewer',
        email: '',
        role: 'proxy',
      })
    }
    return list
  }, [people, draft.interviewerId, draft.interviewerName])

  const readout = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return null
    const { start, end } = interviewInstants(draft.date, draft.startMinutes, draft.durationMinutes || 0)
    return {
      cet: formatZoneRange(start, end, 'Europe/Berlin', draft.date),
      est: formatZoneRange(start, end, EST_ZONE, draft.date),
    }
  }, [draft.date, draft.startMinutes, draft.durationMinutes])

  function patch(partial: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...partial }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const payload = canManage
        ? {
            title: draft.title,
            candidateName: draft.candidateName,
            status: draft.status,
            color: draft.color,
            interviewerId: draft.interviewerId,
            date: draft.date,
            startMinutes: draft.startMinutes,
            durationMinutes: Number(draft.durationMinutes),
            step: draft.step,
            stepResults: draft.stepResults,
            realMeetingLink: draft.realMeetingLink,
            supportMeetingLink: draft.supportMeetingLink,
            jdLink: draft.jdLink,
            docLink: draft.docLink,
            note: draft.note,
          }
        : {
            realMeetingLink: draft.realMeetingLink,
            note: draft.note,
          }
      const saved = draft.id
        ? await api<{ interview: InterviewView }>(`/api/interviews/${draft.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          })
        : await api<{ interview: InterviewView }>('/api/interviews', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
      const id = saved.interview.id
      if (file) {
        const form = new FormData()
        form.set('file', file)
        await api(`/api/interviews/${id}/resume`, { method: 'POST', body: form })
      } else if (removeResume && draft.id) {
        await api(`/api/interviews/${id}/resume`, { method: 'DELETE' })
      }
      toast('Interview saved')
      onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the interview.')
      setSaving(false)
    }
  }

  async function remove() {
    if (!draft.id) return
    setSaving(true)
    setError('')
    try {
      await api(`/api/interviews/${draft.id}`, { method: 'DELETE' })
      toast('Interview deleted')
      onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete the interview.')
      setSaving(false)
    }
  }

  function joinRoom() {
    if (!draft.id) return
    if (dirty && !window.confirm('Leave without saving changes?')) return
    router.push(`/interviews/${draft.id}/room`)
  }

  const resumeHref = draft.resume && draft.id && !removeResume ? `/api/interviews/${draft.id}/resume` : null

  return (
    <div className="sheet-backdrop" onMouseDown={() => { if (!saving) onClose() }}>
      <aside
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="interview-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sheet-head">
          <div>
            <p className="eyebrow">{draft.id ? 'Interview' : 'New interview'}</p>
            <h2 id="interview-title">{draft.id ? draft.candidateName || draft.title || 'Interview' : 'Assign interview'}</h2>
          </div>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            <IconClose />
          </button>
        </header>
        <form
          className="sheet-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <div className="sheet-body">
          {draft.id ? (
            <button className="btn btn-primary btn-block join-link" type="button" onClick={joinRoom}>
              Join room
            </button>
          ) : null}
          {error ? <div className="form-error" style={{ marginBottom: 14 }}>{error}</div> : null}
          {draft.createdByName ? <p className="help" style={{ marginBottom: 14 }}>Scheduled by {draft.createdByName}</p> : null}
          <div className="form-grid">
            <label className="field span-2">
              <span className="field-label">Candidate name</span>
              <input className="input" value={draft.candidateName} disabled={!canManage} onChange={(event) => patch({ candidateName: event.target.value })} />
            </label>
            <label className="field span-2">
              <span className="field-label">Title</span>
              <input className="input" value={draft.title} disabled={!canManage} onChange={(event) => patch({ title: event.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">Result</span>
              <select
                className="select"
                value={draft.status}
                disabled={!canManage}
                onChange={(event) => {
                  const status = event.target.value as Status
                  const stepResults = { ...draft.stepResults }
                  if (draft.step) stepResults[draft.step as StepId] = status
                  patch({ status, stepResults: passEarlierSteps(stepResults) })
                }}
              >
                {STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </label>
            <div className="field">
              <span className="field-label">Color</span>
              <div className="swatches">
                {EVENT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={draft.color === color ? 'swatch selected' : 'swatch'}
                    style={{ background: color }}
                    aria-label={color}
                    disabled={!canManage}
                    onClick={() => patch({ color })}
                  />
                ))}
                <input
                  className="color-input"
                  type="color"
                  value={draft.color}
                  disabled={!canManage}
                  aria-label="Custom color"
                  onChange={(event) => patch({ color: event.target.value.toLowerCase() })}
                />
              </div>
            </div>
            <label className="field">
              <span className="field-label">Proxy interviewer</span>
              <select className="select" value={draft.interviewerId} disabled={!canManage} onChange={(event) => patch({ interviewerId: event.target.value })}>
                <option value="">Select interviewer</option>
                {options.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}{person.email ? ` · ${person.email}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Step</span>
              <select
                className="select"
                value={STEPS.some((step) => step.value === draft.step) ? draft.step : ''}
                disabled={!canManage}
                onChange={(event) => {
                  const step = event.target.value
                  if (!step) {
                    patch({ step })
                    return
                  }
                  const status = draft.stepResults[step as StepId] ?? 'scheduled'
                  patch({
                    step,
                    status,
                    stepResults: passEarlierSteps({ ...draft.stepResults, [step]: status }),
                  })
                }}
              >
                <option value="">Choose a step</option>
                {STEPS.map((step) => (
                  <option key={step.value} value={step.value}>{step.label}</option>
                ))}
              </select>
            </label>
            <div className="field span-2">
              <span className="field-label">Stage results</span>
              <div className="stage-results">
                {STEPS.map((step) => (
                  <label key={step.value} className="stage-result">
                    <span>{step.label}</span>
                    <select
                      className="select"
                      value={draft.stepResults[step.value] ?? ''}
                      disabled={!canManage}
                      onChange={(event) => {
                        const value = event.target.value as Status | ''
                        const next = { ...draft.stepResults }
                        if (!value) delete next[step.value]
                        else next[step.value] = value
                        const stepResults = passEarlierSteps(next)
                        patch({
                          stepResults,
                          status: step.value === draft.step ? stepResults[step.value] || 'scheduled' : draft.status,
                        })
                      }}
                    >
                      <option value="">—</option>
                      {STATUSES.map((status) => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
            <label className="field">
              <span className="field-label">Date</span>
              <input className="input" type="date" value={draft.date} disabled={!canManage} onChange={(event) => patch({ date: event.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">Time (CET)</span>
              <input
                className="input"
                type="time"
                step={300}
                value={minutesToInput(draft.startMinutes)}
                disabled={!canManage}
                onChange={(event) => patch({ startMinutes: inputToMinutes(event.target.value) })}
              />
            </label>
            <label className="field">
              <span className="field-label">Duration (minutes)</span>
              <input
                className="input"
                type="number"
                min={15}
                max={720}
                value={draft.durationMinutes}
                disabled={!canManage}
                onChange={(event) => patch({ durationMinutes: Number(event.target.value) })}
              />
            </label>
            <div className="time-readout span-2">
              <div>
                <span>CET</span>
                <strong>{readout?.cet ?? '—'}</strong>
              </div>
              <div>
                <span>EST</span>
                <strong>{readout?.est ?? '—'}</strong>
              </div>
            </div>
            <label className="field">
              <span className="field-label">Real meeting link</span>
              <input className="input" value={draft.realMeetingLink} placeholder="https://" onChange={(event) => patch({ realMeetingLink: event.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">Job description</span>
              <input className="input" value={draft.jdLink} disabled={!canManage} placeholder="https://" onChange={(event) => patch({ jdLink: event.target.value })} />
            </label>
            <div className="field span-2">
              <span className="field-label">Resume</span>
              {canManage ? (
                <>
                  <input
                    className="input"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.rtf,application/pdf"
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null)
                      setRemoveResume(false)
                      setDirty(true)
                    }}
                  />
                  <p className="help">PDF, DOC, DOCX, RTF, or TXT. Up to 8 MB. The assigned interviewer can download it.</p>
                </>
              ) : null}
              {draft.resume && !removeResume ? (
                <div className="resume-current">
                  <span>{draft.resume.originalName} · {formatBytes(draft.resume.size)}</span>
                  <span style={{ display: 'flex', gap: 8 }}>
                    {resumeHref ? <a className="btn btn-ghost" href={resumeHref}>Download</a> : null}
                    {canManage ? (
                      <button
                        className="btn btn-danger"
                        type="button"
                        onClick={() => {
                          setRemoveResume(true)
                          setFile(null)
                          setDirty(true)
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                  </span>
                </div>
              ) : null}
              {file ? <p className="help">Ready to upload {file.name}</p> : null}
              {removeResume ? <p className="help">Resume will be removed when you save.</p> : null}
              {!canManage && !draft.resume ? <p className="help">No resume uploaded.</p> : null}
            </div>
            <label className="field span-2">
              <span className="field-label">Note</span>
              <textarea className="textarea" value={draft.note} onChange={(event) => patch({ note: event.target.value })} />
            </label>
          </div>
          {(safeHref(draft.realMeetingLink) || safeHref(draft.jdLink)) ? (
            <p className="help" style={{ marginTop: 12 }}>
              {safeHref(draft.realMeetingLink) ? <a className="open-link" href={safeHref(draft.realMeetingLink)!} target="_blank" rel="noreferrer">Open real meeting</a> : null}
              {safeHref(draft.jdLink) ? <a className="open-link" href={safeHref(draft.jdLink)!} target="_blank" rel="noreferrer">{safeHref(draft.realMeetingLink) ? ' · ' : ''}Open job description</a> : null}
            </p>
          ) : null}
          {canManage && people.length === 0 ? (
            <p className="help" style={{ marginTop: 12 }}>
              {user.role === 'admin'
                ? 'Add a proxy interviewer in Team before assigning interviews.'
                : 'Ask an administrator to add a proxy interviewer.'}
            </p>
          ) : null}
          </div>
          <div className="sheet-foot">
            <div>
              {canManage && draft.id ? (
                <button className="btn btn-danger" type="button" disabled={saving} onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}>
                  {confirmDelete ? 'Confirm delete' : 'Delete'}
                </button>
              ) : null}
            </div>
            <div className="foot-actions">
              <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" type="submit" disabled={saving || (canManage && people.length === 0 && !draft.interviewerId)}>
                {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Assign interview'}
              </button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  )
}
