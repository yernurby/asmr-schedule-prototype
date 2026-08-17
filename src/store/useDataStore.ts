import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import seed from '../data/seed.json'
import type {
  Course,
  Enrollment,
  Group,
  PayrollRow,
  ScheduleRow,
  SeedData,
  Staff,
  Student,
  Subject,
} from '../data/types'

const SEED = seed as unknown as SeedData

/** Sequential id with a prefix, unique against the ids already in use. */
function nextId(prefix: string, taken: string[]): string {
  let n = taken.length + 1
  let id = `${prefix}${n}`
  while (taken.includes(id)) {
    n += 1
    id = `${prefix}${n}`
  }
  return id
}

/**
 * Part 1, §17 — every course must own at least one subject. Courses that have
 * none get one named after the course. This is the migration for data created
 * before part 1, and a safety net for courses added through any other path.
 */
function ensureCourseSubjects(courses: Course[], subjects: Subject[]): Subject[] {
  const result = [...subjects]
  for (const course of courses) {
    const live = result.filter((s) => s.courseId === course.id && !s.isArchived)
    if (live.length === 0) {
      result.push({
        id: nextId(
          'sub-new-',
          result.map((s) => s.id),
        ),
        courseId: course.id,
        title: course.title,
        isArchived: false,
      })
    }
  }
  return result
}

/**
 * All domain data lives here and is mirrored into localStorage.
 *
 * Rule for the schedule module: every part adds its own slice to this store
 * (lessons, attendance, …) and bumps `seedVersion` in
 * scripts/generate-seed.mjs, so existing browsers pick the new shape up.
 */
export interface DataState {
  seedVersion: number
  courses: Course[]
  subjects: Subject[]
  staff: Staff[]
  students: Student[]
  groups: Group[]
  enrollments: Enrollment[]
  payroll: PayrollRow[]

  // ---- courses and subjects (part 1)
  /** Creates a course together with its subjects; §4 guarantees at least one. */
  createCourse: (title: string, subjectTitles: string[]) => void
  renameCourse: (courseId: string, title: string) => void
  setCourseActive: (courseId: string, isActive: boolean) => void
  addSubject: (courseId: string, title: string) => void
  renameSubject: (subjectId: string, title: string) => void
  setSubjectArchived: (subjectId: string, isArchived: boolean) => void
  deleteSubject: (subjectId: string) => void

  // ---- staff (part 1, §6)
  setStaffSubjects: (staffId: string, subjectIds: string[]) => void

  // ---- groups (part 1, §8–§12)
  saveGroupSchedule: (groupId: string, schedule: ScheduleRow[]) => void
  updateGroup: (groupId: string, patch: Partial<Omit<Group, 'id'>>) => void

  /** Drops everything and re-applies the shipped seed. */
  reset: () => void
}

const fromSeed = () => ({
  seedVersion: SEED.seedVersion,
  courses: SEED.courses,
  subjects: ensureCourseSubjects(SEED.courses, SEED.subjects),
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

      createCourse: (title, subjectTitles) =>
        set((state) => {
          const courseId = nextId(
            'c-new-',
            state.courses.map((c) => c.id),
          )
          const course: Course = { id: courseId, title, isActive: true }
          // §4: a brand new course always ends up with at least one subject,
          // named after the course when the user did not add any.
          const titles = subjectTitles.filter((t) => t.trim().length > 0)
          const effective = titles.length > 0 ? titles : [title]
          const taken = state.subjects.map((s) => s.id)
          const created: Subject[] = effective.map((t) => {
            const id = nextId('sub-new-', taken)
            taken.push(id)
            return { id, courseId, title: t.trim(), isArchived: false }
          })
          return {
            courses: [...state.courses, course],
            subjects: [...state.subjects, ...created],
          }
        }),

      renameCourse: (courseId, title) =>
        set((state) => ({
          courses: state.courses.map((c) => (c.id === courseId ? { ...c, title } : c)),
        })),

      setCourseActive: (courseId, isActive) =>
        set((state) => ({
          courses: state.courses.map((c) => (c.id === courseId ? { ...c, isActive } : c)),
        })),

      addSubject: (courseId, title) =>
        set((state) => ({
          subjects: [
            ...state.subjects,
            {
              id: nextId(
                'sub-new-',
                state.subjects.map((s) => s.id),
              ),
              courseId,
              title: title.trim(),
              isArchived: false,
            },
          ],
        })),

      renameSubject: (subjectId, title) =>
        set((state) => ({
          subjects: state.subjects.map((s) =>
            s.id === subjectId ? { ...s, title: title.trim() } : s,
          ),
        })),

      setSubjectArchived: (subjectId, isArchived) =>
        set((state) => ({
          subjects: state.subjects.map((s) =>
            s.id === subjectId ? { ...s, isArchived } : s,
          ),
        })),

      deleteSubject: (subjectId) =>
        set((state) => ({
          subjects: state.subjects.filter((s) => s.id !== subjectId),
          // Also drop the subject from teacher cards so no dangling ids remain.
          staff: state.staff.map((p) =>
            p.subjectIds.includes(subjectId)
              ? { ...p, subjectIds: p.subjectIds.filter((id) => id !== subjectId) }
              : p,
          ),
        })),

      setStaffSubjects: (staffId, subjectIds) =>
        set((state) => ({
          staff: state.staff.map((p) => (p.id === staffId ? { ...p, subjectIds } : p)),
        })),

      saveGroupSchedule: (groupId, schedule) =>
        set((state) => ({
          groups: state.groups.map((g) => (g.id === groupId ? { ...g, schedule } : g)),
        })),

      updateGroup: (groupId, patch) =>
        set((state) => ({
          groups: state.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)),
        })),

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

/** Next id for a schedule row inside a group. */
export function nextScheduleRowId(group: Group): string {
  return nextId(
    `sr-${group.id}-`,
    group.schedule.map((r) => r.id),
  )
}
