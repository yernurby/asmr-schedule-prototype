import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, PartBadge } from '../ui/PageHeader'
import { ActionLink } from '../ui/Button'
import { CapacityPill, Pill } from '../ui/Pill'
import { Select } from '../ui/Field'
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
import { GroupFormModal } from '../components/GroupFormModal'
import { groupStudentCount, staffNames, useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import { scopeGroups } from '../lib/scope'
import { allCourseSubjects, groupTeacherIds, isSingleSubject } from '../lib/subjects'
import { shortName } from '../lib/people'
import {
  GROUP_PHASE_LABEL,
  formatDate,
  groupPhase,
  WEEKDAY_SHORT,
  type GroupPhase,
} from '../lib/date'
import type { Group, ScheduleRow, Subject } from '../data/types'

const PHASE_TONE: Record<GroupPhase, 'success' | 'warning' | 'neutral'> = {
  running: 'success',
  upcoming: 'warning',
  finished: 'neutral',
}

/**
 * "Группы" — the schedule column now names the subject and the teacher of every
 * slot (part 1, §13), single-subject courses keep the old look (§14), and there
 * is a filter by subject (§16).
 */
export function GroupsPage() {
  const groups = useDataStore((s) => s.groups)
  const courses = useDataStore((s) => s.courses)
  const subjects = useDataStore((s) => s.subjects)
  const staff = useDataStore((s) => s.staff)
  const enrollments = useDataStore((s) => s.enrollments)

  const role = useSessionStore((s) => s.role)
  const actorId = useSessionStore((s) => s.actorId)
  const today = useSessionStore((s) => s.today)

  const [tab, setTab] = useState('all')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [editingId, setEditingId] = useState<string | null>(null)

  const editing = groups.find((g) => g.id === editingId) ?? null
  const canEdit = role === 'academ_head'

  const studentGroupIds = useMemo(
    () =>
      role === 'student' && actorId
        ? enrollments.filter((e) => e.studentId === actorId).map((e) => e.groupId)
        : [],
    [role, actorId, enrollments],
  )

  const visible = scopeGroups(groups, role, actorId, studentGroupIds)
  const phaseOf = (g: Group) => groupPhase(g.startDate, g.endDate, today)

  const byPhase = tab === 'all' ? visible : visible.filter((g) => phaseOf(g) === tab)
  const rows =
    subjectFilter === 'all'
      ? byPhase
      : byPhase.filter((g) => g.schedule.some((r) => r.subjectId === subjectFilter))

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

  const byCourse = courses
    .map((course) => ({ course, items: rows.filter((g) => g.courseId === course.id) }))
    .filter((entry) => entry.items.length > 0)

  const COLS = 9

  /** Rows in reading order: by subject, then weekday, then start time. */
  const orderedSchedule = (group: Group): ScheduleRow[] => {
    const order = allCourseSubjects(subjects, group.courseId).map((s) => s.id)
    return [...group.schedule].sort((a, b) => {
      const bySubject = order.indexOf(a.subjectId) - order.indexOf(b.subjectId)
      if (bySubject !== 0) return bySubject
      if (a.weekday !== b.weekday) return a.weekday - b.weekday
      return a.startTime.localeCompare(b.startTime)
    })
  }

  return (
    <>
      <PartBadge part={1} />

      <PageHeader
        title={role === 'academ_head' ? 'Группы' : 'Мои группы'}
        subtitle="Учебные группы и их расписание по предметам."
      />

      <Tabs items={tabs} value={tab} onChange={setTab} />

      <div className="mb-4 flex items-end gap-3">
        <label className="block w-96">
          <span className="mb-1.5 block text-sm text-slate-700">Предмет</span>
          <Select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            <option value="all">Все предметы</option>
            {courses.map((course) => {
              const list = allCourseSubjects(subjects, course.id)
              if (list.length === 0) return null
              return (
                <optgroup key={course.id} label={course.title}>
                  {list.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                      {s.isArchived ? ' (архивный)' : ''}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </Select>
        </label>
        <div className="ml-auto text-sm text-slate-500">{rows.length}</div>
      </div>

      <Table>
        <THead>
          <tr>
            <TH>Название</TH>
            <TH>Курс</TH>
            <TH>Вместимость</TH>
            <TH>Начало</TH>
            <TH>Конец</TH>
            <TH>Расписание</TH>
            <TH>Преподаватели</TH>
            <TH>Кураторы</TH>
            <TH>Действия</TH>
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
                const single = isSingleSubject(subjects, group.courseId)
                const teachers = staffNames(staff, groupTeacherIds(group))
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
                    <TD>
                      {formatDate(group.endDate)}
                      <SubText>{group.weeks} нед.</SubText>
                    </TD>

                    <TD>
                      {group.schedule.length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        orderedSchedule(group).map((row) => (
                          <ScheduleLine
                            key={row.id}
                            row={row}
                            subject={subjects.find((s) => s.id === row.subjectId)}
                            teacherName={
                              row.teacherId
                                ? staff.find((p) => p.id === row.teacherId)?.fullName
                                : undefined
                            }
                            showSubject={!single}
                          />
                        ))
                      )}
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
                    <TD>
                      {canEdit ? (
                        <ActionLink onClick={() => setEditingId(group.id)}>
                          Редактировать
                        </ActionLink>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
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

      {editing ? (
        <GroupFormModal group={editing} onClose={() => setEditingId(null)} />
      ) : null}
    </>
  )
}

/**
 * One schedule line: "Пн 15:00–16:30 · Матем · Аскар Ж."
 * The subject is dropped for single-subject courses (§14).
 */
function ScheduleLine({
  row,
  subject,
  teacherName,
  showSubject,
}: {
  row: ScheduleRow
  subject: Subject | undefined
  teacherName: string | undefined
  showSubject: boolean
}) {
  return (
    <div className="whitespace-nowrap text-sm text-slate-700">
      {WEEKDAY_SHORT[row.weekday]} {row.startTime}–{row.endTime}
      {showSubject && subject ? (
        <>
          <span className="text-slate-400"> · </span>
          {subject.title}
        </>
      ) : null}
      <span className="text-slate-400"> · </span>
      {teacherName ? (
        shortName(teacherName)
      ) : (
        <span className="text-slate-400">не назначен</span>
      )}
    </div>
  )
}
