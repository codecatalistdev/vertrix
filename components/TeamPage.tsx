'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { ROLE_LABEL } from '@/lib/constants'
import type { PublicUser, Role } from '@/lib/types'
import { useCurrentUser, useToast } from './AppShell'
import { IconClose } from './icons'

const ROLES: Role[] = ['admin', 'supporter', 'proxy']

export function TeamScreen() {
  const actor = useCurrentUser()
  const router = useRouter()
  useEffect(() => {
    if (actor.role !== 'admin') router.replace('/')
  }, [actor.role, router])
  if (actor.role !== 'admin') return null
  return <TeamManager />
}

function TeamManager() {
  const actor = useCurrentUser()
  const toast = useToast()
  const [users, setUsers] = useState<PublicUser[] | null>(null)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState<EditorState | null>(null)

  async function load() {
    try {
      const data = await api<{ users: PublicUser[] }>('/api/users')
      setUsers(data.users)
      setError('')
    } catch (caught) {
      if (caught instanceof Error && caught.message !== 'Sign in required.') {
        setError(caught.message)
      }
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Team</h1>
          <p>Create accounts and assign the administrator, proxy interviewer, or interview supporter role.</p>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => setEditor({ mode: 'create', name: '', email: '', password: '', role: 'proxy' })}
        >
          Add person
        </button>
      </header>
      {error ? <div className="form-error" style={{ marginBottom: 12 }}>{error}</div> : null}
      <div className="panel">
        <table className="grid-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users === null ? (
              <tr><td colSpan={4} className="empty">Loading the team…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="empty">No one here yet.</td></tr>
            ) : users.map((person) => (
              <tr key={person.id}>
                <td className="person-name">{person.name}</td>
                <td className="person-email">{person.email}</td>
                <td><span className={`pill pill-${person.role}`}>{ROLE_LABEL[person.role]}</span></td>
                <td>
                  <div className="row-actions">
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => setEditor({
                        mode: 'edit',
                        id: person.id,
                        name: person.name,
                        email: person.email,
                        password: '',
                        role: person.role,
                      })}
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editor ? (
        <PersonSheet
          editor={editor}
          canRemove={editor.mode === 'edit' && editor.id !== actor.id}
          onClose={() => setEditor(null)}
          onSaved={(message) => {
            setEditor(null)
            toast(message)
            void load()
          }}
        />
      ) : null}
    </section>
  )
}

type EditorState = {
  mode: 'create' | 'edit'
  id?: string
  name: string
  email: string
  password: string
  role: Role
}

function PersonSheet({
  editor,
  canRemove,
  onClose,
  onSaved,
}: {
  editor: EditorState
  canRemove: boolean
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [form, setForm] = useState(editor)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      if (form.mode === 'create') {
        await api('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
          }),
        })
        onSaved('Person added')
      } else {
        await api(`/api/users/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name,
            role: form.role,
            password: form.password || undefined,
          }),
        })
        onSaved('Person updated')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this person.')
      setPending(false)
    }
  }

  async function remove() {
    setPending(true)
    setError('')
    try {
      await api(`/api/users/${form.id}`, { method: 'DELETE' })
      onSaved('Person removed')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove this person.')
      setPending(false)
    }
  }

  return (
    <div className="sheet-backdrop" onMouseDown={() => { if (!pending) onClose() }}>
      <aside className="sheet" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="sheet-head">
          <div>
            <p className="eyebrow">Team</p>
            <h2>{form.mode === 'create' ? 'Add person' : 'Edit person'}</h2>
          </div>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}><IconClose /></button>
        </header>
        <form className="sheet-form" onSubmit={onSubmit}>
          <div className="sheet-body">
          {error ? <div className="form-error" style={{ marginBottom: 14 }}>{error}</div> : null}
          <div className="stack-form">
            <label className="field">
              <span className="field-label">Name</span>
              <input className="input" value={form.name} required onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">Email</span>
              <input
                className="input"
                type="email"
                value={form.email}
                required
                disabled={form.mode === 'edit'}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">{form.mode === 'create' ? 'Password' : 'New password'}</span>
              <input
                className="input"
                type="text"
                autoComplete="new-password"
                value={form.password}
                required={form.mode === 'create'}
                placeholder={form.mode === 'edit' ? 'Leave blank to keep the current password' : ''}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Role</span>
              <select className="select" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
                {ROLES.map((role) => (
                  <option key={role} value={role}>{ROLE_LABEL[role]}</option>
                ))}
              </select>
            </label>
            <p className="help">
              Administrators manage the team and the full calendar. Interview supporters assign interviews. Proxy interviewers see only the interviews assigned to them.
            </p>
          </div>
          </div>
          <div className="sheet-foot">
            <div>
              {canRemove ? (
                <button className="btn btn-danger" type="button" disabled={pending} onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}>
                  {confirmDelete ? 'Confirm remove' : 'Remove'}
                </button>
              ) : null}
            </div>
            <div className="foot-actions">
              <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  )
}
