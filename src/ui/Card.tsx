import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  /** Removes the inner padding — use for cards that wrap a full-bleed table. */
  flush?: boolean
}

export function Card({ children, className = '', flush = false }: CardProps) {
  return (
    <div
      className={[
        'rounded-card border border-line bg-surface',
        flush ? '' : 'p-4',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function CardTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-base font-semibold text-slate-900">{children}</h2>
      {hint ? <span className="text-sm text-slate-500">{hint}</span> : null}
    </div>
  )
}

/** Small KPI card: uppercase label above a large value (screen-18, screen-21). */
export function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  )
}

/** Inline notice inside a page (blue = info, slate = locked/neutral). */
export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'neutral'
  children: ReactNode
}) {
  const styles =
    tone === 'info'
      ? 'bg-blue-50 text-blue-800'
      : 'bg-muted text-slate-700'
  return <div className={`rounded-card px-3 py-2 text-sm ${styles}`}>{children}</div>
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>
}
