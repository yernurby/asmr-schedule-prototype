import { useMemo } from 'react'
import { PageHeader, PartBadge } from '../ui/PageHeader'
import { Button } from '../ui/Button'
import { Card, EmptyState, Notice } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import {
  attendanceWindow,
  effectiveState,
  stamp,
  statusForScan,
  STATUS_LABEL,
} from '../lib/attendance'
import { addDays, formatDate, WEEKDAY_SHORT, weekdayOf } from '../lib/date'
import { LESSON_STATE_LABEL } from '../data/types'

/**
 * §9 — the student side: one tap while the lesson is open.
 *
 * There is no "я был на уроке" claim any more. A student who missed the scan is
 * simply marked by the curator, who has no deadline — that turned out to be
 * fewer moving parts than a queue of claims somebody has to triage.
 */
export function StudentPortalPage() {
  const students = useDataStore((s) => s.students)
  const lessons = useDataStore((s) => s.lessons)
  const groups = useDataStore((s) => s.groups)
  const subjects = useDataStore((s) => s.subjects)
  const enrollments = useDataStore((s) => s.enrollments)
  const attendance = useDataStore((s) => s.attendance)
  const sessions = useDataStore((s) => s.attendanceSessions)
  const setMark = useDataStore((s) => s.setAttendanceMark)

  const actorId = useSessionStore((s) => s.actorId)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)
  const now = stamp(today, time)
  const at = `${today} ${time}`

  const student = students.find((s) => s.id === actorId)

  const myLessons = useMemo(() => {
    if (!actorId) return []
    const myGroups = new Set(
      enrollments.filter((e) => e.studentId === actorId).map((e) => e.groupId),
    )
    const from = addDays(today, -7)
    return lessons
      .filter((l) => l.groupIds.some((id) => myGroups.has(id)))
      .filter((l) => l.date >= from)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
      .slice(0, 14)
  }, [actorId, enrollments, lessons, today])

  const markOf = (lessonId: string) =>
    attendance.find((m) => m.lessonId === lessonId && m.studentId === actorId)

  return (
    <>
      <PartBadge part={4} />

      <PageHeader
        title={student?.fullName ?? 'Портал студента'}
        subtitle="Ближайшие занятия и отметка о присутствии."
      />

      <div className="mb-4">
        <Notice tone="info">
          Отметиться можно, пока идёт занятие — одним нажатием, без ввода почты и
          пароля. Если не успели, скажите куратору: он проставит отметку сам.
        </Notice>
      </div>

      {myLessons.length === 0 ? (
        <Card>
          <EmptyState>Занятий не найдено.</EmptyState>
        </Card>
      ) : (
        <div className="space-y-2">
          {myLessons.map((lesson) => {
            const state = effectiveState(lesson, now)
            const mark = markOf(lesson.id)
            const open = attendanceWindow(lesson, now).open
            const session = sessions.some((s) => s.lessonId === lesson.id)
            const canMark = open && session && !mark
            return (
              <Card key={lesson.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {WEEKDAY_SHORT[weekdayOf(lesson.date)]} {formatDate(lesson.date)},{' '}
                      {lesson.startTime}–{lesson.endTime}
                    </div>
                    <div className="mt-0.5 text-sm text-slate-600">
                      {lesson.title ??
                        subjects.find((s) => s.id === lesson.subjectId)?.title ??
                        'Занятие'}{' '}
                      ·{' '}
                      {lesson.groupIds
                        .map((id) => groups.find((g) => g.id === id)?.title ?? id)
                        .join(', ')}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Pill
                      tone={
                        state === 'held'
                          ? 'success'
                          : state === 'unmarked'
                            ? 'danger'
                            : 'neutral'
                      }
                    >
                      {LESSON_STATE_LABEL[state]}
                    </Pill>

                    {mark ? (
                      <Pill
                        tone={
                          mark.status === 'present'
                            ? 'success'
                            : mark.status === 'late'
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        {STATUS_LABEL[mark.status]}
                      </Pill>
                    ) : null}

                    {canMark ? (
                      <Button
                        variant="primary"
                        onClick={() =>
                          setMark({
                            lessonId: lesson.id,
                            studentId: actorId!,
                            status: statusForScan(lesson, now),
                            source: 'qr',
                            at,
                          })
                        }
                      >
                        Я на уроке
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
