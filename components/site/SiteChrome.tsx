'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '../Logo'

const LINKS = [
  { href: '/approach', label: 'How we work' },
  { href: '/desk', label: 'The desk' },
  { href: '/about', label: 'About' },
]

export function SiteChrome({
  children,
  signedIn = false,
}: {
  children: React.ReactNode
  signedIn?: boolean
}) {
  const pathname = usePathname()

  return (
    <div className="site">
      <header className="site-nav">
        <div className="site-nav-bar">
          <Link className="site-brand" href="/">
            <Logo size={63} />
            <span className="brand-word">Vertrix</span>
          </Link>
          <nav className="site-links">
            {LINKS.map((link) => (
              <Link key={link.href} className={pathname === link.href ? 'is-on' : undefined} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="site-nav-actions">
            {signedIn ? null : (
              <Link className={pathname === '/login' ? 'site-text is-on' : 'site-text'} href="/login">
                Sign in
              </Link>
            )}
            <Link className="site-cta" href={signedIn ? '/' : '/login'}>
              {signedIn ? 'Open the desk' : 'Enter the desk'}
            </Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="site-foot">
        <div className="site-foot-grid">
          <div>
            <div className="site-brand">
              <Logo size={63} />
              <span className="brand-word">Vertrix</span>
            </div>
            <p suppressHydrationWarning>Vertrix sits remote interviews. The desk assigns the call, the proxy takes the seat, and every stage stays on the record.</p>
          </div>
          <div>
            <h2>The agency</h2>
            <Link href="/approach">How we work</Link>
            <Link href="/about">About Vertrix</Link>
            <Link href="/desk">What the desk holds</Link>
          </div>
          <div>
            <h2>The team</h2>
            <Link href={signedIn ? '/account' : '/login'}>{signedIn ? 'Account' : 'Sign in'}</Link>
            <Link href={signedIn ? '/' : '/login'}>Calendar</Link>
            <Link href={signedIn ? '/results' : '/login'}>Results</Link>
          </div>
        </div>
        <div className="site-foot-end">Remote roles. Central European time on the schedule, US Eastern beside it.</div>
      </footer>
    </div>
  )
}
