import type { ReactNode } from 'react'

/**
 * Table chrome copied from the real system: white card, slate-50 header with
 * 12px uppercase labels, rows separated by a 1px slate-100 line.
 */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-page">{children}</thead>
}

export function TH({
  children,
  align = 'left',
  className = '',
}: {
  children?: ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}) {
  return (
    <th
      className={[
        'border-b border-line px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      ].join(' ')}
    >
      {children}
    </th>
  )
}

export function TR({
  children,
  highlighted = false,
  onClick,
}: {
  children: ReactNode
  /** Starred rows get the amber-50 background, as in the groups table. */
  highlighted?: boolean
  onClick?: () => void
}) {
  return (
    <tr
      onClick={onClick}
      className={[
        'border-b border-muted last:border-b-0',
        highlighted ? 'bg-amber-50' : 'bg-surface',
        onClick ? 'cursor-pointer hover:bg-page' : '',
      ].join(' ')}
    >
      {children}
    </tr>
  )
}

export function TD({
  children,
  align = 'left',
  className = '',
}: {
  children?: ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}) {
  return (
    <td
      className={[
        'px-4 py-3 align-top text-sm text-slate-800',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      ].join(' ')}
    >
      {children}
    </td>
  )
}

export type BandTone = 'ielts' | 'pre' | 'nuet' | 'sat'

/**
 * Full-width coloured band that groups table rows by course.
 * Colours are taken from the real groups table (screen-16, screen-17).
 */
const BANDS: Record<BandTone, string> = {
  ielts: 'bg-red-200 text-red-900',
  pre: 'bg-amber-200 text-amber-900',
  nuet: 'bg-emerald-200 text-emerald-900',
  sat: 'bg-blue-100 text-blue-900',
}

export function bandToneForCourse(title: string): BandTone {
  if (title.startsWith('Pre-IELTS')) return 'pre'
  if (title.startsWith('NUET')) return 'nuet'
  if (title.startsWith('SAT')) return 'sat'
  return 'ielts'
}

export function BandRow({
  colSpan,
  title,
  count,
  tone,
}: {
  colSpan: number
  title: string
  count: number
  tone: BandTone
}) {
  return (
    <tr>
      <td colSpan={colSpan} className={`px-4 py-2 text-sm font-semibold ${BANDS[tone]}`}>
        {title} <span className="font-normal opacity-70">({count})</span>
      </td>
    </tr>
  )
}

/** Secondary line inside a cell — e-mail under a name, time under a date. */
export function SubText({ children }: { children: ReactNode }) {
  return <div className="mt-0.5 text-xs text-slate-500">{children}</div>
}
