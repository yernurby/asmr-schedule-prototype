import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Page heading block: optional "Назад", 24px bold title, 14px muted subtitle,
 * actions pinned to the right — exactly the layout used on every ASMR screen.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  backTo,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  backTo?: string
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {backTo ? (
          <Link
            to={backTo}
            className="mt-0.5 inline-flex h-[34px] items-center rounded-card border border-line-strong bg-white px-3 text-sm font-medium text-slate-700 hover:bg-page"
          >
            Назад
          </Link>
        ) : null}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

const PART_TITLES: Record<number, string> = {
  1: 'Предметы у курсов',
  2: 'Занятия и изменение расписания',
  3: 'Календари и доступность',
  4: 'Посещаемость',
  5: 'Замены и переносы',
  6: 'Зарплата по факту занятий',
}

/**
 * Small grey plaque shown on every screen that belongs to the schedule module,
 * so it is obvious which part of the spec the screen implements.
 */
export function PartBadge({ part }: { part: number }) {
  return (
    <div className="mb-4 inline-flex items-center rounded-card bg-muted px-2.5 py-1 text-xs text-slate-500">
      Часть {part} · {PART_TITLES[part]}
    </div>
  )
}
