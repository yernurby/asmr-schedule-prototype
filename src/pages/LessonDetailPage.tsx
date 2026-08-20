import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader, PartBadge } from '../ui/PageHeader'
import { Button } from '../ui/Button'
import { Card, CardTitle, EmptyState, Notice } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { CancelLessonModal } from '../components/CancelLessonModal'
import { AttendanceRoster } from '../components/AttendanceRoster'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import { hasSubstitution } from '../lib/lessons'
import { formatDateLong, WEEKDAY_LONG, weekdayOf } from '../lib/date'
import { LESSON_STATE_LABEL, LESSON_TYPE_LABEL, type LessonState } from '../data/types'

export const STATE_TONE: Record<LessonState, 'success' | 'warning' | 'neutral' | 'danger'> = {
  planned: 'neutral',
  held: 'success',
  unmarked: 'warning',
  cancelled: 'danger',
  manual: 'warning',
}

/**
 * §15 — the card of a lesson itself. Opening a shared lesson from a group makes
 * it immediately obvious that it belongs to several groups.
 */
export function LessonDetailPage() {
  const { lessonId = '' } = useParams()
  const lessons = useDataStore((s) => s.lessons)
  const groups = useDataStore((s) => s.groups)
  const staff = useDataStore((s) => s.staff)
  const subjects = useDataStore((s) => s.subjects)
  const restoreLesson = useDataStore((s) => s.restoreLesson)
  const markManual = useDataStore((s) => s.markLessonManual)

  const role = useSessionStore((s) => s.role)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)
  const [cancelling, setCancelling] = useState(false)

  const lesson = lessons.find((l) => l.id === lessonId)
  const isDirector = role === 'academ_head'
  const at = `${today} ${time}`

  if (!lesson) {
    return (
      <>
        <PageHeader title="Занятие не найдено" backTo="/lessons" />
        <Card>
          <EmptyState>Такого занятия нет. Возможно, данные были сброшены.</EmptyState>
        </Card>
      </>
    )
  }

  const subject = subjects.find((s) => s.id === lesson.subjectId)
  const teacher = staff.find((p) => p.id === lesson.teacherId)
  const original = staff.find((p) => p.id === lesson.originalTeacherId)
  const lessonGroups = groups.filter((g) => lesson.groupIds.includes(g.id))
  const substituted = hasSubstitution(lesson)

  return (
    <>
      <PartBadge part={2} />

      <PageHeader
        title={lesson.title ?? `${subject?.title ?? 'Занятие'} · ${formatDateLong(lesson.date)}`}
        subtitle={`${WEEKDAY_LONG[weekdayOf(lesson.date)]}, ${lesson.startTime}–${lesson.endTime}`}
        backTo="/lessons"
        actions={
          isDirector ? (
            <>
              {lesson.state === 'cancelled' ? (
                <Button variant="success" onClick={() => restoreLesson(lesson.id, 'Академ Хэд', at)}>
                  Вернуть занятие
                </Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => markManual(lesson.id, 'Академ Хэд', at)}>
                    Засчитать вручную
                  </Button>
                  <Button variant="danger" onClick={() => setCancelling(true)}>
                    Отменить
                  </Button>
                </>
              )}
            </>
          ) : undefined
        }
      />

      {lesson.state === 'cancelled' && lesson.cancelReason ? (
        <div className="mb-4">
          <Notice tone="neutral">
            Занятие отменено. Причина: {lesson.cancelReason}
          </Notice>
        </div>
      ) : null}

      <Card className="mb-4">
        <CardTitle>Занятие</CardTitle>
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-3">
          <Detail label="Состояние" value={<Pill tone={STATE_TONE[lesson.state]}>{LESSON_STATE_LABEL[lesson.state]}</Pill>} />
          <Detail label="Тип" value={LESSON_TYPE_LABEL[lesson.type]} />
          <Detail label="Предмет" value={subject?.title ?? '—'} />
          <Detail label="Дата" value={formatDateLong(lesson.date)} />
          <Detail label="Время" value={`${lesson.startTime}–${lesson.endTime}`} />
          <Detail
            label="Преподаватель"
            value={
              <>
                {teacher?.fullName ?? <span className="text-slate-400">не назначен</span>}
                {substituted ? (
                  <div className="mt-1 text-xs text-amber-700">
                    Замена. Изначально: {original?.fullName ?? '—'}
                  </div>
                ) : null}
              </>
            }
          />
          {lesson.meetUrl ? (
            <Detail
              label="Meet"
              value={
                <a href={lesson.meetUrl} target="_blank" rel="noreferrer" className="text-slate-700 underline underline-offset-2">
                  {lesson.meetUrl}
                </a>
              }
            />
          ) : null}
        </div>
      </Card>

      <Card className="mb-4">
        <CardTitle>Посещаемость</CardTitle>
        <AttendanceRoster lesson={lesson} />
      </Card>

      <Card>
        <CardTitle hint={lesson.sourceRowId ? 'Из расписания группы' : 'Общее занятие'}>
          Группы ({lessonGroups.length})
        </CardTitle>
        {lessonGroups.length > 1 ? (
          <div className="mb-3">
            <Notice tone="info">
              Занятие идёт сразу на {lessonGroups.length} групп. Изменение здесь
              затронет их все.
            </Notice>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {lessonGroups.map((g) => (
            <Link
              key={g.id}
              to={`/groups/${g.id}`}
              className="rounded-card border border-line px-3 py-1.5 text-sm text-slate-700 hover:bg-page"
            >
              {g.title}
            </Link>
          ))}
        </div>
      </Card>

      {cancelling ? (
        <CancelLessonModal lesson={lesson} onClose={() => setCancelling(false)} />
      ) : null}
    </>
  )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-sm text-slate-500">{label}</div>
      <div className="text-sm text-slate-800">{value}</div>
    </div>
  )
}
