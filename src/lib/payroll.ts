import type {
  Group,
  Lesson,
  PayrollLine,
  PayrollRow,
  ScheduleEvent,
  Staff,
  Subject,
} from '../data/types'
import { effectiveState } from './attendance'
import { durationHours, formatDate, WEEKDAY_SHORT } from './date'
import { monthOf } from './lessons'

/** §1, §4 — only a lesson that happened is paid for. */
export function isPayable(lesson: Lesson, now: number): boolean {
  const state = effectiveState(lesson, now)
  return state === 'held' || state === 'manual'
}

/**
 * §1–§3 — the lessons that belong to one teacher in one month.
 *
 * §2: the teacher currently on the lesson, which after a substitution is the
 * stand-in. §3: the month the lesson actually landed in, so a lesson moved into
 * September is paid in September without any extra bookkeeping.
 */
export function payableLessons(
  lessons: Lesson[],
  teacherId: string,
  month: string,
  now: number,
): Lesson[] {
  return lessons.filter(
    (l) => l.teacherId === teacherId && monthOf(l.date) === month && isPayable(l, now),
  )
}

/** §12 — lessons the teacher never marked; they are not paid and need sorting out. */
export function unmarkedLessons(
  lessons: Lesson[],
  teacherId: string,
  month: string,
  now: number,
): Lesson[] {
  return lessons.filter(
    (l) =>
      l.teacherId === teacherId &&
      monthOf(l.date) === month &&
      effectiveState(l, now) === 'unmarked',
  )
}

/** §11 — a lesson is either an hour or an hour and a half. */
const isHalfHourLonger = (lesson: Lesson) =>
  durationHours(lesson.startTime, lesson.endTime) > 1.25

export interface BuildContext {
  groups: Group[]
  subjects: Subject[]
  staff: Staff[]
  events: ScheduleEvent[]
}

/**
 * §5–§11 — turns the month's lessons into the sheet.
 *
 * A shared lesson is one line no matter how many groups sit in it (§8), and the
 * substitutions collapse into a single line with a breakdown (§9).
 */
export function buildPayrollLines(
  lessons: Lesson[],
  row: PayrollRow,
  person: Staff | undefined,
  ctx: BuildContext,
  now: number,
): PayrollLine[] {
  const mine = payableLessons(lessons, row.staffId, row.month, now)
  const titleOfGroup = (id: string) => ctx.groups.find((g) => g.id === id)?.title ?? id
  const titleOfSubject = (id: string) => ctx.subjects.find((s) => s.id === id)?.title ?? ''
  const nameOf = (id: string | null) =>
    id ? (ctx.staff.find((p) => p.id === id)?.fullName ?? id) : '—'

  const rateFor = (key: string, fallback: number) =>
    row.rates[key] ?? person?.defaultRate ?? fallback

  const buckets = new Map<string, PayrollLine>()
  const substitutions: Lesson[] = []

  for (const lesson of mine) {
    // §2 — a lesson the teacher only has because they stood in goes to its own
    // line, so it can be shown with who and when.
    const isSubstitution =
      lesson.originalTeacherId !== null && lesson.originalTeacherId !== lesson.teacherId
    if (isSubstitution) {
      substitutions.push(lesson)
      continue
    }

    const shared = lesson.sourceRowId === null
    const key = shared
      ? `shared:${lesson.seriesId ?? lesson.id}`
      : `group:${lesson.groupIds[0]}:${lesson.subjectId}`

    const existing = buckets.get(key)
    if (existing) {
      if (isHalfHourLonger(lesson)) existing.lessons15h += 1
      else existing.lessons1h += 1
      continue
    }

    buckets.set(key, {
      key,
      kind: shared ? 'shared' : 'group',
      title: shared
        ? (lesson.title ?? 'Общее занятие')
        : titleOfGroup(lesson.groupIds[0]),
      subtitle: shared
        ? `${titleOfSubject(lesson.subjectId)} · ${WEEKDAY_SHORT[weekdayNumber(lesson.date)]} ${lesson.startTime}–${lesson.endTime}`
        : `${titleOfSubject(lesson.subjectId)} · ${lesson.startTime}–${lesson.endTime}`,
      groupTitles: shared ? lesson.groupIds.map(titleOfGroup) : [],
      details: [],
      lessons1h: isHalfHourLonger(lesson) ? 0 : 1,
      lessons15h: isHalfHourLonger(lesson) ? 1 : 0,
      ratePerHour: 0,
      total: 0,
    })
  }

  if (substitutions.length > 0) {
    buckets.set('substitution', {
      key: 'substitution',
      kind: 'substitution',
      title: 'Замены',
      subtitle: `${substitutions.length} занятий`,
      groupTitles: [],
      details: substitutions
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(
          (l) =>
            `${formatDate(l.date)} ${l.groupIds.map(titleOfGroup).join(', ')} ${titleOfSubject(l.subjectId)} за ${nameOf(l.originalTeacherId)}`,
        ),
      lessons1h: substitutions.filter((l) => !isHalfHourLonger(l)).length,
      lessons15h: substitutions.filter(isHalfHourLonger).length,
      ratePerHour: 0,
      total: 0,
    })
  }

  const fallbackRate = row.lines[0]?.ratePerHour ?? 6000
  return [...buckets.values()]
    .map((line) => {
      const ratePerHour = rateFor(line.key, fallbackRate)
      return {
        ...line,
        ratePerHour,
        total: ratePerHour * (line.lessons1h + line.lessons15h * 1.5),
      }
    })
    .sort((a, b) => order(a.kind) - order(b.kind) || a.title.localeCompare(b.title))
}

const order = (kind: PayrollLine['kind']) =>
  kind === 'group' ? 0 : kind === 'shared' ? 1 : 2

function weekdayNumber(iso: string) {
  const js = new Date(`${iso}T00:00:00`).getDay()
  return (js === 0 ? 7 : js) as 1 | 2 | 3 | 4 | 5 | 6 | 7
}

export const sumLines = (lines: PayrollLine[]) =>
  lines.reduce((acc, l) => acc + l.total, 0)

/** The old hand-typed total, kept for the side-by-side check. */
export const legacyTotal = (row: PayrollRow) =>
  row.lines.reduce(
    (acc, l) => acc + l.ratePerHour * (l.lessons1h + l.lessons15h * 1.5),
    0,
  )
