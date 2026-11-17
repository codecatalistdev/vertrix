'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(data.error || 'Email or password is incorrect.')
        setPending(false)
        return
      }
      router.replace('/')
      router.refresh()
    } catch {
      setError('Can’t reach Vertrix right now. Try again.')
      setPending(false)
    }
  }

  return (
    <main className="site-login">
      <div className="login-card">
        <p suppressHydrationWarning className="site-kicker">Team sign in</p>
        <h1>Open the remote desk.</h1>
        <p suppressHydrationWarning className="site-login-copy">The team that assigns and sits remote interviews uses this door.</p>
        <form className="login-form" onSubmit={onSubmit}>
          {error ? <div className="form-error">{error}</div> : null}
          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="input"
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <span className="password-wrap">
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button type="button" className="show-pass" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </span>
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={pending || !email || !password}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
