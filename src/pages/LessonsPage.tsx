import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, PartBadge } from '../ui/PageHeader'
import { ActionLink, Button } from '../ui/Button'
import { Pill } from '../ui/Pill'
import { Select } from '../ui/Field'
import { SubText, Table, TD, TH, THead, TR } from '../ui/Table'
import { BulkCancelModal } from '../components/BulkCancelModal'
import { CancelLessonModal } from '../components/CancelLessonModal'
import { STATE_TONE } from './LessonDetailPage'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import { hasSubstitution } from '../lib/lessons'
import { formatDate, WEEKDAY_SHORT, weekdayOf } from '../lib/date'
import { LESSON_STATE_LABEL, LESSON_TYPE_LABEL, type Lesson } from '../data/types'

const PAGE_SIZE = 60

/** §1, §4 — the lessons that now stand behind every schedule row. */
export function LessonsPage({ embedded = false }: { embedded?: boolean }) {
  const lessons = useDataStore((s) => s.lessons)
  const groups = useDataStore((s) => s.groups)
  const staff = useDataStore((s) => s.staff)
  const subjects = useDataStore((s) => s.subjects)
  const restoreLesson = useDataStore((s) => s.restoreLesson)

  const role = useSessionStore((s) => s.role)
  const actorId = useSessionStore((s) => s.actorId)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)

  const isDirector = role === 'academ_head'
  const [groupFilter, setGroupFilter] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [bulk, setBulk] = useState(false)
  const [cancelling, setCancelling] = useState<Lesson | null>(null)

  const visible = useMemo(() => {
    let list = lessons
    if (role === 'teacher' && actorId) list = list.filter((l) => l.teacherId === actorId)
    if (role === 'curator' && actorId) {
      const mine = new Set(
        groups.filter((g) => g.curatorIds.includes(actorId)).map((g) => g.id),
      )
      list = list.filter((l) => l.groupIds.some((id) => mine.has(id)))
    }
    if (groupFilter !== 'all') list = list.filter((l) => l.groupIds.includes(groupFilter))
    if (stateFilter !== 'all') list = list.filter((l) => l.state === stateFilter)
    if (from) list = list.filter((l) => l.date >= from)
    if (to) list = list.filter((l) => l.date <= to)
    return [...list].sort(
      (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
    )
  }, [lessons, role, actorId, groups, groupFilter, stateFilter, from, to])

  const nameOf = (id: string | null) =>
    id ? (staff.find((p) => p.id === id)?.fullName ?? '—') : null

  return (
    <>
      {embedded ? null : (
        <>
          <PartBadge part={2} />
          <PageHeader
            title="Занятия"
            subtitle="Реальные уроки с датами, созданные из расписания групп."
            actions={
              isDirector ? (
                <Button variant="danger" onClick={() => setBulk(true)}>
                  Массовая отмена
                </Button>
              ) : undefined
            }
          />
        </>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-700">Группа</span>
          <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="all">Все группы</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-700">Состояние</span>
          <Select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
            <option value="all">Любое</option>
            {Object.entries(LESSON_STATE_LABEL).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-700">С даты</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-[38px] w-full rounded-card border border-line-input bg-white px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-700">По дату</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-[38px] w-full rounded-card border border-line-input bg-white px-3 text-sm"
          />
        </label>
      </div>

      <div className="mb-2 text-right text-sm text-slate-500">
        {visible.length} занятий
      </div>

      <Table>
        <THead>
          <tr>
            <TH>Дата</TH>
            <TH>Время</TH>
            <TH>Занятие</TH>
            <TH>Группы</TH>
            <TH>Преподаватель</TH>
            <TH>Состояние</TH>
            {isDirector ? <TH>Действия</TH> : null}
          </tr>
        </THead>
        <tbody>
          {visible.slice(0, limit).map((lesson) => {
            const subject = subjects.find((s) => s.id === lesson.subjectId)
            const shared = lesson.sourceRowId === null
            return (
              <TR key={lesson.id}>
                <TD>
                  {formatDate(lesson.date)}
                  <SubText>{WEEKDAY_SHORT[weekdayOf(lesson.date)]}</SubText>
                </TD>
                <TD className="whitespace-nowrap">
                  {lesson.startTime}–{lesson.endTime}
                </TD>
                <TD>
                  <Link
                    to={`/lessons/${lesson.id}`}
                    className="font-medium text-slate-900 underline underline-offset-2"
                  >
                    {lesson.title ?? subject?.title ?? 'Занятие'}
                  </Link>
                  <SubText>
                    {LESSON_TYPE_LABEL[lesson.type]}
                    {shared ? ' · общее' : ''}
                  </SubText>
                </TD>
                <TD>
                  {lesson.groupIds.length > 2
                    ? `${lesson.groupIds.length} групп`
                    : lesson.groupIds
                        .map((id) => groups.find((g) => g.id === id)?.title ?? id)
                        .join(', ')}
                </TD>
                <TD>
                  {nameOf(lesson.teacherId) ?? (
                    <span className="text-slate-400">не назначен</span>
                  )}
                  {hasSubstitution(lesson) ? (
                    <SubText>замена вместо {nameOf(lesson.originalTeacherId)}</SubText>
                  ) : null}
                </TD>
                <TD>
                  <Pill tone={STATE_TONE[lesson.state]}>
                    {LESSON_STATE_LABEL[lesson.state]}
                  </Pill>
                  {lesson.cancelReason ? <SubText>{lesson.cancelReason}</SubText> : null}
                </TD>
                {isDirector ? (
                  <TD>
                    {lesson.state === 'cancelled' ? (
                      <ActionLink
                        tone="success"
                        onClick={() =>
                          restoreLesson(lesson.id, 'Академ Хэд', `${today} ${time}`)
                        }
                      >
                        Вернуть
                      </ActionLink>
                    ) : (
                      <ActionLink tone="danger" onClick={() => setCancelling(lesson)}>
                        Отменить
                      </ActionLink>
                    )}
                  </TD>
                ) : null}
              </TR>
            )
          })}
          {visible.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-sm text-slate-500">
                Занятий по такому фильтру нет.
              </td>
            </tr>
          ) : null}
        </tbody>
      </Table>

      {visible.length > limit ? (
        <div className="mt-3">
          <Button variant="secondary" onClick={() => setLimit(limit + PAGE_SIZE)}>
            Показать ещё
          </Button>
        </div>
      ) : null}

      {bulk ? <BulkCancelModal onClose={() => setBulk(false)} /> : null}
      {cancelling ? (
        <CancelLessonModal lesson={cancelling} onClose={() => setCancelling(null)} />
      ) : null}
    </>
  )
}
