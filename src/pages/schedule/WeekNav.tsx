import { Button } from '../../ui/Button'
import { formatDate } from '../../lib/date'
import { shiftWeek } from '../../lib/calendar'
import { CALENDAR_LEGEND } from '../../lib/calendar'

/** §20 — back, forward, "сегодня", plus the colour legend for §14. */
export function WeekNav({
  anchor,
  onChange,
  today,
  days,
  legend = true,
}: {
  anchor: string
  onChange: (iso: string) => void
  today: string
  days: string[]
  legend?: boolean
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => onChange(shiftWeek(anchor, -1))}>
          ← Неделя
        </Button>
        <Button variant="secondary" onClick={() => onChange(today)}>
          Сегодня
        </Button>
        <Button variant="secondary" onClick={() => onChange(shiftWeek(anchor, 1))}>
          Неделя →
        </Button>
      </div>

      <span className="text-sm text-slate-700">
        {formatDate(days[0])} — {formatDate(days[6])}
      </span>

      {legend ? (
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          {CALENDAR_LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`inline-block h-3 w-3 rounded ${item.className}`} />
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
