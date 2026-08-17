import type { ReactNode } from 'react'

export type PillTone = 'success' | 'warning' | 'neutral' | 'danger' | 'info'

/** Status pill colours measured from reference/screens — docs/design-tokens.md §6. */
const TONES: Record<PillTone, string> = {
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  neutral: 'bg-muted text-slate-500',
  danger: 'bg-red-100 text-rose-700',
  info: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
}

export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-[23px] items-center rounded-full px-2.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

/**
 * Capacity pill "14/15". Colour follows how full the group is, exactly as in
 * the real groups table: free = green, almost full = amber, full = red.
 */
export function CapacityPill({ filled, capacity }: { filled: number; capacity: number }) {
  const ratio = capacity === 0 ? 0 : filled / capacity
  const tone: PillTone = ratio >= 1 ? 'danger' : ratio >= 0.85 ? 'warning' : 'success'
  return (
    <Pill tone={tone}>
      {filled}/{capacity}
    </Pill>
  )
}
