import { useMemo, useState } from 'react'
import { PageHeader, PartBadge } from '../ui/PageHeader'
import { Button } from '../ui/Button'
import { Card, CardTitle, EmptyState, Notice } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { TextInput } from '../ui/Field'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import {
  attendanceWindow,
  canClaim,
  effectiveState,
  stamp,
  statusForScan,
  STATUS_LABEL,
} from '../lib/attendance'
import { formatDate, WEEKDAY_SHORT, weekdayOf } from '../lib/date'
import { LESSON_STATE_LABEL } from '../data/types'

/**
 * §9, §28–§30 — the student side: one tap to mark attendance while the lesson is
 * open, and a claim with a comment for the 48 hours after it.
 */
export function StudentPortalPage() {
  const students = useDataStore((s) => s.students)
  const lessons = useDataStore((s) => s.lessons)
  const groups = useDataStore((s) => s.groups)
  const subjects = useDataStore((s) => s.subjects)
  const enrollments = useDataStore((s) => s.enrollments)
  const attendance = useDataStore((s) => s.attendance)
  const sessions = useDataStore((s) => s.attendanceSessions)
  const claims = useDataStore((s) => s.attendanceClaims)
  const setMark = useDataStore((s) => s.setAttendanceMark)
  const submitClaim = useDataStore((s) => s.submitClaim)

  const actorId = useSessionStore((s) => s.actorId)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)
  const now = stamp(today, time)
  const at = `${today} ${time}`

  const [claimFor, setClaimFor] = useState<string | null>(null)
  const [comment, setComment] = useState('')

  const student = students.find((s) => s.id === actorId)

  const myLessons = useMemo(() => {
    if (!actorId) return []
    const myGroups = new Set(
      enrollments.filter((e) => e.studentId === actorId).map((e) => e.groupId),
    )
    return lessons
      .filter((l) => l.groupIds.some((id) => myGroups.has(id)))
      .filter((l) => l.date >= today || canClaim(l, now))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
      .slice(0, 12)
  }, [actorId, enrollments, lessons, today, now])

  const markOf = (lessonId: string) =>
    attendance.find((m) => m.lessonId === lessonId && m.studentId === actorId)

  return (
    <>
      <PartBadge part={4} />

      <PageHeader
        title={student?.fullName ?? 'Портал студента'}
        subtitle="Ближайшие занятия, отметка о присутствии и заявки."
      />

      {myLessons.length === 0 ? (
        <Card>
          <EmptyState>Занятий не найдено.</EmptyState>
        </Card>
      ) : (
        <div className="space-y-3">
          {myLessons.map((lesson) => {
            const state = effectiveState(lesson, now)
            const session = sessions.find((s) => s.lessonId === lesson.id)
            const win = attendanceWindow(lesson, now)
            const mark = markOf(lesson.id)
            const claim = claims.find(
              (c) => c.lessonId === lesson.id && c.studentId === actorId,
            )
            const canMark = Boolean(session) && win.open && !mark
            return (
              <Card key={lesson.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {lesson.title ??
                        subjects.find((s) => s.id === lesson.subjectId)?.title ??
                        'Занятие'}
                    </div>
                    <div className="mt-0.5 text-sm text-slate-500">
                      {WEEKDAY_SHORT[weekdayOf(lesson.date)]} {formatDate(lesson.date)},{' '}
                      {lesson.startTime}–{lesson.endTime} ·{' '}
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

                    {!mark && !canMark && canClaim(lesson, now) && !claim ? (
                      <Button variant="secondary" onClick={() => setClaimFor(lesson.id)}>
                        Я был на уроке
                      </Button>
                    ) : null}

                    {claim ? (
                      <Pill
                        tone={
                          claim.status === 'approved'
                            ? 'success'
                            : claim.status === 'rejected'
                              ? 'neutral'
                              : 'warning'
                        }
                      >
                        {claim.status === 'pending'
                          ? 'Заявка на рассмотрении'
                          : claim.status === 'approved'
                            ? 'Заявка подтверждена'
                            : 'Заявка отклонена'}
                      </Pill>
                    ) : null}
                  </div>
                </div>

                {claimFor === lesson.id ? (
                  <div className="mt-3 border-t border-line pt-3">
                    <CardTitle>Заявка о присутствии</CardTitle>
                    <TextInput
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Например: не успел отсканировать QR"
                      autoFocus
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="primary"
                        disabled={comment.trim().length === 0}
                        onClick={() => {
                          submitClaim(lesson.id, actorId!, comment.trim(), at)
                          setComment('')
                          setClaimFor(null)
                        }}
                      >
                        Отправить
                      </Button>
                      <Button variant="secondary" onClick={() => setClaimFor(null)}>
                        Отмена
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Заявку рассматривает куратор. Подать её можно в течение 48 часов
                      после урока.
                    </p>
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}

      <div className="mt-4">
        <Notice tone="info">
          Отметиться можно тремя способами: сканом QR с ноутбука, вводом кода или
          кнопкой «Я на уроке» здесь — если вы уже вошли в АСМР, достаточно одного
          нажатия.
        </Notice>
      </div>
    </>
  )
}
