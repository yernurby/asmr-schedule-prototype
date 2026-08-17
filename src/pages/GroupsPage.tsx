import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../ui/PageHeader'
import { Notice } from '../ui/Card'
import { CapacityPill, Pill } from '../ui/Pill'
import { Tabs } from '../ui/Tabs'
import {
  BandRow,
  bandToneForCourse,
  SubText,
  Table,
  TD,
  TH,
  THead,
  TR,
} from '../ui/Table'
import * as Icon from '../ui/icons'
import { groupStudentCount, staffNames, useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import { scopeGroups } from '../lib/scope'
import {
  GROUP_PHASE_LABEL,
  formatDate,
  groupPhase,
  WEEKDAY_SHORT,
  type GroupPhase,
} from '../lib/date'
import type { Group } from '../data/types'

const PHASE_TONE: Record<GroupPhase, 'success' | 'warning' | 'neutral'> = {
  running: 'success',
  upcoming: 'warning',
  finished: 'neutral',
}

/**
 * Simplified copy of the real "Группы" screen (screen-16): rows grouped by
 * course under coloured bands, capacity pill, and the schedule as plain text.
 *
 * The "РАСПИСАНИЕ" column is deliberately kept as text — that is exactly what
 * ASMR shows today, and what part 2 replaces with real lessons.
 */
export function GroupsPage() {
  const groups = useDataStore((s) => s.groups)
  const courses = useDataStore((s) => s.courses)
  const staff = useDataStore((s) => s.staff)
  const enrollments = useDataStore((s) => s.enrollments)

  const role = useSessionStore((s) => s.role)
  const actorId = useSessionStore((s) => s.actorId)
  const today = useSessionStore((s) => s.today)

  const studentGroupIds = useMemo(
    () =>
      role === 'student' && actorId
        ? enrollments.filter((e) => e.studentId === actorId).map((e) => e.groupId)
        : [],
    [role, actorId, enrollments],
  )

  const visible = scopeGroups(groups, role, actorId, studentGroupIds)
  const [tab, setTab] = useState('all')

  const phaseOf = (g: Group) => groupPhase(g.startDate, g.endDate, today)

  const tabs = [
    { id: 'all', label: 'Все группы', count: visible.length },
    {
      id: 'running',
      label: 'Идут сейчас',
      count: visible.filter((g) => phaseOf(g) === 'running').length,
    },
    {
      id: 'upcoming',
      label: 'Стартуют',
      count: visible.filter((g) => phaseOf(g) === 'upcoming').length,
    },
    {
      id: 'finished',
      label: 'Завершены',
      count: visible.filter((g) => phaseOf(g) === 'finished').length,
    },
  ]

  const rows = tab === 'all' ? visible : visible.filter((g) => phaseOf(g) === tab)

  // Group rows by course, preserving the order of the course catalogue.
  const byCourse = courses
    .map((course) => ({
      course,
      items: rows.filter((g) => g.courseId === course.id),
    }))
    .filter((entry) => entry.items.length > 0)

  const COLS = 9

  return (
    <>
      <PageHeader
        title={role === 'academ_head' ? 'Группы' : 'Мои группы'}
        subtitle="Учебные группы и их расписание. Упрощённая копия существующего экрана АСМР."
      />

      <div className="mb-4">
        <Notice tone="info">
          Расписание здесь — просто строка «Пн 17:00–18:30». За ней нет занятий:
          нечего открыть, отменить или посчитать. Это и закрывает часть 2 модуля.
        </Notice>
      </div>

      <Tabs items={tabs} value={tab} onChange={setTab} />

      <div className="mb-2 text-right text-sm text-slate-500">{rows.length}</div>

      <Table>
        <THead>
          <tr>
            <TH>Название</TH>
            <TH>Курс</TH>
            <TH>Вместимость</TH>
            <TH>Начало</TH>
            <TH>Конец</TH>
            <TH>Длительность</TH>
            <TH>Расписание</TH>
            <TH>Преподаватели</TH>
            <TH>Кураторы</TH>
          </tr>
        </THead>
        <tbody>
          {byCourse.map(({ course, items }) => (
            <Fragment key={course.id}>
              <BandRow
                colSpan={COLS}
                title={course.title}
                count={items.length}
                tone={bandToneForCourse(course.title)}
              />
              {items.map((group) => {
                const phase = phaseOf(group)
                const teachers = staffNames(staff, group.teacherIds)
                const curators = staffNames(staff, group.curatorIds)
                return (
                  <TR key={group.id} highlighted={group.starred}>
                    <TD>
                      <div className="flex items-start gap-2">
                        <span
                          className={group.starred ? 'text-amber-500' : 'text-slate-300'}
                        >
                          <Icon.Star filled={group.starred} />
                        </span>
                        <div>
                          <Link
                            to={`/groups/${group.id}`}
                            className="font-medium text-slate-900 underline underline-offset-2"
                          >
                            {group.title}
                          </Link>
                          <div className="mt-1">
                            <Pill tone={PHASE_TONE[phase]}>{GROUP_PHASE_LABEL[phase]}</Pill>
                          </div>
                        </div>
                      </div>
                    </TD>
                    <TD>{course.title}</TD>
                    <TD>
                      <CapacityPill
                        filled={groupStudentCount(enrollments, group.id)}
                        capacity={group.capacity}
                      />
                    </TD>
                    <TD>{formatDate(group.startDate)}</TD>
                    <TD>{formatDate(group.endDate)}</TD>
                    <TD>{group.weeks} нед.</TD>
                    <TD>
                      {group.schedule.map((row, i) => (
                        <div key={i} className="whitespace-nowrap text-sm text-slate-700">
                          {WEEKDAY_SHORT[row.weekday]} {row.startTime}–{row.endTime}
                        </div>
                      ))}
                    </TD>
                    <TD>
                      {teachers.length > 0 ? (
                        teachers.map((n) => <div key={n}>{n}</div>)
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TD>
                    <TD>
                      {curators.length > 0 ? (
                        curators.map((n) => <div key={n}>{n}</div>)
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {group.enrollmentOpen ? <SubText>набор открыт</SubText> : null}
                    </TD>
                  </TR>
                )
              })}
            </Fragment>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={COLS} className="px-4 py-6 text-sm text-slate-500">
                Групп нет.
              </td>
            </tr>
          ) : null}
        </tbody>
      </Table>
    </>
  )
}
