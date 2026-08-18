import { SLOT_MINUTES, type Availability, type Lesson, type Weekday } from '../data/types'
import { weekdayOf } from './date'

// ------------------------------------------------------------------- cells

/** "15:30" -> 930 minutes from midnight. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export const cellKey = (weekday: Weekday, time: string) => `${weekday}-${time}`

/** Every 30-minute cell a lesson covers on its weekday. */
export function cellsOfRange(weekday: Weekday, startTime: string, endTime: string): string[] {
  const out: string[] = []
  for (let m = toMinutes(startTime); m < toMinutes(endTime); m += SLOT_MINUTES) {
    out.push(cellKey(weekday, toTime(m)))
  }
  return out
}

export function availabilityOf(all: Availability[], teacherId: string): Set<string> {
  return new Set(all.find((a) => a.teacherId === teacherId)?.cells ?? [])
}

// --------------------------------------------------------- out of availability

/**
 * §5 — a lesson counts as outside availability when any part of it falls on a
 * cell the teacher has not marked. Teachers with no template at all are left
 * alone: absence of a statement is not a conflict.
 */
export function isOutsideAvailability(
  all: Availability[],
  lesson: Lesson,
): boolean {
  if (!lesson.teacherId) return false
  if (lesson.state === 'cancelled') return false
  const entry = all.find((a) => a.teacherId === lesson.teacherId)
  if (!entry || entry.cells.length === 0) return false
  const cells = new Set(entry.cells)
  return cellsOfRange(weekdayOf(lesson.date), lesson.startTime, lesson.endTime).some(
    (c) => !cells.has(c),
  )
}

/** §6, §7 — one row per teacher + weekly slot, not per date, or the list is unreadable. */
export interface OutsideSlot {
  key: string
  teacherId: string
  weekday: Weekday
  startTime: string
  endTime: string
  subjectId: string
  groupIds: string[]
  /** Every future occurrence, so the director sees the scale. */
  lessons: Lesson[]
}

export function outsideAvailabilitySlots(
  all: Availability[],
  lessons: Lesson[],
  fromDate: string,
): OutsideSlot[] {
  const byKey = new Map<string, OutsideSlot>()
  for (const lesson of lessons) {
    if (lesson.date < fromDate) continue
    if (!isOutsideAvailability(all, lesson)) continue
    const weekday = weekdayOf(lesson.date)
    const key = `${lesson.teacherId}-${weekday}-${lesson.startTime}-${lesson.endTime}`
    const existing = byKey.get(key)
    if (existing) {
      existing.lessons.push(lesson)
      continue
    }
    byKey.set(key, {
      key,
      teacherId: lesson.teacherId!,
      weekday,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      subjectId: lesson.subjectId,
      groupIds: lesson.groupIds,
      lessons: [lesson],
    })
  }
  return [...byKey.values()].sort(
    (a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime),
  )
}

// ------------------------------------------------------------- window finder

export interface WindowCandidate {
  weekday: Weekday
  startTime: string
  endTime: string
  /** Existing lessons of the chosen teachers that this window would clash with. */
  conflicts: Lesson[]
}

export interface WindowVariant {
  slots: WindowCandidate[]
  conflictCount: number
}

/**
 * §24 — where does the free time of all chosen teachers overlap?
 *
 * Availability is a weekly template while lessons carry dates, so "busy" is
 * judged over a horizon of the coming weeks. A candidate that fits the template
 * but hits an existing lesson is not dropped — §24 asks for it to be labelled.
 */
export function findWindows(
  all: Availability[],
  lessons: Lesson[],
  teacherIds: string[],
  durationMinutes: number,
  fromDate: string,
  weeksAhead = 4,
): WindowCandidate[] {
  if (teacherIds.length === 0) return []

  // Intersection of everybody's template.
  const sets = teacherIds.map((id) => availabilityOf(all, id))
  if (sets.some((s) => s.size === 0)) return []
  const shared = [...sets[0]].filter((cell) => sets.every((s) => s.has(cell)))

  const horizonEnd = addWeeks(fromDate, weeksAhead)
  const relevant = lessons.filter(
    (l) =>
      l.state !== 'cancelled' &&
      l.date >= fromDate &&
      l.date <= horizonEnd &&
      l.teacherId !== null &&
      teacherIds.includes(l.teacherId),
  )

  const needed = Math.ceil(durationMinutes / SLOT_MINUTES)
  const out: WindowCandidate[] = []

  for (const weekday of [1, 2, 3, 4, 5, 6, 7] as Weekday[]) {
    const times = shared
      .filter((c) => c.startsWith(`${weekday}-`))
      .map((c) => c.slice(String(weekday).length + 1))
      .sort()

    for (const start of times) {
      // The whole duration must sit inside the template.
      const startMin = toMinutes(start)
      const fits = Array.from({ length: needed }, (_, i) =>
        shared.includes(cellKey(weekday, toTime(startMin + i * SLOT_MINUTES))),
      ).every(Boolean)
      if (!fits) continue

      const endTime = toTime(startMin + durationMinutes)
      const conflicts = relevant.filter(
        (l) =>
          weekdayOf(l.date) === weekday &&
          toMinutes(l.startTime) < startMin + durationMinutes &&
          startMin < toMinutes(l.endTime),
      )
      out.push({ weekday, startTime: start, endTime, conflicts })
    }
  }
  return out
}

function addWeeks(iso: string, weeks: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

/**
 * Turns candidate slots into concrete offers of `perWeek` lessons on different
 * days, conflict-free variants first.
 */
export function buildVariants(
  candidates: WindowCandidate[],
  perWeek: number,
  limit = 6,
): WindowVariant[] {
  // Group by time of day: a group normally runs at the same hour every day.
  const byTime = new Map<string, WindowCandidate[]>()
  for (const c of candidates) {
    byTime.set(c.startTime, [...(byTime.get(c.startTime) ?? []), c])
  }

  const variants: WindowVariant[] = []
  for (const [, slots] of byTime) {
    if (slots.length < perWeek) continue
    // Prefer days spread across the week: keep the cheapest `perWeek` by conflicts.
    const picked = [...slots]
      .sort((a, b) => a.conflicts.length - b.conflicts.length || a.weekday - b.weekday)
      .slice(0, perWeek)
      .sort((a, b) => a.weekday - b.weekday)
    variants.push({
      slots: picked,
      conflictCount: picked.reduce((acc, s) => acc + s.conflicts.length, 0),
    })
  }

  return variants
    .sort(
      (a, b) =>
        a.conflictCount - b.conflictCount ||
        toMinutes(a.slots[0].startTime) - toMinutes(b.slots[0].startTime),
    )
    .slice(0, limit)
}
