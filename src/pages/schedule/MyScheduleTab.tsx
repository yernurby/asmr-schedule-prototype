import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardTitle, EmptyState, Notice } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { Pill } from '../../ui/Pill'
import { WeekGrid, assignLanes, type WeekGridBlock } from '../../ui/WeekGrid'
import { WeekNav } from './WeekNav'
import { LessonLabel } from './CalendarTab'
import { useDataStore } from '../../store/useDataStore'
import { useSessionStore } from '../../store/useSessionStore'
import { availabilityOf, isOutsideAvailability } from '../../lib/availability'
import { lessonBlockClass, weekDays } from '../../lib/calendar'
import { formatDate, weekdayOf } from '../../lib/date'
import { attendanceWindow, stamp } from '../../lib/attendance'
import { SubstitutionModal } from '../../components/SubstitutionModal'
import { AttendanceRoster } from '../../components/AttendanceRoster'
import { TransferModal } from '../../components/TransferModal'
import { LESSON_TYPE_LABEL, type Lesson } from '../../data/types'

/** §17–§20 — the teacher's own week, and the detail they actually need. */
export function MyScheduleTab() {
  const lessons = useDataStore((s) => s.lessons)
  const groups = useDataStore((s) => s.groups)
  const subjects = useDataStore((s) => s.subjects)
  const staff = useDataStore((s) => s.staff)
  const enrollments = useDataStore((s) => s.enrollments)
  const availability = useDataStore((s) => s.availability)

  const actorId = useSessionStore((s) => s.actorId)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)

  const [anchor, setAnchor] = useState(today)
  const [selected, setSelected] = useState<Lesson | null>(null)
  const [copied, setCopied] = useState(false)
  const [asking, setAsking] = useState<'substitution' | 'transfer' | null>(null)

  const days = weekDays(anchor)
  const me = staff.find((p) => p.id === actorId)

  const mine = useMemo(() => {
    const daySet = new Set(days)
    return lessons.filter((l) => l.teacherId === actorId && daySet.has(l.date))
  }, [lessons, actorId, days])

  const blocks: WeekGridBlock[] = assignLanes(
    mine.map((l) => ({ ...l, weekday: weekdayOf(l.date) })),
  ).map(({ item, lane, lanes }) => {
    const subject = subjects.find((s) => s.id === item.subjectId)
    const titles = item.groupIds
      .map((id) => groups.find((g) => g.id === id)?.title ?? '')
      .filter(Boolean)
    return {
      key: item.id,
      weekday: item.weekday,
      startTime: item.startTime,
      endTime: item.endTime,
      lane,
      lanes,
      className: lessonBlockClass(item, stamp(today, time)),
      onClick: () => {
        setSelected(item)
        setCopied(false)
      },
      title: `${item.startTime}–${item.endTime} · ${titles.join(', ')}`,
      content: (
        <LessonLabel
          startTime={item.startTime}
          endTime={item.endTime}
          groups={titles.length > 2 ? `${titles.length} групп` : titles.join(', ')}
          subject={subject?.title}
          outside={isOutsideAvailability(availability, item)}
        />
      ),
    }
  })

  const studentsOf = (lesson: Lesson) =>
    enrollments.filter(
      (e) => lesson.groupIds.includes(e.groupId) && e.status === 'active',
    ).length

  return (
    <>
      <WeekNav anchor={anchor} onChange={setAnchor} today={today} days={days} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <WeekGrid
          days={days}
          blocks={blocks}
          background={actorId ? availabilityOf(availability, actorId) : undefined}
          todayIso={today}
          nowTime={time}
        />

        <Card>
          <CardTitle>{selected ? 'Занятие' : 'Выберите занятие'}</CardTitle>

          {!selected ? (
            <EmptyState>
              {me ? `${me.fullName}: ` : ''}
              {mine.length} занятий на этой неделе. Нажмите на любое, чтобы увидеть
              группу, состав и ссылку на Meet.
            </EmptyState>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-slate-500">Группа</div>
                <div className="text-slate-900">
                  {selected.groupIds
                    .map((id) => groups.find((g) => g.id === id)?.title ?? id)
                    .join(', ')}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Предмет</div>
                <div className="text-slate-900">
                  {subjects.find((s) => s.id === selected.subjectId)?.title ?? '—'}
                  <span className="ml-2 text-xs text-slate-500">
                    {LESSON_TYPE_LABEL[selected.type]}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-slate-500">Время</div>
                <div className="text-slate-900">
                  {formatDate(selected.date)}, {selected.startTime}–{selected.endTime}
                </div>
              </div>
              <div>
                <div className="mb-1 text-slate-500">
                  Студентов: {studentsOf(selected)}
                </div>
                <AttendanceRoster lesson={selected} compact />
              </div>

              {isOutsideAvailability(availability, selected) ? (
                <Notice tone="neutral">
                  Вне вашей доступности. Запросить перестановку можно на вкладке
                  «Моя доступность».
                </Notice>
              ) : null}

              {selected.state === 'cancelled' ? (
                <Pill tone="danger">Отменено{selected.cancelReason ? `: ${selected.cancelReason}` : ''}</Pill>
              ) : null}

              <div>
                <div className="text-slate-500">Meet</div>
                {selected.meetUrl ? (
                  <>
                    <div className="break-all text-xs text-slate-700">
                      {selected.meetUrl}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a
                        href={selected.meetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-[34px] items-center rounded-card bg-slate-900 px-3 text-sm font-medium text-white"
                      >
                        Подключиться
                      </a>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          navigator.clipboard?.writeText(selected.meetUrl ?? '')
                          setCopied(true)
                        }}
                      >
                        {copied ? 'Скопировано' : 'Скопировать ссылку'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-slate-400">Ссылка не указана</div>
                )}
              </div>

              <div className="border-t border-line pt-3">
                <AttendanceAction lesson={selected} now={stamp(today, time)} />
                {selected.state !== 'cancelled' ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setAsking('substitution')}>
                      Нужна замена
                    </Button>
                    <Button variant="secondary" onClick={() => setAsking('transfer')}>
                      Перенести
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </Card>
      </div>

      {asking === 'substitution' && selected ? (
        <SubstitutionModal lesson={selected} onClose={() => setAsking(null)} />
      ) : null}
      {asking === 'transfer' && selected ? (
        <TransferModal lesson={selected} onClose={() => setAsking(null)} />
      ) : null}
    </>
  )
}

/** §1, §2 — the button lives from 10 minutes before the start to 15 after the end. */
function AttendanceAction({ lesson, now }: { lesson: Lesson; now: number }) {
  const window = attendanceWindow(lesson, now)
  if (lesson.state === 'cancelled') {
    return <p className="text-xs text-slate-500">Занятие отменено.</p>
  }
  if (!window.open) {
    return (
      <>
        <span className="inline-flex h-[34px] cursor-not-allowed items-center rounded-card bg-slate-100 px-3 text-sm font-medium text-slate-400">
          Провести занятие
        </span>
        <p className="mt-1 text-xs text-slate-500">
          {window.tooEarly
            ? 'Откроется за 10 минут до начала.'
            : 'Окно закрыто — сначала перенесите занятие.'}
        </p>
      </>
    )
  }
  return (
    <Link
      to={`/attendance/${lesson.id}`}
      className="inline-flex h-[34px] items-center rounded-card bg-slate-900 px-3 text-sm font-medium text-white"
    >
      {lesson.state === 'held' ? 'Открыть посещаемость' : 'Провести занятие'}
    </Link>
  )
}
