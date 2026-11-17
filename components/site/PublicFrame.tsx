import { cookies } from 'next/headers'
import { readSession } from '@/lib/auth'
import { SESSION_COOKIE } from '@/lib/constants'
import { SiteChrome } from './SiteChrome'

export async function PublicFrame({ children }: { children: React.ReactNode }) {
  const jar = await cookies()
  const session = await readSession(jar.get(SESSION_COOKIE)?.value)
  return <SiteChrome signedIn={Boolean(session)}>{children}</SiteChrome>
}
