/** Тонкие линейные иконки для блоков преимуществ и карточек. */

type Props = { className?: string }
const base = 'h-6 w-6'
const svg = (className?: string) => ({
  className: `${base} ${className ?? ''}`.trim(),
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const IconArea = ({ className }: Props) => (
  <svg {...svg(className)}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
)
export const IconCar = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M5 17h14M4 17v-4l2-5h12l2 5v4M4 17v2h2v-2M18 17v2h2v-2" />
    <circle cx="7.5" cy="13.5" r="1" /><circle cx="16.5" cy="13.5" r="1" />
  </svg>
)
export const IconWifi = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M2.5 9a15 15 0 0 1 19 0M5.5 12.5a10.5 10.5 0 0 1 13 0M8.5 16a6 6 0 0 1 7 0" />
    <circle cx="12" cy="19.5" r=".8" fill="currentColor" />
  </svg>
)
export const IconClimate = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M12 7l-2.2-2.2M12 7l2.2-2.2M12 17l-2.2 2.2M12 17l2.2 2.2" />
  </svg>
)
export const IconPin = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" />
  </svg>
)
export const IconLift = ({ className }: Props) => (
  <svg {...svg(className)}>
    <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M12 3v18M9 8l-1.5 2h3L9 8ZM15 16l1.5-2h-3l1.5 2Z" />
  </svg>
)
export const IconShield = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9.5 4.1-1.9 7-5.3 7-9.5V6l-7-3Z" /><path d="m9 12 2 2 4-4" />
  </svg>
)
export const IconDoc = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
)
export const IconLock = ({ className }: Props) => (
  <svg {...svg(className)}>
    <rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
)
export const IconChair = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M7 4h10v7H7zM6 11h12M9 11v4m6-4v4M7 15h10M12 15v5" />
  </svg>
)
export const IconPlus = ({ className }: Props) => (
  <svg {...svg(className)}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconMinus = ({ className }: Props) => (
  <svg {...svg(className)}><path d="M5 12h14" /></svg>
)
export const IconFit = ({ className }: Props) => (
  <svg {...svg(className)}><path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" /></svg>
)
export const IconArrow = ({ className }: Props) => (
  <svg {...svg(className)}><path d="M4 12h16M14 6l6 6-6 6" /></svg>
)

export const IconRuble = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M9 20V5h4.5a4 4 0 0 1 0 8H7M7 17h7" />
  </svg>
)
