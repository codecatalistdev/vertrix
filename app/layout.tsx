import type { Metadata, Viewport } from 'next'
import { Outfit } from 'next/font/google'
import { cookies } from 'next/headers'
import { RootFrame } from '@/components/RootFrame'
import { readSession } from '@/lib/auth'
import { SESSION_COOKIE } from '@/lib/constants'
import './globals.css'

const brand = Outfit({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-brand',
})

export const metadata: Metadata = {
  title: {
    default: 'Vertrix',
    template: '%s · Vertrix',
  },
  description: 'Vertrix sits remote interviews for hiring teams and keeps every stage, from intro to offer, on one desk.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#070d18',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies()
  const session = await readSession(jar.get(SESSION_COOKIE)?.value)
  return (
    <html lang="en" className={brand.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <RootFrame signedIn={Boolean(session)}>{children}</RootFrame>
      </body>
    </html>
  )
}
