import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import seed from '../data/seed.json'
import type {
  AuditEntry,
  Course,
  Enrollment,
  Group,
  Lesson,
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
  lessons: Lesson[]
  auditLog: AuditEntry[]
  frozenMonths: string[]

  // ---- lessons (part 2)
  /** §17 — cancel one lesson with a reason the teacher will see. */
  cancelLesson: (lessonId: string, reason: string, actor: string, at: string) => void
  /** §21 — put a cancelled lesson back to "Запланировано". */
  restoreLesson: (lessonId: string, actor: string, at: string) => void
  /** §4 — the director confirms the lesson happened even without attendance. */
  markLessonManual: (lessonId: string, actor: string, at: string) => void
  /** §18 — cancel everything in a date range, optionally narrowed by course or group. */
  bulkCancelLessons: (
    ids: string[],
    reason: string,
    actor: string,
    at: string,
    summary: string,
  ) => void
  /** §7–§10 — a standalone lesson, possibly repeating, possibly for many groups. */
  addLessons: (lessons: Lesson[], actor: string, at: string, summary: string) => void
  /** §28 — a group joins an existing series from a given date onwards. */
  addGroupToSeries: (
    seriesId: string,
    groupId: string,
    from: string,
    actor: string,
    at: string,
  ) => void
  /** §22–§26 — replace the schedule from a date, keeping everything before it. */
  applyScheduleChange: (
    groupId: string,
    nextSchedule: ScheduleRow[],
    effectiveFrom: string,
    deleteIds: string[],
    created: Lesson[],
    actor: string,
    at: string,
    summary: string,
  ) => void
  /** §31–§32 — fill in subjects and teachers that can be inferred. */
  applyMigration: (patched: Group[], created: Lesson[], actor: string, at: string) => void
  /** §24 — the payroll month that a schedule change may not reach into. */
  setMonthFrozen: (month: string, frozen: boolean) => void
  logAudit: (entry: Omit<AuditEntry, 'id'>) => void

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
  addGroup: (group: Group) => void

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
  lessons: SEED.lessons,
  auditLog: SEED.auditLog,
  frozenMonths: SEED.frozenMonths,
})

export const DATA_STORAGE_KEY = 'asmr-schedule-prototype:data'

export const useDataStore = create<DataState>()(
  persist(
    (set) => ({
      ...fromSeed(),

      logAudit: (entry) =>
        set((state) => ({
          auditLog: [
            {
              ...entry,
              id: nextId(
                'a-',
                state.auditLog.map((e) => e.id),
              ),
            },
            ...state.auditLog,
          ],
        })),

      cancelLesson: (lessonId, reason, actor, at) =>
        set((state) => {
          const lesson = state.lessons.find((l) => l.id === lessonId)
          return {
            lessons: state.lessons.map((l) =>
              l.id === lessonId
                ? { ...l, state: 'cancelled' as const, cancelReason: reason }
                : l,
            ),
            auditLog: prependAudit(state.auditLog, {
              at,
              actorName: actor,
              action: 'Отмена занятия',
              details: lesson
                ? `${lesson.date} ${lesson.startTime}–${lesson.endTime}. Причина: ${reason}`
                : reason,
              effectiveFrom: null,
              groupId: lesson?.groupIds[0] ?? null,
            }),
          }
        }),

      restoreLesson: (lessonId, actor, at) =>
        set((state) => {
          const lesson = state.lessons.find((l) => l.id === lessonId)
          return {
            lessons: state.lessons.map((l) =>
              l.id === lessonId
                ? { ...l, state: 'planned' as const, cancelReason: null }
                : l,
            ),
            auditLog: prependAudit(state.auditLog, {
              at,
              actorName: actor,
              action: 'Возврат занятия',
              details: lesson ? `${lesson.date} ${lesson.startTime}–${lesson.endTime}` : '',
              effectiveFrom: null,
              groupId: lesson?.groupIds[0] ?? null,
            }),
          }
        }),

      markLessonManual: (lessonId, actor, at) =>
        set((state) => {
          const lesson = state.lessons.find((l) => l.id === lessonId)
          return {
            lessons: state.lessons.map((l) =>
              l.id === lessonId ? { ...l, state: 'manual' as const } : l,
            ),
            auditLog: prependAudit(state.auditLog, {
              at,
              actorName: actor,
              action: 'Засчитано вручную',
              details: lesson ? `${lesson.date} ${lesson.startTime}–${lesson.endTime}` : '',
              effectiveFrom: null,
              groupId: lesson?.groupIds[0] ?? null,
            }),
          }
        }),

      bulkCancelLessons: (ids, reason, actor, at, summary) =>
        set((state) => ({
          lessons: state.lessons.map((l) =>
            ids.includes(l.id)
              ? { ...l, state: 'cancelled' as const, cancelReason: reason }
              : l,
          ),
          auditLog: prependAudit(state.auditLog, {
            at,
            actorName: actor,
            action: 'Массовая отмена занятий',
            details: `${summary}. Причина: ${reason}`,
            effectiveFrom: null,
            groupId: null,
          }),
        })),

      addLessons: (created, actor, at, summary) =>
        set((state) => ({
          lessons: [...state.lessons, ...created],
          auditLog: prependAudit(state.auditLog, {
            at,
            actorName: actor,
            action: 'Создано общее занятие',
            details: summary,
            effectiveFrom: null,
            groupId: null,
          }),
        })),

      addGroupToSeries: (seriesId, groupId, from, actor, at) =>
        set((state) => {
          // §28 — the group only appears in lessons dated on or after `from`,
          // so nobody retroactively acquires absences.
          let touched = 0
          const lessons = state.lessons.map((l) => {
            if (l.seriesId !== seriesId || l.date < from) return l
            if (l.groupIds.includes(groupId)) return l
            touched += 1
            return { ...l, groupIds: [...l.groupIds, groupId] }
          })
          return {
            lessons,
            auditLog: prependAudit(state.auditLog, {
              at,
              actorName: actor,
              action: 'Группа добавлена в общее занятие',
              details: `Затронуто занятий: ${touched}`,
              effectiveFrom: from,
              groupId,
            }),
          }
        }),

      applyScheduleChange: (
        groupId,
        nextSchedule,
        effectiveFrom,
        deleteIds,
        created,
        actor,
        at,
        summary,
      ) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, schedule: nextSchedule } : g,
          ),
          lessons: [...state.lessons.filter((l) => !deleteIds.includes(l.id)), ...created],
          auditLog: prependAudit(state.auditLog, {
            at,
            actorName: actor,
            action: 'Изменение расписания',
            details: summary,
            effectiveFrom,
            groupId,
          }),
        })),

      applyMigration: (patched, created, actor, at) =>
        set((state) => ({
          groups: patched,
          lessons: [...state.lessons, ...created],
          auditLog: prependAudit(state.auditLog, {
            at,
            actorName: actor,
            action: 'Перенос данных',
            details: `Проставлены предметы и преподаватели, создано занятий: ${created.length}`,
            effectiveFrom: null,
            groupId: null,
          }),
        })),

      setMonthFrozen: (month, frozen) =>
        set((state) => ({
          frozenMonths: frozen
            ? [...new Set([...state.frozenMonths, month])]
            : state.frozenMonths.filter((m) => m !== month),
        })),

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

      addGroup: (group) => set((state) => ({ groups: [...state.groups, group] })),

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

/** Id for a group that is being composed in the form but not saved yet. */
export function nextGroupId(groups: Group[]): string {
  return nextId(
    'g-new-',
    groups.map((g) => g.id),
  )
}

/** Prepends a journal entry, giving it the next id. */
function prependAudit(log: AuditEntry[], entry: Omit<AuditEntry, 'id'>): AuditEntry[] {
  return [{ ...entry, id: nextId('a-', log.map((e) => e.id)) }, ...log]
}

/** Ids for lessons created in the browser, unique against those already stored. */
export function makeLessonIdFactory(existing: Lesson[]): () => string {
  const taken = new Set(existing.map((l) => l.id))
  let n = existing.length
  return () => {
    let id = `l-new-${++n}`
    while (taken.has(id)) id = `l-new-${++n}`
    taken.add(id)
    return id
  }
}
