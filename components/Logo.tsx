export function Logo({ size = 40 }: { size?: number }) {
  return (
    <img
      className="logo-mark"
      src="/vertrix-logo.png"
      width={size}
      height={size}
      alt="Vertrix"
    />
  )
}

export function BrandLockup({ stacked = false }: { stacked?: boolean }) {
  return (
    <div className={stacked ? 'brand brand-stacked' : 'brand'}>
      <Logo size={stacked ? 102 : 72} />
      <div>
        <div className="brand-name">Vertrix</div>
        {stacked ? <div className="brand-tag">Interview desk</div> : null}
      </div>
    </div>
  )
}
