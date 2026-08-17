import { COMPACT_CONTROL } from '../../ui/Field'
import { useSessionStore } from '../../store/useSessionStore'
import * as Icon from '../../ui/icons'

/**
 * Prototype clock. Everything in the app treats these values as the real
 * current date and time — part 4 needs this to show attendance windows opening
 * and closing without waiting for real days to pass.
 */
export function TimeMachine() {
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)
  const setToday = useSessionStore((s) => s.setToday)
  const setTime = useSessionStore((s) => s.setTime)
  const resetClock = useSessionStore((s) => s.resetClock)

  return (
    <div className="flex items-center gap-1.5 rounded-card bg-page px-2 py-1">
      <span className="text-slate-400">
        <Icon.Clock />
      </span>
      <span className="mr-1 text-xs text-slate-500">Время прототипа</span>
      <input
        type="date"
        value={today}
        onChange={(e) => e.target.value && setToday(e.target.value)}
        className={COMPACT_CONTROL}
        aria-label="Дата прототипа"
      />
      <input
        type="time"
        value={time}
        onChange={(e) => e.target.value && setTime(e.target.value)}
        className={COMPACT_CONTROL}
        aria-label="Время прототипа"
      />
      <button
        type="button"
        onClick={resetClock}
        className="rounded-card px-2 py-1 text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
      >
        Сброс
      </button>
    </div>
  )
}
