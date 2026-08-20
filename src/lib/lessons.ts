import type {
  Group,
  Lesson,
  LessonType,
  Recurrence,
  ScheduleRow,
  Subject,
  Weekday,
} from '../data/types'
import { addDays, weekdayOf } from './date'

// ---------------------------------------------------------------- generation

/** Every date in [from, to] that falls on `weekday`. */
export function datesOnWeekday(from: string, to: string, weekday: Weekday): string[] {
  const out: string[] = []
  if (from > to) return out
  let cursor = from
  let guard = 0
  while (weekdayOf(cursor) !== weekday && cursor <= to && guard++ < 7) {
    cursor = addDays(cursor, 1)
  }
  while (cursor <= to) {
    out.push(cursor)
    cursor = addDays(cursor, 7)
  }
  return out
}

/** Dates of a recurring standalone lesson (§10). */
export function recurrenceDates(
  first: string,
  until: string,
  recurrence: Recurrence,
): string[] {
  if (recurrence === 'once') return [first]
  const step = recurrence === 'weekly' ? 7 : 14
  const out: string[] = []
  let cursor = first
  let guard = 0
  while (cursor <= until && guard++ < 400) {
    out.push(cursor)
    cursor = addDays(cursor, step)
  }
  return out
}

/** §34 — history is not rebuilt; only active and future groups get lessons. */
export function groupTakesLessons(group: Group): boolean {
  return group.status === 'active'
}

/**
 * §1 — turn a group's schedule into concrete lessons for the whole period.
 * `from` limits generation to a schedule change's effective date (§23).
 */
export function generateGroupLessons(
  group: Group,
  makeId: () => string,
  from?: string,
): Lesson[] {
  const start = from && from > group.startDate ? from : group.startDate
  const out: Lesson[] = []
  for (const row of group.schedule) {
    // A row without a subject cannot become lessons — it lands in the
    // "требуют разбора" list instead (§33).
    if (!row.subjectId) continue
    for (const date of datesOnWeekday(start, group.endDate, row.weekday)) {
      out.push({
        id: makeId(),
        date,
        startTime: row.startTime,
        endTime: row.endTime,
        subjectId: row.subjectId,
        teacherId: row.teacherId,
        originalTeacherId: row.teacherId,
        groupIds: [group.id],
        type: 'lesson',
        meetUrl: row.meetUrl,
        state: 'planned',
        title: null,
        cancelReason: null,
        sourceRowId: row.id,
        seriesId: null,
      })
    }
  }
  return out.sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
  )
}

// ------------------------------------------------------------------ queries

/** §3 — the lesson is run by someone other than the person originally put on it. */
export function hasSubstitution(lesson: Lesson): boolean {
  return lesson.originalTeacherId !== null && lesson.teacherId !== lesson.originalTeacherId
}

/** Lessons generated from this group's own schedule. */
export function ownLessons(lessons: Lesson[], groupId: string): Lesson[] {
  return lessons.filter((l) => l.sourceRowId !== null && l.groupIds.includes(groupId))
}

/** §14 — lessons the group takes part in that were created somewhere else. */
export function sharedLessons(lessons: Lesson[], groupId: string): Lesson[] {
  return lessons.filter((l) => l.sourceRowId === null && l.groupIds.includes(groupId))
}

// ---------------------------------------------------------------- conflicts

export interface Conflict {
  kind: 'teacher' | 'group'
  /** Id of the teacher or group the clash is about. */
  holderId: string
  lesson: Lesson
}

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  aStart < bEnd && bStart < aEnd

/**
 * §13 — is everybody free at that time? Returns every clash so the form can name
 * it; saving anyway stays possible.
 */
export function findConflicts(
  lessons: Lesson[],
  candidate: {
    date: string
    startTime: string
    endTime: string
    teacherIds: string[]
    groupIds: string[]
  },
  ignoreSeriesId: string | null = null,
): Conflict[] {
  const out: Conflict[] = []
  for (const lesson of lessons) {
    if (lesson.date !== candidate.date) continue
    if (lesson.state === 'cancelled') continue
    if (ignoreSeriesId && lesson.seriesId === ignoreSeriesId) continue
    if (!overlaps(candidate.startTime, candidate.endTime, lesson.startTime, lesson.endTime))
      continue

    if (lesson.teacherId && candidate.teacherIds.includes(lesson.teacherId)) {
      out.push({ kind: 'teacher', holderId: lesson.teacherId, lesson })
    }
    for (const gid of lesson.groupIds) {
      if (candidate.groupIds.includes(gid)) {
        out.push({ kind: 'group', holderId: gid, lesson })
      }
    }
  }
  return out
}

// ------------------------------------------------------------ frozen months

/** "2026-08-17" -> "2026-08". */
export const monthOf = (isoDate: string): string => isoDate.slice(0, 7)

/** §24 — a schedule change may not take effect inside a closed payroll month. */
export function isMonthFrozen(frozenMonths: string[], isoDate: string): boolean {
  return frozenMonths.includes(monthOf(isoDate))
}

// --------------------------------------------------------- schedule change

export interface SchedulePlan {
  /** Future lessons the new schedule replaces. */
  toDelete: Lesson[]
  /** Lessons the new schedule produces from the effective date on. */
  toCreate: Lesson[]
  /** §25 — future lessons carrying a substitution, never removed silently. */
  affected: Lesson[]
  /** Lessons before the effective date, left completely alone (§23). */
  untouched: number
}

/**
 * §23, §26 — split the group's lessons on the effective date and work out what
 * the change would do, without doing it.
 */
export function planScheduleChange(
  current: Lesson[],
  group: Group,
  nextSchedule: ScheduleRow[],
  effectiveFrom: string,
  makeId: () => string,
): SchedulePlan {
  const mine = ownLessons(current, group.id)
  const future = mine.filter((l) => l.date >= effectiveFrom)
  const affected = future.filter(hasSubstitution)
  const toDelete = future.filter((l) => !hasSubstitution(l))
  const toCreate = generateGroupLessons(
    { ...group, schedule: nextSchedule },
    makeId,
    effectiveFrom,
  )
  return { toDelete, toCreate, affected, untouched: mine.length - future.length }
}

// --------------------------------------------------------------- migration

export interface MigrationRow {
  group: Group
  reason: 'no-teacher' | 'many-teachers' | 'no-subject'
  rows: ScheduleRow[]
}

/**
 * §31–§33 — fill in what can be filled in, and collect the rest.
 *
 * The spec describes converting production data, where a row has neither
 * subject nor teacher. In the prototype a row already carries both fields, so
 * the same two rules are applied to whatever is still empty.
 */
export function migrateSchedule(
  groups: Group[],
  subjects: Subject[],
): { patched: Group[]; needsReview: MigrationRow[] } {
  const needsReview: MigrationRow[] = []

  const patched = groups.map((group) => {
    if (!groupTakesLessons(group)) return group

    const live = subjects.filter((s) => s.courseId === group.courseId && !s.isArchived)
    // §32 — the group's own distinct teachers, ignoring empty slots.
    const known = [
      ...new Set(group.schedule.map((r) => r.teacherId).filter((id): id is string => !!id)),
    ]

    const schedule = group.schedule.map((row) => {
      let next = row
      // §31 — a single-subject course fills the subject in everywhere.
      if (!next.subjectId && live.length === 1) next = { ...next, subjectId: live[0].id }
      // §32 — exactly one teacher in the group fills the teacher in everywhere.
      if (!next.teacherId && known.length === 1) next = { ...next, teacherId: known[0] }
      return next
    })

    const unresolved = schedule.filter((r) => !r.subjectId || !r.teacherId)
    if (unresolved.length > 0) {
      const reason: MigrationRow['reason'] = unresolved.some((r) => !r.subjectId)
        ? 'no-subject'
        : known.length === 0
          ? 'no-teacher'
          : 'many-teachers'
      needsReview.push({ group: { ...group, schedule }, reason, rows: unresolved })
    }

    return { ...group, schedule }
  })

  return { patched, needsReview }
}

export const MIGRATION_REASON_TEXT: Record<MigrationRow['reason'], string> = {
  'no-subject': 'Не удалось определить предмет — у курса их несколько',
  'no-teacher': 'В группе не назначен ни один преподаватель',
  'many-teachers': 'В группе несколько преподавателей — кто ведёт эту строку, неясно',
}

export const LESSON_TYPES: LessonType[] = [
  'lesson',
  'lecture',
  'seminar',
  'office_hours',
  'mock',
  'consultation',
]

/** One weekday of a standalone lesson series; each day can run at its own time. */
export interface SeriesSlot {
  weekday: Weekday
  startTime: string
  endTime: string
}

/**
 * Dates a multi-day series produces: every slot repeats on its own weekday
 * inside [from, until], so a lecture can be Monday at 10:00 and Thursday at
 * 15:00 without being two separate series.
 */
export function seriesOccurrences(
  slots: SeriesSlot[],
  from: string,
  until: string,
  recurrence: Recurrence,
): { date: string; startTime: string; endTime: string }[] {
  const out: { date: string; startTime: string; endTime: string }[] = []
  const step = recurrence === 'biweekly' ? 14 : 7

  for (const slot of slots) {
    const all = datesOnWeekday(from, recurrence === 'once' ? from2(from) : until, slot.weekday)
    const taken = recurrence === 'once' ? all.slice(0, 1) : everyNth(all, step / 7)
    for (const date of taken) {
      out.push({ date, startTime: slot.startTime, endTime: slot.endTime })
    }
  }
  return out.sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
  )
}

/** A week ahead is enough to find the first occurrence of every weekday. */
const from2 = (from: string) => addDays(from, 7)

const everyNth = <T,>(items: T[], n: number): T[] =>
  n <= 1 ? items : items.filter((_, i) => i % n === 0)
