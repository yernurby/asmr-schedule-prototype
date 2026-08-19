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
  /** §10 — default rate from the staff card, pre-filled into new payroll lines. */
  defaultRate?: number
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
  /**
   * The hand-typed numbers the old screen used. Part 6 keeps them only so the
   * two calculations can be shown side by side while the switch is verified.
   */
  lines: PayrollGroupLine[]
  /** §10, §20 — rate per computed line key, entered by the director and never reset. */
  rates: Record<string, number>
  /** Lines seen at the last sync, so §20 can point out what is new. */
  knownKeys: string[]
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
  attendance: AttendanceMark[]
  attendanceSessions: AttendanceSession[]
  attendanceClaims: AttendanceClaim[]
  availability: Availability[]
  reshuffleRequests: ReshuffleRequest[]
  scheduleEvents: ScheduleEvent[]
  limits: LimitSettings
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

// ---------------------------------------------------------------------------
// Part 3 (docs/03-календари-и-нагрузка.md): calendars, availability, workload.
// ---------------------------------------------------------------------------

/**
 * §1–§3 — a weekly template, no dates. Stored as 30-minute cells keyed
 * `"<weekday>-<HH:MM>"`, which is what drag-painting produces and what the grid
 * draws as a background.
 *
 * §4 — this restricts nothing. It is a statement of intent, and part 5 is the
 * first place it becomes a hard rule.
 */
export interface Availability {
  teacherId: string
  cells: string[]
}

/** Minutes per availability cell and per grid row (§2, §9). */
export const SLOT_MINUTES = 30

/** §6 — "снимите с меня понедельники", expressed as an action instead of a chat message. */
export interface ReshuffleRequest {
  id: string
  teacherId: string
  lessonId: string
  at: string
  note: string
}

// ---------------------------------------------------------------------------
// Part 4 (docs/04-посещаемость.md): attendance.
// ---------------------------------------------------------------------------

/** §12 — absent is the default, so only presence is ever stored explicitly. */
export type AttendanceStatus = 'present' | 'late' | 'absent'

/** §18 — where a mark came from; a rising share of manual marks means QR is failing. */
export type AttendanceSource = 'qr' | 'teacher' | 'curator' | 'director' | 'student_request'

export interface AttendanceMark {
  lessonId: string
  studentId: string
  status: AttendanceStatus
  source: AttendanceSource
  /** Prototype timestamp, "2026-08-17 17:05". */
  at: string
  /** §20 — scanned in but not enrolled in any group of this lesson. */
  outsideGroup?: boolean
}

/**
 * §3 — opening attendance is the single act that means "the lesson happened".
 * The rotating code lives here too (§5): `codeIssuedAt` is the tick the current
 * code was minted on, and the previous one stays valid for a grace period.
 */
export interface AttendanceSession {
  lessonId: string
  openedAt: string
  openedBy: string
  /** Six-digit code shown next to the QR (§6). */
  code: string
  previousCode: string | null
  /** Rotation tick, incremented every 30 seconds while the screen is open. */
  tick: number
}

export type ClaimStatus = 'pending' | 'approved' | 'rejected'

/** §28–§30 — "я был на уроке" from the student, with a comment. */
export interface AttendanceClaim {
  id: string
  lessonId: string
  studentId: string
  comment: string
  at: string
  status: ClaimStatus
}

/** Minutes the "Провести занятие" button is live before the start (§2). */
export const ATTENDANCE_OPEN_BEFORE = 10
/** Minutes it stays live after the end (§2). */
export const ATTENDANCE_OPEN_AFTER = 15
/** A scan after this many minutes from the start counts as late (§19). */
export const LATE_AFTER_MINUTES = 15
/** Hours after which attendance freezes for everyone but the director (§26). */
export const ATTENDANCE_EDIT_HOURS = 48
/** Hours after the end before the director is notified about an unmarked lesson (§33). */
export const UNMARKED_NOTICE_HOURS = 3

// ---------------------------------------------------------------------------
// Part 5 (docs/05-замены-и-переносы.md): substitutions, transfers, registry.
// ---------------------------------------------------------------------------

/** §19 — a move inside the same calendar day is a shift and never counts (§20). */
export type ScheduleEventType = 'substitution' | 'transfer' | 'shift'

/** §4, §7–§9 — a substitution only takes effect once the stand-in agrees. */
export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'escalated' | 'cancelled'

/** §31 — the director's verdict; `deferred` puts it back in the queue. */
export type Verdict = 'valid' | 'invalid' | 'deferred'

export interface ScheduleEvent {
  id: string
  type: ScheduleEventType
  lessonId: string
  /** Who asked for it — the teacher the lesson belonged to. */
  initiatorId: string
  createdAt: string

  // ---- substitution
  substituteId: string | null
  requestStatus: RequestStatus | null
  respondedAt: string | null
  /** §26 — created past the limit, so it needs the director to sign it off. */
  overLimit?: boolean

  // ---- transfer / shift
  fromDate: string | null
  fromStartTime: string | null
  fromEndTime: string | null
  toDate: string | null
  toStartTime: string | null
  toEndTime: string | null
  /** §16 — moved less than a day ahead, so the director confirms. */
  needsApproval?: boolean
  approvalStatus?: 'pending' | 'approved' | 'rejected'

  // ---- reason (§10–§13, §17)
  reason: string | null
  reasonCategory: string | null
  reasonFileName: string | null
  /** Deadline for the explanation; after it a missing reason turns invalid. */
  reasonDueAt: string

  // ---- director's marking (§31)
  verdict: Verdict | null
  verdictComment: string | null
  verdictBy: string | null
  verdictAt: string | null
}

/** §23 — configurable in the interface, never hard-coded. */
export interface LimitSettings {
  substitutionsPerMonth: number
  transfersPerMonth: number
}

/** §38 — the preset causes, so the distribution chart has stable buckets. */
export const REASON_CATEGORIES = [
  'Болезнь',
  'Накладка по расписанию',
  'Семейные обстоятельства',
  'Форс-мажор',
  'Другое',
] as const

/** Hours to explain a substitution or transfer before it turns invalid (§12). */
export const REASON_DEADLINE_HOURS = 48
/** Hours a stand-in has to answer before the request escalates (§8). */
export const REQUEST_TIMEOUT_HOURS = 2
/** Shortened timeout when the lesson is less than two hours away (§9). */
export const REQUEST_TIMEOUT_SHORT_MINUTES = 30
/** Less than this many hours before the lesson, a transfer needs approval (§16). */
export const TRANSFER_APPROVAL_HOURS = 24

export const EVENT_TYPE_LABEL: Record<ScheduleEventType, string> = {
  substitution: 'Замена',
  transfer: 'Перенос',
  shift: 'Сдвиг',
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  valid: 'Уважительная',
  invalid: 'Неуважительная',
  deferred: 'Отложена',
}

// ---------------------------------------------------------------------------
// Part 6 (docs/06-зарплата-по-факту.md): payroll from actual lessons.
// ---------------------------------------------------------------------------

/** §5 — three kinds of line on a teacher's sheet. */
export type PayrollLineKind = 'group' | 'shared' | 'substitution'

/**
 * A computed line. Nothing here is stored: counts come from the lessons every
 * time, which is the whole point of part 6. Only the rate is kept, keyed by
 * `key`, so a re-sync never wipes what the director typed (§20).
 */
export interface PayrollLine {
  key: string
  kind: PayrollLineKind
  title: string
  subtitle: string | null
  /** §7 — group names under a shared lesson. */
  groupTitles: string[]
  /** §9 — who and when a substitution was covered for. */
  details: string[]
  lessons1h: number
  lessons15h: number
  ratePerHour: number
  total: number
}
