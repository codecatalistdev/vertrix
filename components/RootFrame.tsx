'use client'

import { usePathname } from 'next/navigation'
import { AppShell } from './AppShell'

const PUBLIC = new Set(['/login', '/about', '/approach', '/desk'])

export function RootFrame({ children, signedIn }: { children: React.ReactNode; signedIn: boolean }) {
  const pathname = usePathname()
  if (PUBLIC.has(pathname) || (pathname === '/' && !signedIn)) return children
  return <AppShell>{children}</AppShell>
}
