import { useEffect, useRef, type ReactNode } from 'react'
import { SLOT_MINUTES, type Weekday } from '../data/types'
import { toMinutes } from '../lib/availability'
import { WEEKDAY_SHORT } from '../lib/date'

/** §9, §10 — 30-minute rows, scrollable, opening around 14:00. */
export const GRID_START_HOUR = 7
export const GRID_END_HOUR = 23
export const SLOT_HEIGHT = 22
export const DEFAULT_SCROLL_HOUR = 14

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7]

export interface WeekGridBlock {
  key: string
  weekday: Weekday
  startTime: string
  endTime: string
  /** 0-based column among overlapping blocks, and how many share the slot (§12). */
  lane: number
  lanes: number
  content: ReactNode
  className: string
  onClick?: () => void
  title?: string
}

const offsetOf = (time: string) => toMinutes(time) - GRID_START_HOUR * 60
const pxOf = (minutes: number) => (minutes / SLOT_MINUTES) * SLOT_HEIGHT

/** §12 — assign overlapping blocks to side-by-side lanes, per weekday. */
export function assignLanes<
  T extends { weekday: Weekday; startTime: string; endTime: string },
>(items: T[]): { item: T; lane: number; lanes: number }[] {
  const out: { item: T; lane: number; lanes: number }[] = []

  for (const weekday of WEEKDAYS) {
    const day = items
      .filter((i) => i.weekday === weekday)
      .sort(
        (a, b) =>
          toMinutes(a.startTime) - toMinutes(b.startTime) ||
          toMinutes(a.endTime) - toMinutes(b.endTime),
      )

    // Split the day into clusters of mutually overlapping blocks; inside a
    // cluster every block gets its own lane and they share the width.
    let cluster: T[] = []
    let clusterEnd = -1

    const flush = () => {
      cluster.forEach((item, i) => out.push({ item, lane: i, lanes: cluster.length }))
      cluster = []
      clusterEnd = -1
    }

    for (const item of day) {
      if (cluster.length > 0 && toMinutes(item.startTime) >= clusterEnd) flush()
      cluster.push(item)
      clusterEnd = Math.max(clusterEnd, toMinutes(item.endTime))
    }
    if (cluster.length > 0) flush()
  }

  return out
}

/**
 * The week grid every calendar in part 3 is built on: day columns, half-hour
 * rows, blocks positioned by time and laid side by side when they overlap.
 */
export function WeekGrid({
  days,
  blocks,
  background,
  todayIso,
  nowTime,
  onCellMouseDown,
  onCellMouseEnter,
  onMouseUp,
}: {
  /** ISO date of each weekday column, Monday first. */
  days: string[]
  blocks: WeekGridBlock[]
  /** Cell keys to shade — availability (§15). */
  background?: Set<string>
  todayIso?: string
  /** "HH:MM" of the red current-time line (§11). */
  nowTime?: string
  onCellMouseDown?: (weekday: Weekday, time: string) => void
  onCellMouseEnter?: (weekday: Weekday, time: string) => void
  onMouseUp?: () => void
}) {
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scroller.current) return
    scroller.current.scrollTop = pxOf((DEFAULT_SCROLL_HOUR - GRID_START_HOUR) * 60)
  }, [])

  const rows: string[] = []
  for (let h = GRID_START_HOUR; h < GRID_END_HOUR; h++) {
    rows.push(`${String(h).padStart(2, '0')}:00`)
    rows.push(`${String(h).padStart(2, '0')}:30`)
  }

  const totalHeight = rows.length * SLOT_HEIGHT
  const todayIndex = todayIso ? days.indexOf(todayIso) : -1

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex border-b border-line bg-page">
        <div className="w-14 shrink-0" />
        {days.map((iso, i) => {
          const isToday = iso === todayIso
          const dd = iso.split('-')[2]
          return (
            <div key={iso} className="flex-1 border-l border-line px-2 py-2 text-center">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {WEEKDAY_SHORT[WEEKDAYS[i]]}
              </div>
              <div className="mt-0.5 flex justify-center">
                <span
                  className={[
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-sm',
                    isToday ? 'bg-slate-900 font-medium text-white' : 'text-slate-700',
                  ].join(' ')}
                >
                  {Number(dd)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div
        ref={scroller}
        className="max-h-[62vh] overflow-y-auto"
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div className="flex" style={{ height: totalHeight }}>
          <div className="w-14 shrink-0">
            {rows
              .filter((t) => t.endsWith(':00'))
              .map((time, i) => (
                <div key={time} className="relative" style={{ height: SLOT_HEIGHT * 2 }}>
                  <span className="absolute -top-1.5 right-2 text-xs text-slate-400">
                    {i === 0 ? '' : time}
                  </span>
                </div>
              ))}
          </div>

          {days.map((iso, dayIndex) => {
            const weekday = WEEKDAYS[dayIndex]
            const dayBlocks = blocks.filter((b) => b.weekday === weekday)
            return (
              <div key={iso} className="relative flex-1 border-l border-line">
                {rows.map((time) => (
                  <div
                    key={time}
                    onMouseDown={
                      onCellMouseDown ? () => onCellMouseDown(weekday, time) : undefined
                    }
                    onMouseEnter={
                      onCellMouseEnter ? () => onCellMouseEnter(weekday, time) : undefined
                    }
                    className={[
                      'border-b',
                      time.endsWith(':00') ? 'border-line' : 'border-muted',
                      onCellMouseDown ? 'cursor-pointer select-none' : '',
                      background?.has(`${weekday}-${time}`) ? 'bg-emerald-100/70' : '',
                    ].join(' ')}
                    style={{ height: SLOT_HEIGHT }}
                  />
                ))}

                {dayIndex === todayIndex && nowTime ? (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-red-600"
                    style={{ top: pxOf(offsetOf(nowTime)) }}
                  >
                    <span className="absolute -left-1 -top-[3px] block h-1.5 w-1.5 rounded-full bg-red-600" />
                  </div>
                ) : null}

                {dayBlocks.map((b) => {
                  const width = 100 / b.lanes
                  return (
                    <button
                      key={b.key}
                      type="button"
                      onClick={b.onClick}
                      title={b.title}
                      className={`absolute z-10 overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] leading-tight ${b.className}`}
                      style={{
                        top: pxOf(offsetOf(b.startTime)),
                        height: Math.max(
                          SLOT_HEIGHT - 2,
                          pxOf(toMinutes(b.endTime) - toMinutes(b.startTime)) - 2,
                        ),
                        left: `calc(${b.lane * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                      }}
                    >
                      {b.content}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
