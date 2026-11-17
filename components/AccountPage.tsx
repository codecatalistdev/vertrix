'use client'

import { FormEvent, useState } from 'react'
import { api } from '@/lib/api-client'
import { ROLE_LABEL } from '@/lib/constants'
import { useCurrentUser, useToast } from './AppShell'

export function AccountScreen() {
  return <AccountForm />
}

function AccountForm() {
  const user = useCurrentUser()
  const toast = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setPending(true)
    setError('')
    try {
      await api('/api/account/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast('Password updated')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update the password.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Account</h1>
          <p>Your email stays with this account. You can change the password.</p>
        </div>
      </header>
      <div className="account-card">
        <dl className="identity">
          <dt>Name</dt>
          <dd>{user.name}</dd>
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Role</dt>
          <dd>{ROLE_LABEL[user.role]}</dd>
        </dl>
        <form className="stack-form" onSubmit={onSubmit}>
          {error ? <div className="form-error">{error}</div> : null}
          <label className="field">
            <span className="field-label">Current password</span>
            <input className="input" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </label>
          <label className="field">
            <span className="field-label">New password</span>
            <input className="input" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={6} />
          </label>
          <label className="field">
            <span className="field-label">Confirm new password</span>
            <input className="input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={6} />
          </label>
          <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Updating…' : 'Update password'}</button>
        </form>
      </div>
    </section>
  )
}
