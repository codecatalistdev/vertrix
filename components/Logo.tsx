import { useId } from 'react'

export function Logo({ size = 40 }: { size?: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Vertrix">
      <defs>
        <linearGradient id={id} x1="4" y1="2" x2="46" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14b8a6" />
          <stop offset="0.55" stopColor="#2563eb" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#${id})`} />
      <path fill="#ffffff" d="M14.5 13.2h6.2L24 23.4l3.3-10.2h6.2L24 36.2 14.5 13.2z" />
      <path fill="#fff4d6" d="M22.2 13.2h3.6L24 18.4l-1.8-5.2z" />
    </svg>
  )
}

export function BrandLockup({ stacked = false }: { stacked?: boolean }) {
  return (
    <div className={stacked ? 'brand brand-stacked' : 'brand'}>
      <Logo size={stacked ? 56 : 36} />
      <div>
        <div className="brand-name">Vertrix</div>
        {stacked ? <div className="brand-tag">Interview desk</div> : null}
      </div>
    </div>
  )
}
