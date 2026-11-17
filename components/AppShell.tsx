'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState } from 'react'
import { ROLE_LABEL } from '@/lib/constants'
import { initials } from '@/lib/format'
import type { PublicUser, Role } from '@/lib/types'
import { IconCalendar, IconChart, IconKey, IconLeave, IconPeople, IconResults } from './icons'
import { BrandLockup, Logo } from './Logo'
import { canManageInterview } from '@/lib/policy'
import { DeskDataProvider } from './DeskData'

const UserContext = createContext<PublicUser | null>(null)
const ToastContext = createContext<(message: string) => void>(() => {})

export function useCurrentUser() {
  const user = useContext(UserContext)
  if (!user) throw new Error('Missing signed-in user')
  return user
}

export function useToast() {
  return useContext(ToastContext)
}

export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <Logo size={84} />
    </div>
  )
}

export function AppShell({ children, allow }: { children: React.ReactNode; allow?: Role[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<PublicUser | null>(null)
  const [storage, setStorage] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    let ignore = false
    fetch('/api/auth/me')
      .then(async (response) => {
        if (!response.ok) {
          window.location.href = '/login'
          return null
        }
        return response.json() as Promise<{ user: PublicUser }>
      })
      .then((data) => {
        if (!ignore && data) setUser(data.user)
      })
      .catch(() => {
        if (!ignore) window.location.href = '/login'
      })
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!user) return
    fetch('/api/health')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setStorage(data?.storage ?? null))
      .catch(() => setStorage(null))
  }, [user])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (!user) return <LoadingScreen />
  if (allow && !allow.includes(user.role)) {
    router.replace('/')
    return <LoadingScreen />
  }

  const calendarOn = pathname === '/' || pathname.startsWith('/interviews')

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <UserContext.Provider value={user}>
      <ToastContext.Provider value={setToast}>
        <div className="app">
          <aside className="sidebar">
            <BrandLockup />
            <nav className="nav">
              <Link className={pathname.startsWith('/dashboard') ? 'nav-link active' : 'nav-link'} href="/dashboard">
                <IconChart />
                <span>Dashboard</span>
              </Link>
              <Link className={calendarOn ? 'nav-link active' : 'nav-link'} href="/">
                <IconCalendar />
                <span>Calendar</span>
              </Link>
              <Link className={pathname.startsWith('/results') ? 'nav-link active' : 'nav-link'} href="/results">
                <IconResults />
                <span>Results</span>
              </Link>
              {user.role === 'admin' ? (
                <Link className={pathname.startsWith('/team') ? 'nav-link active' : 'nav-link'} href="/team">
                  <IconPeople />
                  <span>Team</span>
                </Link>
              ) : null}
              <Link className={pathname.startsWith('/account') ? 'nav-link active' : 'nav-link'} href="/account">
                <IconKey />
                <span>Account</span>
              </Link>
            </nav>
            <div className="side-spacer" />
            <button className="nav-link" type="button" onClick={signOut}>
              <IconLeave />
              <span>Sign out</span>
            </button>
            <div className="side-user">
              <div className="avatar">{initials(user.name)}</div>
              <div>
                <div className="side-user-name">{user.name}</div>
                <div className="side-user-role">{ROLE_LABEL[user.role]}</div>
              </div>
            </div>
          </aside>
          <div className="main">
            {storage === 'memory' ? (
              <div className="banner">
                This server can’t save to disk, so accounts and interviews will disappear when it restarts.
              </div>
            ) : null}
            <DeskDataProvider canManage={canManageInterview(user.role)}>{children}</DeskDataProvider>
          </div>
          {toast ? (
            <div className="toast" role="status">
              {toast}
            </div>
          ) : null}
        </div>
      </ToastContext.Provider>
    </UserContext.Provider>
  )
}
