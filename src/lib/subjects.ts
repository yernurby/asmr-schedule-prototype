import {
  MAX_SUBJECTS_PER_COURSE,
  type Group,
  type Staff,
  type Subject,
} from '../data/types'

export { MAX_SUBJECTS_PER_COURSE }

/** Live subjects of a course, in creation order. */
export function courseSubjects(subjects: Subject[], courseId: string): Subject[] {
  return subjects.filter((s) => s.courseId === courseId && !s.isArchived)
}

/** Every subject of a course, archived ones included. */
export function allCourseSubjects(subjects: Subject[], courseId: string): Subject[] {
  return subjects.filter((s) => s.courseId === courseId)
}

/**
 * A course counts as single-subject when it has exactly one live subject.
 * Those courses must look exactly as they did before part 1: no grouping in the
 * group form (§11), no subject name in the schedule column (§14).
 */
export function isSingleSubject(subjects: Subject[], courseId: string): boolean {
  return courseSubjects(subjects, courseId).length <= 1
}

/** How many groups have schedule rows pinned to this subject. */
export function subjectUsage(groups: Group[], subjectId: string): Group[] {
  return groups.filter((g) => g.schedule.some((row) => row.subjectId === subjectId))
}

export type SubjectBlockReason = 'has-schedule' | 'last-live-subject' | null

/**
 * Why a subject cannot be deleted.
 *
 * §3 — a subject that already carries schedule in any group may only be archived.
 * §4 — a course can never be left with zero subjects, so the last live one stays.
 */
export function deleteBlockedBecause(
  subjects: Subject[],
  groups: Group[],
  subject: Subject,
): SubjectBlockReason {
  if (subjectUsage(groups, subject.id).length > 0) return 'has-schedule'
  if (courseSubjects(subjects, subject.courseId).length <= 1) return 'last-live-subject'
  return null
}

/**
 * Why a subject cannot be archived. Archiving is the escape hatch for subjects
 * that carry schedule, so the only blocker is §4: something must stay live.
 */
export function archiveBlockedBecause(
  subjects: Subject[],
  subject: Subject,
): SubjectBlockReason {
  if (subject.isArchived) return null
  return courseSubjects(subjects, subject.courseId).length <= 1
    ? 'last-live-subject'
    : null
}

export const BLOCK_REASON_TEXT: Record<Exclude<SubjectBlockReason, null>, string> = {
  'has-schedule': 'По предмету уже стоит расписание — можно только заархивировать',
  'last-live-subject': 'У курса не может быть ноль предметов',
}

/** Can another subject be added? The cap counts live subjects only. */
export function canAddSubject(subjects: Subject[], courseId: string): boolean {
  return courseSubjects(subjects, courseId).length < MAX_SUBJECTS_PER_COURSE
}

/**
 * Teachers who have this subject ticked on their card (§10). The group form
 * offers these first and hides the rest behind "показать всех".
 */
export function teachersForSubject(staff: Staff[], subjectId: string): Staff[] {
  return staff.filter(
    (p) => p.roles.includes('teacher') && p.subjectIds.includes(subjectId),
  )
}

export function allTeachers(staff: Staff[]): Staff[] {
  return staff.filter((p) => p.roles.includes('teacher'))
}

/**
 * Teachers of a group, derived from its schedule (§12). Order follows the
 * schedule so the header reads the same way the form does.
 */
export function groupTeacherIds(group: Group): string[] {
  const seen: string[] = []
  for (const row of group.schedule) {
    if (row.teacherId && !seen.includes(row.teacherId)) seen.push(row.teacherId)
  }
  return seen
}

/** Subjects a teacher is actually scheduled for, across all groups. */
export function scheduledSubjectIdsOf(groups: Group[], teacherId: string): string[] {
  const seen: string[] = []
  for (const g of groups) {
    for (const row of g.schedule) {
      if (row.teacherId === teacherId && !seen.includes(row.subjectId)) {
        seen.push(row.subjectId)
      }
    }
  }
  return seen
}
