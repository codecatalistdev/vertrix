import { AboutPage } from '@/components/site/SitePages'
import { PublicFrame } from '@/components/site/PublicFrame'

export const metadata = { title: 'About' }

export default function Page() {
  return (
    <PublicFrame>
      <AboutPage />
    </PublicFrame>
  )
}
