import { Link } from 'react-router-dom'
import { Card, CardTitle, EmptyState, Notice } from '../ui/Card'
import { Button } from '../ui/Button'
import { Pill } from '../ui/Pill'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import { ownLessons, sharedLessons } from '../lib/lessons'
import { formatDate, WEEKDAY_SHORT, weekdayOf } from '../lib/date'
import { countLabel } from '../lib/format'
import { LESSON_TYPE_LABEL } from '../data/types'

/**
 * §14–§16 — what the group actually has on its plate.
 *
 * The left card counts the lessons generated from the group's own schedule; the
 * right one lists the lessons the group merely takes part in. That second list
 * is read-only on purpose (§15): editing a lecture from one group's card would
 * silently move it for the other four.
 */
export function LessonsBlock({
  groupId,
  canCreateShared,
  onCreateShared,
}: {
  groupId: string
  canCreateShared: boolean
  onCreateShared: () => void
}) {
  const lessons = useDataStore((s) => s.lessons)
  const staff = useDataStore((s) => s.staff)
  const today = useSessionStore((s) => s.today)

  const own = ownLessons(lessons, groupId)
  const shared = sharedLessons(lessons, groupId)
  const upcomingOwn = own.filter((l) => l.date >= today && l.state !== 'cancelled')
  const cancelled = own.filter((l) => l.state === 'cancelled')

  // Group the shared lessons by series so a weekly lecture is one line, not thirty.
  const series = new Map<string, typeof shared>()
  for (const lesson of shared) {
    const key = lesson.seriesId ?? lesson.id
    series.set(key, [...(series.get(key) ?? []), lesson])
  }

  return (
    <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardTitle hint={<Link to={`/lessons?group=${groupId}`} className="underline underline-offset-2">все занятия</Link>}>
          Занятия группы
        </CardTitle>
        {own.length === 0 ? (
          <EmptyState>
            Занятий нет. Они создаются из расписания при сохранении группы.
          </EmptyState>
        ) : (
          <div className="space-y-1 text-sm text-slate-700">
            <div>
              Всего создано: <strong>{own.length}</strong>
            </div>
            <div>
              Впереди: {countLabel(upcomingOwn.length, 'занятие', 'занятия', 'занятий')}
            </div>
            {cancelled.length > 0 ? (
              <div className="text-slate-500">
                Отменено: {cancelled.length}
              </div>
            ) : null}
            {upcomingOwn[0] ? (
              <div className="pt-1 text-slate-500">
                Ближайшее: {WEEKDAY_SHORT[weekdayOf(upcomingOwn[0].date)]}{' '}
                {formatDate(upcomingOwn[0].date)}, {upcomingOwn[0].startTime}–
                {upcomingOwn[0].endTime}
              </div>
            ) : null}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle
          hint={
            canCreateShared ? (
              <Button variant="secondary" onClick={onCreateShared}>
                Создать общее занятие
              </Button>
            ) : undefined
          }
        >
          Общие занятия
        </CardTitle>

        {series.size === 0 ? (
          <EmptyState>
            Группа не участвует в занятиях, созданных вне её расписания.
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {[...series.values()].map((items) => {
              const first = items[0]
              const teacher = staff.find((p) => p.id === first.teacherId)
              const upcoming = items.filter(
                (l) => l.date >= today && l.state !== 'cancelled',
              )
              return (
                <Link
                  key={first.seriesId ?? first.id}
                  to={`/lessons/${(upcoming[0] ?? first).id}`}
                  className="block rounded-card border border-line px-3 py-2 hover:bg-page"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      {first.title ?? 'Занятие'}
                    </span>
                    <Pill tone="neutral">{LESSON_TYPE_LABEL[first.type]}</Pill>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {WEEKDAY_SHORT[weekdayOf(first.date)]} {first.startTime}–
                    {first.endTime} · {teacher?.fullName ?? 'без преподавателя'} ·{' '}
                    {countLabel(first.groupIds.length, 'группа', 'группы', 'групп')}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Впереди {upcoming.length} из {items.length}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {series.size > 0 ? (
          <div className="mt-3">
            <Notice tone="info">
              Только просмотр. Общее занятие меняется в своей карточке — иначе
              правка из одной группы молча задела бы все остальные.
            </Notice>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
