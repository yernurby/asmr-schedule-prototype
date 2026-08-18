import {
  REASON_DEADLINE_HOURS,
  REQUEST_TIMEOUT_HOURS,
  REQUEST_TIMEOUT_SHORT_MINUTES,
  TRANSFER_APPROVAL_HOURS,
  type Availability,
  type Lesson,
  type LimitSettings,
  type ScheduleEvent,
  type Verdict,
} from '../data/types'
import { stamp } from './attendance'
import { cellsOfRange, availabilityOf } from './availability'
import { weekdayOf } from './date'

const HOUR = 3600_000

/** "2026-08-17 09:00" -> comparable number. */
export const parseAt = (at: string) => {
  const [date, time] = at.split(' ')
  return stamp(date, time ?? '00:00')
}

/**
 * §12, §25 — how the event counts.
 *
 * A verdict from the director always wins. Without one, a missing reason past
 * the 48-hour deadline turns invalid on its own; anything else counts nowhere
 * and simply hangs as a debt on the teacher.
 */
export function effectiveVerdict(event: ScheduleEvent, now: number): Verdict | null {
  if (event.verdict && event.verdict !== 'deferred') return event.verdict
  if (!event.reason && now > parseAt(event.reasonDueAt)) return 'invalid'
  return null
}

/** §13 — how long the teacher still has to explain themselves. */
export function reasonHoursLeft(event: ScheduleEvent, now: number): number {
  return Math.max(0, Math.round((parseAt(event.reasonDueAt) - now) / HOUR))
}

export function reasonOverdue(event: ScheduleEvent, now: number): boolean {
  return !event.reason && now > parseAt(event.reasonDueAt)
}

/** §28 — everything the director still has to rule on. */
export function needsVerdict(event: ScheduleEvent): boolean {
  return event.verdict === null || event.verdict === 'deferred'
}

/**
 * §8, §9 — silence escalates. Two hours normally, thirty minutes when the lesson
 * is nearly upon us.
 */
export function requestExpired(event: ScheduleEvent, lesson: Lesson, now: number): boolean {
  if (event.requestStatus !== 'pending') return false
  const created = parseAt(event.createdAt)
  const lessonAt = stamp(lesson.date, lesson.startTime)
  const urgent = lessonAt - created < REQUEST_TIMEOUT_HOURS * HOUR
  const deadline = urgent
    ? created + REQUEST_TIMEOUT_SHORT_MINUTES * 60_000
    : created + REQUEST_TIMEOUT_HOURS * HOUR
  return now > deadline
}

/** The status the director actually sees, with silence already escalated. */
export function effectiveRequestStatus(
  event: ScheduleEvent,
  lesson: Lesson | undefined,
  now: number,
): ScheduleEvent['requestStatus'] {
  if (!lesson) return event.requestStatus
  return requestExpired(event, lesson, now) ? 'escalated' : event.requestStatus
}

// ------------------------------------------------------------------- limits

export interface TeacherTally {
  substitutionInvalid: number
  substitutionValid: number
  transferInvalid: number
  transferValid: number
  unresolved: number
}

/** §22, §24 — separate counters, and only the unexcused ones bite. */
export function tallyFor(
  events: ScheduleEvent[],
  teacherId: string,
  month: string,
  now: number,
): TeacherTally {
  const mine = events.filter(
    (e) => e.initiatorId === teacherId && e.createdAt.slice(0, 7) === month,
  )
  const tally: TeacherTally = {
    substitutionInvalid: 0,
    substitutionValid: 0,
    transferInvalid: 0,
    transferValid: 0,
    unresolved: 0,
  }
  for (const e of mine) {
    // §20 — a shift never lands in any counter.
    if (e.type === 'shift') continue
    const verdict = effectiveVerdict(e, now)
    if (verdict === null) {
      tally.unresolved += 1
      continue
    }
    const key = `${e.type === 'substitution' ? 'substitution' : 'transfer'}${
      verdict === 'valid' ? 'Valid' : 'Invalid'
    }` as keyof TeacherTally
    tally[key] += 1
  }
  return tally
}

export type LimitState = 'ok' | 'edge' | 'over'

export function limitState(tally: TeacherTally, limits: LimitSettings): LimitState {
  const subs = tally.substitutionInvalid
  const trans = tally.transferInvalid
  if (subs > limits.substitutionsPerMonth || trans > limits.transfersPerMonth) return 'over'
  if (subs === limits.substitutionsPerMonth || trans === limits.transfersPerMonth) return 'edge'
  return 'ok'
}

export const LIMIT_LABEL: Record<LimitState, string> = {
  ok: 'В норме',
  edge: 'На границе',
  over: 'Лимит превышен',
}

// ---------------------------------------------------------------- transfers

export interface TransferCheck {
  ok: boolean
  problems: string[]
  /** §19 — same calendar day means this is a shift, not a transfer. */
  isShift: boolean
  /** §16 — less than a day of notice needs the director's approval. */
  needsApproval: boolean
}

/**
 * §15 — unlike the director placing a lesson, a teacher's transfer is checked
 * hard: inside their own availability, they are free, and every group is free.
 */
export function checkTransfer(
  lesson: Lesson,
  toDate: string,
  toStartTime: string,
  toEndTime: string,
  availability: Availability[],
  lessons: Lesson[],
  now: number,
  nameOfGroup: (id: string) => string,
): TransferCheck {
  const problems: string[] = []

  if (toEndTime <= toStartTime) problems.push('Конец занятия раньше начала.')

  // 1) inside the teacher's own availability
  if (lesson.teacherId) {
    const cells = availabilityOf(availability, lesson.teacherId)
    if (cells.size > 0) {
      const needed = cellsOfRange(weekdayOf(toDate), toStartTime, toEndTime)
      if (needed.some((c) => !cells.has(c))) {
        problems.push('Новое время вне вашей доступности.')
      }
    }
  }

  // 2) the teacher is not busy, 3) no group is busy
  for (const other of lessons) {
    if (other.id === lesson.id) continue
    if (other.date !== toDate) continue
    if (other.state === 'cancelled') continue
    if (!(toStartTime < other.endTime && other.startTime < toEndTime)) continue

    if (lesson.teacherId && other.teacherId === lesson.teacherId) {
      problems.push(`Вы заняты: ${other.startTime}–${other.endTime}.`)
    }
    const clash = other.groupIds.filter((id) => lesson.groupIds.includes(id))
    if (clash.length > 0) {
      problems.push(
        `Группа занята: ${clash.map(nameOfGroup).join(', ')} в ${other.startTime}–${other.endTime}.`,
      )
    }
  }

  const isShift = toDate === lesson.date
  const hoursAhead = (stamp(lesson.date, lesson.startTime) - now) / HOUR

  return {
    ok: problems.length === 0,
    problems: [...new Set(problems)],
    isShift,
    needsApproval: !isShift && hoursAhead < TRANSFER_APPROVAL_HOURS,
  }
}

/** Deadline for explaining an event, 48 hours from when it was created. */
export function reasonDeadline(createdAt: string): string {
  const at = new Date(parseAt(createdAt) + REASON_DEADLINE_HOURS * HOUR)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`
}
