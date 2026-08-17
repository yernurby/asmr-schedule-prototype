import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import seed from '../data/seed.json'
import type {
  Course,
  Enrollment,
  Group,
  PayrollRow,
  SeedData,
  Staff,
  Student,
} from '../data/types'

const SEED = seed as unknown as SeedData

/**
 * All domain data lives here and is mirrored into localStorage.
 *
 * Rule for the schedule module: every part adds its own slice to this store
 * (subjects, lessons, attendance, …) and bumps `seedVersion` in
 * scripts/generate-seed.mjs, so existing browsers pick the new shape up.
 */
export interface DataState {
  seedVersion: number
  courses: Course[]
  staff: Staff[]
  students: Student[]
  groups: Group[]
  enrollments: Enrollment[]
  payroll: PayrollRow[]
  /** Drops everything and re-applies the shipped seed. */
  reset: () => void
}

const fromSeed = () => ({
  seedVersion: SEED.seedVersion,
  courses: SEED.courses,
  staff: SEED.staff,
  students: SEED.students,
  groups: SEED.groups,
  enrollments: SEED.enrollments,
  payroll: SEED.payroll,
})

export const DATA_STORAGE_KEY = 'asmr-schedule-prototype:data'

export const useDataStore = create<DataState>()(
  persist(
    (set) => ({
      ...fromSeed(),
      reset: () => set(fromSeed()),
    }),
    {
      name: DATA_STORAGE_KEY,
      version: SEED.seedVersion,
      // A new seed version always wins over whatever is in localStorage.
      migrate: () => fromSeed(),
    },
  ),
)

// ------------------------------------------------------------------ selectors

export const selectCourseById = (id: string) => (s: DataState) =>
  s.courses.find((c) => c.id === id)

export const selectGroupById = (id: string) => (s: DataState) =>
  s.groups.find((g) => g.id === id)

export const selectStaffById = (id: string) => (s: DataState) =>
  s.staff.find((p) => p.id === id)

export function staffNames(all: Staff[], ids: string[]): string[] {
  return ids
    .map((id) => all.find((p) => p.id === id)?.fullName)
    .filter((n): n is string => Boolean(n))
}

export function groupStudentCount(enrollments: Enrollment[], groupId: string): number {
  return enrollments.filter((e) => e.groupId === groupId && e.status === 'active').length
}

export function groupStudents(
  students: Student[],
  enrollments: Enrollment[],
  groupId: string,
): Student[] {
  const ids = new Set(
    enrollments.filter((e) => e.groupId === groupId).map((e) => e.studentId),
  )
  return students.filter((s) => ids.has(s.id))
}
