import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import seed from '../data/seed.json'
import { codeFor } from '../lib/attendance'
import type {
  AuditEntry,
  Availability,
  AttendanceClaim,
  AttendanceMark,
  AttendanceSession,
  AttendanceSource,
  Course,
  Enrollment,
  Group,
  Lesson,
  PayrollRow,
  LimitSettings,
  ReshuffleRequest,
  ScheduleEvent,
  ScheduleRow,
  SeedData,
  Staff,
  Student,
  Subject,
  Verdict,
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
  attendance: AttendanceMark[]
  attendanceSessions: AttendanceSession[]
  attendanceClaims: AttendanceClaim[]
  availability: Availability[]
  reshuffleRequests: ReshuffleRequest[]
  scheduleEvents: ScheduleEvent[]
  limits: LimitSettings

  // ---- substitutions and transfers (part 5)
  /** §1–§4 — files the request; the lesson only moves once it is accepted. */
  requestSubstitution: (event: ScheduleEvent) => void
  /** §5, §7 — the stand-in agrees (the lesson changes hands) or refuses. */
  answerSubstitution: (eventId: string, accept: boolean, at: string) => void
  /** §14–§17 — applies a transfer or a same-day shift to the lesson. */
  applyTransfer: (event: ScheduleEvent) => void
  /** §10–§11 — the explanation, filed later. */
  setEventReason: (
    eventId: string,
    reason: string,
    category: string,
    fileName: string | null,
  ) => void
  /** §31 — the director's one-click verdict. */
  setEventVerdict: (
    eventId: string,
    verdict: Verdict,
    comment: string,
    by: string,
    at: string,
  ) => void
  /** §23 — limits are settings, not constants. */
  setLimits: (limits: LimitSettings) => void
  auditLog: AuditEntry[]
  frozenMonths: string[]

  // ---- attendance (part 4)
  /** §3 — opening attendance is what marks the lesson as held. */
  openAttendance: (lessonId: string, actor: string, at: string) => void
  /** §5 — rotate the code, keeping the previous one valid for the grace period. */
  rotateAttendanceCode: (lessonId: string) => void
  /** §14 — one click, no dialog. Passing null clears the mark back to default. */
  setAttendanceMark: (mark: AttendanceMark) => void
  clearAttendanceMark: (lessonId: string, studentId: string) => void
  /** §16 — closes the lesson by writing an explicit absence for everyone left. */
  markRestAbsent: (
    lessonId: string,
    studentIds: string[],
    source: AttendanceSource,
    at: string,
  ) => void
  /** §28 — the student says they were there. */
  submitClaim: (lessonId: string, studentId: string, comment: string, at: string) => void
  /** §29 — one click to confirm or reject. */
  resolveClaim: (
    claimId: string,
    approve: boolean,
    source: AttendanceSource,
    at: string,
  ) => void
  /** §34 — the director counts a lesson that nobody marked, with a reason. */
  countLessonManually: (
    lessonId: string,
    reason: string,
    actor: string,
    at: string,
  ) => void

  // ---- availability (part 3)
  /** §1–§3 — replaces the teacher's weekly template wholesale. */
  setAvailability: (teacherId: string, cells: string[]) => void
  /** §6 — the teacher asks for a slot to be moved off them. */
  requestReshuffle: (
    teacherId: string,
    lessonId: string,
    note: string,
    at: string,
  ) => void
  /** The director closes the request once it has been dealt with. */
  dismissReshuffle: (requestId: string) => void

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
  attendance: SEED.attendance,
  attendanceSessions: SEED.attendanceSessions,
  attendanceClaims: SEED.attendanceClaims,
  availability: SEED.availability,
  reshuffleRequests: SEED.reshuffleRequests,
  scheduleEvents: SEED.scheduleEvents,
  limits: SEED.limits,
  auditLog: SEED.auditLog,
  frozenMonths: SEED.frozenMonths,
})

export const DATA_STORAGE_KEY = 'asmr-schedule-prototype:data'

export const useDataStore = create<DataState>()(
  persist(
    (set) => ({
      ...fromSeed(),

      openAttendance: (lessonId, actor, at) =>
        set((state) => {
          const already = state.attendanceSessions.some((s) => s.lessonId === lessonId)
          return {
            // §3 — opening it is the act that means the lesson happened.
            // §4 — reopening changes nothing, work on the list simply continues.
            lessons: state.lessons.map((l) =>
              l.id === lessonId && l.state === 'planned'
                ? { ...l, state: 'held' as const }
                : l,
            ),
            attendanceSessions: already
              ? state.attendanceSessions
              : [
                  ...state.attendanceSessions,
                  {
                    lessonId,
                    openedAt: at,
                    openedBy: actor,
                    code: codeFor(lessonId, 1),
                    previousCode: null,
                    tick: 1,
                  },
                ],
          }
        }),

      rotateAttendanceCode: (lessonId) =>
        set((state) => ({
          attendanceSessions: state.attendanceSessions.map((s) =>
            s.lessonId === lessonId
              ? {
                  ...s,
                  tick: s.tick + 1,
                  previousCode: s.code,
                  code: codeFor(lessonId, s.tick + 1),
                }
              : s,
          ),
        })),

      setAttendanceMark: (mark) =>
        set((state) => ({
          attendance: [
            ...state.attendance.filter(
              (m) => !(m.lessonId === mark.lessonId && m.studentId === mark.studentId),
            ),
            mark,
          ],
        })),

      clearAttendanceMark: (lessonId, studentId) =>
        set((state) => ({
          attendance: state.attendance.filter(
            (m) => !(m.lessonId === lessonId && m.studentId === studentId),
          ),
        })),

      markRestAbsent: (lessonId, studentIds, source, at) =>
        set((state) => {
          const already = new Set(
            state.attendance.filter((m) => m.lessonId === lessonId).map((m) => m.studentId),
          )
          const added = studentIds
            .filter((id) => !already.has(id))
            .map((studentId) => ({
              lessonId,
              studentId,
              status: 'absent' as const,
              source,
              at,
            }))
          return { attendance: [...state.attendance, ...added] }
        }),

      submitClaim: (lessonId, studentId, comment, at) =>
        set((state) => ({
          attendanceClaims: [
            {
              id: nextId(
                'ac-',
                state.attendanceClaims.map((c) => c.id),
              ),
              lessonId,
              studentId,
              comment,
              at,
              status: 'pending' as const,
            },
            ...state.attendanceClaims.filter(
              (c) => !(c.lessonId === lessonId && c.studentId === studentId),
            ),
          ],
        })),

      resolveClaim: (claimId, approve, source, at) =>
        set((state) => {
          const claim = state.attendanceClaims.find((c) => c.id === claimId)
          if (!claim) return {}
          return {
            attendanceClaims: state.attendanceClaims.map((c) =>
              c.id === claimId
                ? { ...c, status: approve ? ('approved' as const) : ('rejected' as const) }
                : c,
            ),
            attendance: approve
              ? [
                  ...state.attendance.filter(
                    (m) =>
                      !(m.lessonId === claim.lessonId && m.studentId === claim.studentId),
                  ),
                  {
                    lessonId: claim.lessonId,
                    studentId: claim.studentId,
                    status: 'present' as const,
                    source,
                    at,
                  },
                ]
              : state.attendance,
          }
        }),

      countLessonManually: (lessonId, reason, actor, at) =>
        set((state) => {
          const lesson = state.lessons.find((l) => l.id === lessonId)
          return {
            lessons: state.lessons.map((l) =>
              l.id === lessonId ? { ...l, state: 'manual' as const } : l,
            ),
            auditLog: prependAudit(state.auditLog, {
              at,
              actorName: actor,
              action: 'Занятие засчитано вручную',
              details: lesson
                ? `${lesson.date} ${lesson.startTime}–${lesson.endTime}. Причина: ${reason}`
                : reason,
              effectiveFrom: null,
              groupId: lesson?.groupIds[0] ?? null,
            }),
          }
        }),

      requestSubstitution: (event) =>
        set((state) => ({ scheduleEvents: [event, ...state.scheduleEvents] })),

      answerSubstitution: (eventId, accept, at) =>
        set((state) => {
          const event = state.scheduleEvents.find((e) => e.id === eventId)
          if (!event) return {}
          return {
            scheduleEvents: state.scheduleEvents.map((e) =>
              e.id === eventId
                ? {
                    ...e,
                    requestStatus: accept ? ('accepted' as const) : ('declined' as const),
                    respondedAt: at,
                  }
                : e,
            ),
            // §5 — the lesson only changes hands on acceptance; §6 keeps the
            // original teacher on the lesson for reporting and payroll.
            lessons: accept
              ? state.lessons.map((l) =>
                  l.id === event.lessonId ? { ...l, teacherId: event.substituteId } : l,
                )
              : state.lessons,
          }
        }),

      applyTransfer: (event) =>
        set((state) => ({
          scheduleEvents: [event, ...state.scheduleEvents],
          lessons: state.lessons.map((l) =>
            l.id === event.lessonId
              ? {
                  ...l,
                  date: event.toDate ?? l.date,
                  startTime: event.toStartTime ?? l.startTime,
                  endTime: event.toEndTime ?? l.endTime,
                }
              : l,
          ),
        })),

      setEventReason: (eventId, reason, category, fileName) =>
        set((state) => ({
          scheduleEvents: state.scheduleEvents.map((e) =>
            e.id === eventId
              ? { ...e, reason, reasonCategory: category, reasonFileName: fileName }
              : e,
          ),
        })),

      setEventVerdict: (eventId, verdict, comment, by, at) =>
        set((state) => {
          const event = state.scheduleEvents.find((e) => e.id === eventId)
          return {
            scheduleEvents: state.scheduleEvents.map((e) =>
              e.id === eventId
                ? { ...e, verdict, verdictComment: comment, verdictBy: by, verdictAt: at }
                : e,
            ),
            auditLog: prependAudit(state.auditLog, {
              at,
              actorName: by,
              action: 'Разметка причины',
              details: event
                ? `${event.type === 'substitution' ? 'Замена' : event.type === 'transfer' ? 'Перенос' : 'Сдвиг'}: ${verdict === 'valid' ? 'уважительная' : verdict === 'invalid' ? 'неуважительная' : 'отложена'}${comment ? `. ${comment}` : ''}`
                : verdict,
              effectiveFrom: null,
              groupId: null,
            }),
          }
        }),

      setLimits: (limits) => set({ limits }),

      setAvailability: (teacherId, cells) =>
        set((state) => ({
          availability: state.availability.some((a) => a.teacherId === teacherId)
            ? state.availability.map((a) =>
                a.teacherId === teacherId ? { ...a, cells } : a,
              )
            : [...state.availability, { teacherId, cells }],
        })),

      requestReshuffle: (teacherId, lessonId, note, at) =>
        set((state) => ({
          reshuffleRequests: [
            {
              id: nextId(
                'rr-',
                state.reshuffleRequests.map((r) => r.id),
              ),
              teacherId,
              lessonId,
              note,
              at,
            },
            ...state.reshuffleRequests.filter(
              (r) => !(r.teacherId === teacherId && r.lessonId === lessonId),
            ),
          ],
        })),

      dismissReshuffle: (requestId) =>
        set((state) => ({
          reshuffleRequests: state.reshuffleRequests.filter((r) => r.id !== requestId),
        })),

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
