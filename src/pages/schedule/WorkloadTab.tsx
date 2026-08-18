import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardTitle } from '../../ui/Card'
import { Checkbox, Field, Select, TextInput } from '../../ui/Field'
import { Pill } from '../../ui/Pill'
import { SubText, Table, TD, TH, THead, TR } from '../../ui/Table'
import { groupStudentCount, useDataStore } from '../../store/useDataStore'
import { useSessionStore } from '../../store/useSessionStore'
import { durationHours, formatDate, GROUP_PHASE_LABEL, groupPhase } from '../../lib/date'
import type { GroupPhase } from '../../lib/date'
import type { Group } from '../../data/types'

const PHASE_TONE: Record<GroupPhase, 'success' | 'warning' | 'neutral'> = {
  running: 'success',
  upcoming: 'warning',
  finished: 'neutral',
}

/**
 * §27–§31 — who carries how much. Hours come from the planned schedule; §31
 * keeps substitutions and moves out of this view, they get their own in part 5.
 */
export function WorkloadTab() {
  const staff = useDataStore((s) => s.staff)
  const groups = useDataStore((s) => s.groups)
  const courses = useDataStore((s) => s.courses)
  const subjects = useDataStore((s) => s.subjects)
  const enrollments = useDataStore((s) => s.enrollments)
  const today = useSessionStore((s) => s.today)

  const [courseId, setCourseId] = useState('all')
  const [subjectId, setSubjectId] = useState('all')
  // §30 — finished groups stay hidden until asked for.
  const [includeFinished, setIncludeFinished] = useState(false)
  const [query, setQuery] = useState('')

  const phaseOf = (g: Group) => groupPhase(g.startDate, g.endDate, today)

  const visibleGroups = useMemo(
    () =>
      groups.filter((g) => {
        if (!includeFinished && groupPhase(g.startDate, g.endDate, today) === 'finished')
          return false
        if (courseId !== 'all' && g.courseId !== courseId) return false
        if (subjectId !== 'all' && !g.schedule.some((r) => r.subjectId === subjectId))
          return false
        return true
      }),
    [groups, includeFinished, courseId, subjectId, today],
  )

  const matches = (name: string) =>
    query.trim().length === 0 || name.toLowerCase().includes(query.trim().toLowerCase())

  const teachers = staff.filter((p) => p.roles.includes('teacher') && matches(p.fullName))
  const curators = staff.filter((p) => p.roles.includes('curator') && matches(p.fullName))

  const titleOf = (id: string) => subjects.find((s) => s.id === id)?.title ?? id
  const courseOf = (g: Group) => courses.find((c) => c.id === g.courseId)?.title ?? '—'

  const groupLine = (g: Group, withCourse = false) => (
    <div key={g.id} className="mb-1 last:mb-0">
      <Link to={`/groups/${g.id}`} className="text-slate-800 underline underline-offset-2">
        {g.title}
      </Link>{' '}
      <Pill tone={PHASE_TONE[phaseOf(g)]}>{GROUP_PHASE_LABEL[phaseOf(g)]}</Pill>
      <SubText>
        {withCourse ? `${courseOf(g)} · ` : ''}
        {formatDate(g.startDate)} — {formatDate(g.endDate)}
      </SubText>
    </div>
  )

  return (
    <>
      <Card className="mb-4">
        <CardTitle>Фильтры</CardTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Field label="Курс">
            <Select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value)
                setSubjectId('all')
              }}
            >
              <option value="all">Все курсы</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Предмет">
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="all">Все предметы</option>
              {subjects
                .filter((s) => courseId === 'all' || s.courseId === courseId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
            </Select>
          </Field>

          <Field label="Поиск по имени">
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Фамилия или имя"
            />
          </Field>

          <div className="flex items-end pb-2">
            <Checkbox
              checked={includeFinished}
              onChange={setIncludeFinished}
              label="Показывать завершённые группы"
            />
          </div>
        </div>
      </Card>

      <Card flush className="mb-4">
        <div className="px-4 pb-3 pt-4">
          <CardTitle hint="Часы — по плановому расписанию">
            Нагрузка преподавателей
          </CardTitle>
        </div>
        <Table>
          <THead>
            <tr>
              <TH>Преподаватель</TH>
              <TH>Предметы</TH>
              <TH>Группы</TH>
              <TH align="right">Занятий в неделю</TH>
              <TH align="right">Часов в неделю</TH>
              <TH align="right">Студентов</TH>
              <TH>Календарь</TH>
            </tr>
          </THead>
          <tbody>
            {teachers.map((person) => {
              const own = visibleGroups.filter((g) =>
                g.schedule.some((r) => r.teacherId === person.id),
              )
              const rows = own.flatMap((g) =>
                g.schedule.filter((r) => r.teacherId === person.id),
              )
              const hours = rows.reduce(
                (acc, r) => acc + durationHours(r.startTime, r.endTime),
                0,
              )
              const students = own.reduce(
                (acc, g) => acc + groupStudentCount(enrollments, g.id),
                0,
              )
              return (
                <TR key={person.id}>
                  <TD className="font-medium text-slate-900">{person.fullName}</TD>
                  <TD>
                    {person.subjectIds.length === 0 ? (
                      <span className="text-slate-400">не заданы</span>
                    ) : (
                      person.subjectIds.map((id) => (
                        <div key={id} className="text-sm">
                          {titleOf(id)}
                        </div>
                      ))
                    )}
                  </TD>
                  <TD>
                    {own.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      own.map((g) => groupLine(g))
                    )}
                  </TD>
                  <TD align="right">{rows.length}</TD>
                  <TD align="right">{hours.toLocaleString('ru-RU')}</TD>
                  <TD align="right">{students}</TD>
                  <TD>
                    <Link
                      to="/schedule/calendar"
                      className="text-sm text-slate-700 underline underline-offset-2"
                    >
                      Открыть
                    </Link>
                  </TD>
                </TR>
              )
            })}
          </tbody>
        </Table>
      </Card>

      <Card flush>
        <div className="px-4 pb-3 pt-4">
          <CardTitle>Нагрузка кураторов</CardTitle>
        </div>
        <Table>
          <THead>
            <tr>
              <TH>Куратор</TH>
              <TH align="right">Групп</TH>
              <TH>Группы</TH>
              <TH align="right">Студентов</TH>
              <TH>Ближайший старт</TH>
            </tr>
          </THead>
          <tbody>
            {curators.map((person) => {
              const own = visibleGroups.filter((g) => g.curatorIds.includes(person.id))
              const students = own.reduce(
                (acc, g) => acc + groupStudentCount(enrollments, g.id),
                0,
              )
              const nextStart = own
                .map((g) => g.startDate)
                .filter((d) => d >= today)
                .sort()[0]
              return (
                <TR key={person.id}>
                  <TD className="font-medium text-slate-900">{person.fullName}</TD>
                  <TD align="right">{own.length}</TD>
                  <TD>
                    {own.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      own.map((g) => groupLine(g, true))
                    )}
                  </TD>
                  <TD align="right">{students}</TD>
                  <TD>
                    {nextStart ? (
                      formatDate(nextStart)
                    ) : (
                      <span className="text-slate-400">нет</span>
                    )}
                  </TD>
                </TR>
              )
            })}
          </tbody>
        </Table>
      </Card>
    </>
  )
}
