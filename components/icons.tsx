type IconProps = { size?: number }

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
}

export function IconChart({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 19.5h16" />
      <path d="M7.5 16V10.5" />
      <path d="M12 16V5.5" />
      <path d="M16.5 16v-4" />
    </svg>
  )
}

export function IconCalendar({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M8 3v3M16 3v3M3.5 9.5h17" />
    </svg>
  )
}

export function IconPeople({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="9" cy="8" r="2.4" />
      <path d="M4.8 18.2c.5-2.4 2.2-3.7 4.2-3.7s3.7 1.3 4.2 3.7" />
      <circle cx="16.2" cy="8.4" r="1.9" />
      <path d="M15.2 14.6c1.5.2 2.7 1.1 3.2 3.1" />
    </svg>
  )
}

export function IconResults({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M8 7h9M8 12h9M8 17h6" />
      <path d="M4.2 7.2 5.1 8.1 6.6 6.4" />
      <path d="M4.2 12.2 5.1 13.1 6.6 11.4" />
      <path d="M4.2 17.2 5.1 18.1 6.6 16.4" />
    </svg>
  )
}

export function IconKey({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="8" cy="12" r="3.2" />
      <path d="M11 12h9l-1.8 1.8M16.5 12l1.6 1.6" />
    </svg>
  )
}

export function IconLeave({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M10 6.5H6.5A1.5 1.5 0 0 0 5 8v8a1.5 1.5 0 0 0 1.5 1.5H10" />
      <path d="M10 12h9M16.2 8.8 19.4 12l-3.2 3.2" />
    </svg>
  )
}

export function IconChevron({ direction, size = 18 }: IconProps & { direction: 'left' | 'right' }) {
  return (
    <svg {...base(size)}>
      {direction === 'left' ? <path d="M14 5.5 8.5 12 14 18.5" /> : <path d="M10 5.5 15.5 12 10 18.5" />}
    </svg>
  )
}

export function IconClose({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}
