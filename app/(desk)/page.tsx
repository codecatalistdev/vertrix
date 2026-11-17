import { cookies } from 'next/headers'
import { CalendarScreen } from '@/components/CalendarPage'
import { PublicFrame } from '@/components/site/PublicFrame'
import { SiteHome } from '@/components/site/SiteHome'
import { readSession } from '@/lib/auth'
import { SESSION_COOKIE } from '@/lib/constants'

export async function generateMetadata() {
  const jar = await cookies()
  const session = await readSession(jar.get(SESSION_COOKIE)?.value)
  return { title: session ? 'Calendar' : 'Interview desk' }
}

export default async function Page() {
  const jar = await cookies()
  const session = await readSession(jar.get(SESSION_COOKIE)?.value)
  if (!session) {
    return (
      <PublicFrame>
        <SiteHome />
      </PublicFrame>
    )
  }
  return <CalendarScreen />
}
