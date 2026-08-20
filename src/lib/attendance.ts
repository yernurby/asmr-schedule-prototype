import {
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
 * Who may still touch attendance.
 *
 * The rules differ per role on purpose, and they are not symmetric:
 *
 * - the teacher marks only while the lesson is running, in the same −10/+15
 *   window that opens attendance. Later than that they must move the lesson;
 * - the curator has no deadline at all, but can only work on a lesson somebody
 *   already confirmed happened — otherwise a curator could quietly "hold" a
 *   lesson that never took place and put it into payroll;
 * - the academ director is never restricted.
 */
export function canEditAttendance(
  lesson: Lesson,
  role: RoleId,
  actorId: string | null,
  now: number,
  groupsOfCurator: string[],
): { allowed: boolean; reason?: string } {
  if (role === 'academ_head') return { allowed: true }

  if (role === 'teacher') {
    if (lesson.teacherId !== actorId) {
      return { allowed: false, reason: 'Это занятие ведёт другой преподаватель.' }
    }
    const win = attendanceWindow(lesson, now)
    if (!win.open) {
      return {
        allowed: false,
        reason: win.tooEarly
          ? 'Отметка откроется за 10 минут до начала.'
          : `Окно отметки закрылось через ${ATTENDANCE_OPEN_AFTER} минут после конца занятия. Если урок шёл в другое время — сначала перенесите его.`,
      }
    }
    return { allowed: true }
  }

  if (role === 'curator') {
    if (!lesson.groupIds.some((id) => groupsOfCurator.includes(id))) {
      return { allowed: false, reason: 'Занятие не относится к вашим группам.' }
    }
    // Curators are not on a clock, but the lesson must already be confirmed as
    // having happened — by the teacher opening it, or by the director counting it.
    if (lesson.state !== 'held' && lesson.state !== 'manual') {
      return {
        allowed: false,
        reason:
          'Занятие ещё не отмечено как проведённое. Отметить посещаемость можно после того, как преподаватель проведёт занятие или академический директор засчитает его.',
      }
    }
    return { allowed: true }
  }

  return { allowed: false, reason: 'Нет доступа к правке посещаемости.' }
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
