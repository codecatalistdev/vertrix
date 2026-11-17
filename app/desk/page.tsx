import { DeskPage } from '@/components/site/SitePages'
import { PublicFrame } from '@/components/site/PublicFrame'

export const metadata = { title: 'The desk' }

export default function Page() {
  return (
    <PublicFrame>
      <DeskPage />
    </PublicFrame>
  )
}
