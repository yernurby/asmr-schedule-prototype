// 16px line icons matching the stroke style of the real sidebar.
// Stroke colour is inherited, so the active item darkens together with the text.

type P = { className?: string }

const base = (className = '') =>
  `h-4 w-4 shrink-0 ${className}`

export const Book = ({ className }: P) => (
  <svg className={base(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2H7v12H3.5A1.5 1.5 0 0 1 2 12.5v-9Z" />
    <path d="M14 3.5A1.5 1.5 0 0 0 12.5 2H9v12h3.5a1.5 1.5 0 0 0 1.5-1.5v-9Z" />
  </svg>
)

export const Calendar = ({ className }: P) => (
  <svg className={base(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <rect x="2" y="3" width="12" height="11" rx="1.5" />
    <path d="M2 6.5h12M5.5 2v2.5M10.5 2v2.5" />
  </svg>
)

export const Users = ({ className }: P) => (
  <svg className={base(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <circle cx="6" cy="5.5" r="2.5" />
    <path d="M1.5 13.5c0-2.2 2-3.7 4.5-3.7s4.5 1.5 4.5 3.7" />
    <path d="M11 3.4a2.4 2.4 0 0 1 0 4.4M12.2 10.2c1.4.5 2.3 1.7 2.3 3.3" />
  </svg>
)

export const Wallet = ({ className }: P) => (
  <svg className={base(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <rect x="2" y="4" width="12" height="9" rx="1.5" />
    <path d="M2 6.5h12M11 9.5h1.5" />
  </svg>
)

export const Map = ({ className }: P) => (
  <svg className={base(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <path d="M2 4l4-1.5 4 1.5 4-1.5v9L10 13l-4-1.5L2 13V4Z" />
    <path d="M6 2.5v9M10 4v9" />
  </svg>
)

export const Doc = ({ className }: P) => (
  <svg className={base(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <path d="M4 2h5l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
    <path d="M9 2v3h3M5.5 8.5h5M5.5 11h5" />
  </svg>
)

export const Clock = ({ className }: P) => (
  <svg className={base(className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.5V8l2.5 1.5" />
  </svg>
)

export const Star = ({ filled = false, className }: P & { filled?: boolean }) => (
  <svg
    className={base(className)}
    viewBox="0 0 16 16"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.2"
  >
    <path d="m8 2 1.8 3.8 4.2.6-3 3 .7 4.2L8 11.6 4.3 13.6l.7-4.2-3-3 4.2-.6L8 2Z" />
  </svg>
)
