import {
  ATTENDANCE_EDIT_HOURS,
  ATTENDANCE_OPEN_AFTER,
  ATTENDANCE_OPEN_BEFORE,
  LATE_AFTER_MINUTES,
  UNMARKED_NOTICE_HOURS,
  type AttendanceMark,
  type AttendanceStatus,
  type Enrollment,
  type Lesson,
  type LessonState,
  type RoleId,
} from '../data/types'

/** Prototype "now" as minutes since epoch-ish, comparable across dates. */
export function stamp(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00`)
}

const MINUTE = 60_000

/**
 * §31 — a lesson nobody opened attendance for stops being "Запланировано" once
 * its time has passed. Derived rather than stored: the prototype clock is the
 * only source of truth about now, and moving it must change what you see.
 */
export function effectiveState(lesson: Lesson, now: number): LessonState {
  if (lesson.state !== 'planned') return lesson.state
  const closes = stamp(lesson.date, lesson.endTime) + ATTENDANCE_OPEN_AFTER * MINUTE
  return now > closes ? 'unmarked' : 'planned'
}

/** §2 — from 10 minutes before the start to 15 minutes after the end. */
export function attendanceWindow(lesson: Lesson, now: number): {
  open: boolean
  tooEarly: boolean
  tooLate: boolean
} {
  const from = stamp(lesson.date, lesson.startTime) - ATTENDANCE_OPEN_BEFORE * MINUTE
  const to = stamp(lesson.date, lesson.endTime) + ATTENDANCE_OPEN_AFTER * MINUTE
  return { open: now >= from && now <= to, tooEarly: now < from, tooLate: now > to }
}

/** §19 — a scan inside the first 15 minutes is presence, later is lateness. */
export function statusForScan(lesson: Lesson, at: number): AttendanceStatus {
  const late = stamp(lesson.date, lesson.startTime) + LATE_AFTER_MINUTES * MINUTE
  return at <= late ? 'present' : 'late'
}

/**
 * §23–§26 — who may still edit. The director is never blocked; everyone else has
 * 48 hours after the lesson ends, after which attendance becomes data rather
 * than a story that can be rewritten.
 */
export function canEditAttendance(
  lesson: Lesson,
  role: RoleId,
  actorId: string | null,
  now: number,
  groupsOfCurator: string[],
): { allowed: boolean; reason?: string } {
  if (role === 'academ_head') return { allowed: true }

  const frozenAt = stamp(lesson.date, lesson.endTime) + ATTENDANCE_EDIT_HOURS * 3600_000
  if (now > frozenAt) {
    return {
      allowed: false,
      reason: `Прошло больше ${ATTENDANCE_EDIT_HOURS} часов — правки закрыты. Изменить может только академический директор.`,
    }
  }

  if (role === 'teacher') {
    return lesson.teacherId === actorId
      ? { allowed: true }
      : { allowed: false, reason: 'Это занятие ведёт другой преподаватель.' }
  }

  if (role === 'curator') {
    return lesson.groupIds.some((id) => groupsOfCurator.includes(id))
      ? { allowed: true }
      : { allowed: false, reason: 'Занятие не относится к вашим группам.' }
  }

  return { allowed: false, reason: 'Нет доступа к правке посещаемости.' }
}

/** §30 — a student may file a claim inside the same 48 hours. */
export function canClaim(lesson: Lesson, now: number): boolean {
  const end = stamp(lesson.date, lesson.endTime)
  return now >= end && now <= end + ATTENDANCE_EDIT_HOURS * 3600_000
}

/** §33 — unmarked for three hours past the end means the director hears about it. */
export function needsUnmarkedNotice(lesson: Lesson, now: number): boolean {
  if (effectiveState(lesson, now) !== 'unmarked') return false
  return now > stamp(lesson.date, lesson.endTime) + UNMARKED_NOTICE_HOURS * 3600_000
}

/** §22 — a student enrolled in two groups of one lecture appears once. */
export function audienceOf(
  enrollments: Enrollment[],
  lesson: Lesson,
): { studentId: string; groupIds: string[] }[] {
  const byStudent = new Map<string, string[]>()
  for (const e of enrollments) {
    if (e.status !== 'active') continue
    if (!lesson.groupIds.includes(e.groupId)) continue
    byStudent.set(e.studentId, [...(byStudent.get(e.studentId) ?? []), e.groupId])
  }
  return [...byStudent.entries()].map(([studentId, groupIds]) => ({ studentId, groupIds }))
}

export interface AttendanceCounters {
  present: number
  late: number
  absent: number
  manual: number
  total: number
}

/** §10 — the four numbers above the list. */
export function countAttendance(
  marks: AttendanceMark[],
  lessonId: string,
  audienceSize: number,
): AttendanceCounters {
  const mine = marks.filter((m) => m.lessonId === lessonId && !m.outsideGroup)
  const present = mine.filter((m) => m.status === 'present').length
  const late = mine.filter((m) => m.status === 'late').length
  const manual = mine.filter((m) => m.source !== 'qr' && m.status !== 'absent').length
  return {
    present,
    late,
    manual,
    absent: audienceSize - present - late,
    total: audienceSize,
  }
}

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Был',
  late: 'Опоздал',
  absent: 'Отсутствовал',
}

export const SOURCE_LABEL: Record<string, string> = {
  qr: 'QR',
  teacher: 'Преподаватель',
  curator: 'Куратор',
  director: 'Академ Хэд',
  student_request: 'Заявка студента',
}

/** Six digits derived from the lesson and the rotation tick — stable, no randomness. */
export function codeFor(lessonId: string, tick: number): string {
  let hash = tick * 2654435761
  for (let i = 0; i < lessonId.length; i++) hash = (hash * 31 + lessonId.charCodeAt(i)) % 1_000_000
  return String(Math.abs(hash) % 1_000_000).padStart(6, '0')
}
