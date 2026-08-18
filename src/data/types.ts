// Domain types for the prototype.
//
// These mirror the entities that already exist in ASMR (see docs/existing-screens.md),
// extended part by part as the module spec arrives.
//
// Part 1 (docs/01-предметы-курсов.md) added `Subject`, moved subject + teacher +
// Meet link onto every schedule row, and removed the group's hand-picked
// `teacherIds` — that list is now derived from the schedule.

/** Roles the prototype can impersonate. */
export type RoleId = 'academ_head' | 'teacher' | 'curator' | 'student'

export type StaffRole = 'academ_head' | 'teacher' | 'curator'

/** Weekday, 1 = Monday .. 7 = Sunday (ISO). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface Course {
  id: string
  title: string
  isActive: boolean
}

/**
 * A subject belongs to exactly one course and is never shared between courses:
 * "Математика" in NUET and "Math" in SAT are two separate records (part 1, §5).
 *
 * A subject with schedule rows attached can only be archived, never deleted
 * (§3), and a course can never end up with zero live subjects (§4).
 */
export interface Subject {
  id: string
  courseId: string
  title: string
  isArchived: boolean
}

/** A course may hold at most this many live subjects (part 1, §2). */
export const MAX_SUBJECTS_PER_COURSE = 10

/**
 * One row of a group's schedule. Since part 1 it carries the subject, the
 * teacher who runs that slot, and the Meet link (§9).
 */
export interface ScheduleRow {
  id: string
  subjectId: string
  weekday: Weekday
  startTime: string // "17:00"
  endTime: string // "18:30"
  /** Null while nobody has been put on the slot yet. */
  teacherId: string | null
  meetUrl: string | null
}

export type GroupStatus = 'active' | 'archived'

export interface Group {
  id: string
  courseId: string
  title: string
  startDate: string // ISO date, "2026-08-03"
  endDate: string
  weeks: number
  capacity: number
  /**
   * Curators are still picked by hand (part 1, "Кураторы остаются как были").
   * Teachers are NOT stored — derive them with `groupTeacherIds()`, otherwise
   * the header and the schedule become two sources of truth (§12).
   */
  curatorIds: string[]
  enrollmentOpen: boolean
  status: GroupStatus
  schedule: ScheduleRow[]
  notes: string | null
  telegramUrl: string | null
  starred: boolean
}

export interface Staff {
  id: string
  fullName: string
  roles: StaffRole[]
  /** Free-text job title, as on the "Академ Хэд" payroll tab. */
  jobTitle: string | null
  email: string
  phone: string
  status: 'active' | 'inactive'
  /**
   * Subjects the person can teach, possibly across several courses (part 1, §6).
   * Only meaningful for the `teacher` role; the UI hides the field otherwise.
   */
  subjectIds: string[]
}

export interface Student {
  id: string
  fullName: string
  email: string
  phone: string
  city: string
  parentName: string
  parentPhone: string
}

/** Student <-> group link. */
export interface Enrollment {
  id: string
  studentId: string
  groupId: string
  status: 'active' | 'pending'
}

/**
 * One payroll line per teacher per month, as on "Зарплата Академа".
 * `lessons1h` / `lessons15h` are the numbers that are typed in by hand today —
 * part 6 will fill them from actual lessons.
 */
export interface PayrollGroupLine {
  groupId: string
  ratePerHour: number
  lessons1h: number
  lessons15h: number
}

export interface PayrollRow {
  id: string
  staffId: string
  month: string // "2026-08"
  status: 'draft' | 'confirmed'
  lines: PayrollGroupLine[]
}

export interface SeedData {
  /** Bumped whenever seed.json changes, so stored data is re-seeded. */
  seedVersion: number
  anchorDate: string
  courses: Course[]
  subjects: Subject[]
  staff: Staff[]
  students: Student[]
  groups: Group[]
  enrollments: Enrollment[]
  payroll: PayrollRow[]
  lessons: Lesson[]
  auditLog: AuditEntry[]
  /** Months closed for payroll; a schedule change may not reach into them (part 2, §24). */
  frozenMonths: string[]
}

// ---------------------------------------------------------------------------
// Part 2 (docs/02-занятия-и-расписание.md): real lessons behind the schedule.
// ---------------------------------------------------------------------------

/** §9 — the type only changes the label and the payroll line, no logic hangs off it. */
export type LessonType =
  | 'lesson'
  | 'lecture'
  | 'seminar'
  | 'office_hours'
  | 'mock'
  | 'consultation'

/**
 * §4 — five states. Part 2 implements `planned`, `cancelled` and `manual`;
 * `held` and `unmarked` arrive with attendance in part 4.
 */
export type LessonState = 'planned' | 'held' | 'unmarked' | 'cancelled' | 'manual'

export const LESSON_TYPE_LABEL: Record<LessonType, string> = {
  lesson: 'Урок',
  lecture: 'Лекция',
  seminar: 'Семинар',
  office_hours: 'Офис-аурс',
  mock: 'Пробник',
  consultation: 'Консультация',
}

export const LESSON_STATE_LABEL: Record<LessonState, string> = {
  planned: 'Запланировано',
  held: 'Проведено',
  unmarked: 'Не отмечено',
  cancelled: 'Отменено',
  manual: 'Засчитано вручную',
}

/** §2 — a concrete lesson on a concrete date. */
export interface Lesson {
  id: string
  date: string // ISO date
  startTime: string
  endTime: string
  subjectId: string
  teacherId: string | null
  /**
   * §3 — who was originally put on the slot. A lesson where this differs from
   * `teacherId` counts as "с заменой" and is never touched silently (§25, §19).
   */
  originalTeacherId: string | null
  /** §6 — one lesson can belong to several groups. */
  groupIds: string[]
  type: LessonType
  meetUrl: string | null
  state: LessonState
  /** §8 — shown to teachers and students; only standalone lessons carry it. */
  title: string | null
  /** §17 — visible to the teacher. */
  cancelReason: string | null
  /**
   * Schedule row this lesson was generated from. Null for standalone lessons,
   * which is exactly what makes them "общие" in a group card (§14).
   */
  sourceRowId: string | null
  /** §10 — lessons created by one recurrence rule share a series id. */
  seriesId: string | null
}

export type Recurrence = 'once' | 'weekly' | 'biweekly'

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  once: 'Разово',
  weekly: 'Каждую неделю',
  biweekly: 'Раз в две недели',
}

/** §29 — who changed what and from which date. */
export interface AuditEntry {
  id: string
  /** Prototype time, "2026-08-17 09:00". */
  at: string
  actorName: string
  action: string
  details: string
  effectiveFrom: string | null
  groupId: string | null
}
