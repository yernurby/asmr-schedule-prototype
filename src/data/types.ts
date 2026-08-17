// Domain types for the prototype.
//
// These mirror the entities that already exist in ASMR (see docs/existing-screens.md).
// Entities introduced by the schedule module (subjects, lessons, attendance,
// substitutions) are NOT here yet — they arrive with parts 1..6.

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
 * One row of the group's schedule as ASMR stores it today: a weekday and a time
 * range, nothing more. No subject, no teacher, no lessons behind it.
 * Part 1 and part 2 of the module change exactly this.
 */
export interface ScheduleRow {
  weekday: Weekday
  startTime: string // "17:00"
  endTime: string // "18:30"
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
  teacherIds: string[]
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
  courses: Course[]
  staff: Staff[]
  students: Student[]
  groups: Group[]
  enrollments: Enrollment[]
  payroll: PayrollRow[]
}
