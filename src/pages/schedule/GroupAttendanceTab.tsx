import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardTitle, EmptyState, Notice, StatCard } from '../../ui/Card'
import { Field, Select } from '../../ui/Field'
import { useDataStore } from '../../store/useDataStore'
import { useSessionStore } from '../../store/useSessionStore'
import { effectiveState, stamp } from '../../lib/attendance'
import { formatDate } from '../../lib/date'
import { monthOf } from '../../lib/lessons'
import type { AttendanceStatus } from '../../data/types'

const CELL: Record<AttendanceStatus | 'none', { text: string; className: string }> = {
  present: { text: '+', className: 'bg-emerald-100 text-emerald-700' },
  late: { text: 'о', className: 'bg-amber-100 text-amber-700' },
  absent: { text: '–', className: 'bg-red-100 text-rose-700' },
  none: { text: '–', className: 'bg-red-100 text-rose-700' },
}

/**
 * The attendance report the curator's "Курсы" screen has been promising since
 * screen-36 ("Отчет по посещаемости будет добавлен позже").
 *
 * Students down the side, held lessons across the top, one cell per pair.
 * Absence is the default, so a missing mark and an explicit absence read alike.
 */
export function GroupAttendanceTab() {
  const groups = useDataStore((s) => s.groups)
  const students = useDataStore((s) => s.students)
  const enrollments = useDataStore((s) => s.enrollments)
  const lessons = useDataStore((s) => s.lessons)
  const attendance = useDataStore((s) => s.attendance)
  const subjects = useDataStore((s) => s.subjects)

  const role = useSessionStore((s) => s.role)
  const actorId = useSessionStore((s) => s.actorId)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)
  const now = stamp(today, time)

  const myGroups = useMemo(
    () =>
      role === 'curator' && actorId
        ? groups.filter((g) => g.curatorIds.includes(actorId))
        : groups.filter((g) => g.status === 'active'),
    [groups, role, actorId],
  )

  const [groupId, setGroupId] = useState(myGroups[0]?.id ?? '')
  const [month, setMonth] = useState('all')

  const group = groups.find((g) => g.id === groupId)

  const held = useMemo(
    () =>
      lessons
        .filter((l) => l.groupIds.includes(groupId))
        .filter((l) => {
          const state = effectiveState(l, now)
          return state === 'held' || state === 'manual'
        })
        .filter((l) => (month === 'all' ? true : monthOf(l.date) === month))
        .sort(
          (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
        ),
    [lessons, groupId, month, now],
  )

  const roster = useMemo(() => {
    const ids = enrollments
      .filter((e) => e.groupId === groupId && e.status === 'active')
      .map((e) => e.studentId)
    return students
      .filter((s) => ids.includes(s.id))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [enrollments, students, groupId])

  const months = useMemo(
    () => [
      ...new Set(
        lessons.filter((l) => l.groupIds.includes(groupId)).map((l) => monthOf(l.date)),
      ),
    ].sort(),
    [lessons, groupId],
  )

  const markOf = (lessonId: string, studentId: string) =>
    attendance.find((m) => m.lessonId === lessonId && m.studentId === studentId)

  const rateOf = (studentId: string) => {
    if (held.length === 0) return 0
    const been = held.filter((l) => {
      const m = markOf(l.id, studentId)
      return m && (m.status === 'present' || m.status === 'late')
    }).length
    return Math.round((been / held.length) * 100)
  }

  const groupRate =
    roster.length === 0
      ? 0
      : Math.round(roster.reduce((acc, s) => acc + rateOf(s.id), 0) / roster.length)

  return (
    <>
      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Группа">
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              {myGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Месяц">
            <Select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="all">Весь период</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Проведено занятий" value={held.length} />
        <StatCard label="Студентов" value={roster.length} />
        <StatCard label="Средняя посещаемость" value={`${groupRate}%`} />
      </div>

      {!group ? (
        <Card>
          <EmptyState>Выберите группу.</EmptyState>
        </Card>
      ) : held.length === 0 ? (
        <Card>
          <EmptyState>
            По этой группе ещё нет проведённых занятий — таблица появится, как
            только преподаватель отметит первое.
          </EmptyState>
        </Card>
      ) : (
        <Card flush>
          <div className="px-4 pb-3 pt-4">
            <CardTitle hint="+ был · о опоздал · – не был">
              Посещаемость · {group.title}
            </CardTitle>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-page">
                <tr>
                  <th className="sticky left-0 z-10 border-b border-line bg-page px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Студент
                  </th>
                  {held.map((lesson) => (
                    <th
                      key={lesson.id}
                      className="border-b border-line px-1 py-2 text-center text-xs font-medium text-slate-500"
                      title={`${formatDate(lesson.date)} ${lesson.startTime} · ${subjects.find((s) => s.id === lesson.subjectId)?.title ?? ''}`}
                    >
                      <Link
                        to={`/lessons/${lesson.id}`}
                        className="whitespace-nowrap underline underline-offset-2"
                      >
                        {lesson.date.slice(8)}.{lesson.date.slice(5, 7)}
                      </Link>
                    </th>
                  ))}
                  <th className="border-b border-line px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    Итого
                  </th>
                </tr>
              </thead>
              <tbody>
                {roster.map((student) => {
                  const rate = rateOf(student.id)
                  return (
                    <tr key={student.id} className="border-b border-muted last:border-b-0">
                      <td className="sticky left-0 z-10 whitespace-nowrap border-r border-muted bg-surface px-4 py-1.5 text-sm text-slate-800">
                        {student.fullName}
                      </td>
                      {held.map((lesson) => {
                        const mark = markOf(lesson.id, student.id)
                        const cell = CELL[mark ? mark.status : 'none']
                        return (
                          <td key={lesson.id} className="px-1 py-1.5 text-center">
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-medium ${cell.className}`}
                            >
                              {cell.text}
                            </span>
                          </td>
                        )
                      })}
                      <td
                        className={`px-3 py-1.5 text-right text-sm font-medium ${
                          rate < 60 ? 'text-rose-700' : 'text-slate-800'
                        }`}
                      >
                        {rate}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-4">
        <Notice tone="info">
          В таблице только проведённые занятия. Отсутствие отметки считается
          пропуском — так решено в части 4, чтобы преподаватель трогал исключения,
          а не весь список.
        </Notice>
      </div>
    </>
  )
}
