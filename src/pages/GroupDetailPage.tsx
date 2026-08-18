import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageHeader, PartBadge } from '../ui/PageHeader'
import { Button } from '../ui/Button'
import { Card, CardTitle, EmptyState, Notice, StatCard } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { Table, TD, TH, THead, TR } from '../ui/Table'
import { GroupFormModal } from '../components/GroupFormModal'
import { SharedLessonModal } from '../components/SharedLessonModal'
import { LessonsBlock } from '../components/LessonsBlock'
import {
  groupStudentCount,
  groupStudents,
  staffNames,
  useDataStore,
} from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import { allCourseSubjects, groupTeacherIds, isSingleSubject } from '../lib/subjects'
import { GROUP_PHASE_LABEL, formatDate, groupPhase, WEEKDAY_LONG } from '../lib/date'
import type { ScheduleRow } from '../data/types'

/**
 * Group card. Since part 1 the schedule is listed per subject, each slot naming
 * its teacher and Meet link, and the teacher list is derived (§12).
 */
export function GroupDetailPage() {
  const { groupId = '' } = useParams()
  const groups = useDataStore((s) => s.groups)
  const courses = useDataStore((s) => s.courses)
  const subjects = useDataStore((s) => s.subjects)
  const staff = useDataStore((s) => s.staff)
  const students = useDataStore((s) => s.students)
  const enrollments = useDataStore((s) => s.enrollments)
  const today = useSessionStore((s) => s.today)
  const role = useSessionStore((s) => s.role)
  const [editing, setEditing] = useState(false)
  const [creatingShared, setCreatingShared] = useState(false)

  const group = groups.find((g) => g.id === groupId)

  if (!group) {
    return (
      <>
        <PageHeader title="Группа не найдена" backTo="/groups" />
        <Card>
          <EmptyState>Такой группы нет. Возможно, данные были сброшены.</EmptyState>
        </Card>
      </>
    )
  }

  const course = courses.find((c) => c.id === group.courseId)
  const phase = groupPhase(group.startDate, group.endDate, today)
  const filled = groupStudentCount(enrollments, group.id)
  const list = groupStudents(students, enrollments, group.id)
  const teachers = staffNames(staff, groupTeacherIds(group))
  const curators = staffNames(staff, group.curatorIds)
  const single = isSingleSubject(subjects, group.courseId)

  // Live subjects, plus archived ones that still carry schedule.
  const blocks = allCourseSubjects(subjects, group.courseId).filter(
    (s) => !s.isArchived || group.schedule.some((r) => r.subjectId === s.id),
  )

  const teacherName = (row: ScheduleRow) =>
    row.teacherId ? staff.find((p) => p.id === row.teacherId)?.fullName : undefined

  const rowsOf = (subjectId: string) =>
    group.schedule
      .filter((r) => r.subjectId === subjectId)
      .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))

  return (
    <>
      <PartBadge part={1} />

      <PageHeader
        title={group.title}
        subtitle="Состав группы и расписание по предметам"
        backTo="/groups"
        actions={
          role === 'academ_head' ? (
            <Button variant="primary" onClick={() => setEditing(true)}>
              Редактировать
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Вместимость" value={`${filled}/${group.capacity}`} />
        <StatCard label="Дата начала" value={formatDate(group.startDate)} />
        <StatCard label="Дата окончания" value={formatDate(group.endDate)} />
        <StatCard
          label="Статус"
          value={GROUP_PHASE_LABEL[phase]}
          hint={group.enrollmentOpen ? 'Набор открыт' : 'Набор закрыт'}
        />
      </div>

      <LessonsBlock
        groupId={group.id}
        canCreateShared={role === 'academ_head'}
        onCreateShared={() => setCreatingShared(true)}
      />

      <div className="mb-4">
        <Card>
          <CardTitle>Детали группы</CardTitle>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            <Detail label="Курс" value={course?.title ?? '—'} />
            <Detail label="Длительность" value={`${group.weeks} нед.`} />
            <div>
              <div className="mb-1 text-sm text-slate-500">Преподаватели</div>
              {teachers.length === 0 ? (
                <div className="text-sm text-slate-400">Не назначено</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {teachers.map((n) => (
                    <Pill key={n} tone="neutral">
                      {n}
                    </Pill>
                  ))}
                </div>
              )}
              <div className="mt-1 text-xs text-slate-500">
                Считается из строк расписания
              </div>
            </div>
            <Detail
              label="Кураторы"
              value={curators.length > 0 ? curators.join(', ') : 'Не назначено'}
            />
          </div>
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <CardTitle hint={`${group.schedule.length} строк`}>Расписание</CardTitle>

          {group.schedule.length === 0 ? (
            <EmptyState>Расписание не задано.</EmptyState>
          ) : single ? (
            // §11/§14 — one subject: a plain list, no subject headings.
            <div className="space-y-1.5">
              {blocks.flatMap((s) => rowsOf(s.id)).map((row) => (
                <SlotLine key={row.id} row={row} teacher={teacherName(row)} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {blocks.map((subject) => {
                const rows = rowsOf(subject.id)
                return (
                  <div key={subject.id}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {subject.title}
                      </span>
                      {subject.isArchived ? <Pill tone="neutral">архивный</Pill> : null}
                    </div>
                    {rows.length === 0 ? (
                      <div className="text-sm text-slate-400">Расписания нет</div>
                    ) : (
                      <div className="space-y-1.5">
                        {rows.map((row) => (
                          <SlotLine key={row.id} row={row} teacher={teacherName(row)} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-3">
            <Notice tone="info">
              Это правило повторения. Занятия с датами создаются из него
              автоматически — их видно в блоке «Занятия группы» и в разделе
              «Занятия». Изменение расписания спросит, с какого числа применять.
            </Notice>
          </div>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Документы группы</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-card border border-line px-3 py-2">
              <div className="text-sm text-slate-500">КП</div>
              <div className="text-sm text-slate-400">Не прикреплено</div>
            </div>
            <div className="rounded-card border border-line px-3 py-2">
              <div className="text-sm text-slate-500">КТП</div>
              <div className="text-sm text-slate-400">Не прикреплено</div>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>Заметки</CardTitle>
          <p className="text-sm text-slate-700">
            {group.notes ?? <span className="text-slate-400">—</span>}
          </p>
          {group.telegramUrl ? (
            <p className="mt-2 text-sm text-slate-500">
              Ссылка на Telegram-группу:{' '}
              <span className="text-slate-700 underline underline-offset-2">
                {group.telegramUrl}
              </span>
            </p>
          ) : null}
        </Card>
      </div>

      <Card flush>
        <div className="px-4 pb-3 pt-4">
          <CardTitle hint={`${list.length} из ${group.capacity}`}>
            Список студентов
          </CardTitle>
        </div>
        <Table>
          <THead>
            <tr>
              <TH>Студент</TH>
              <TH>Email</TH>
              <TH>Телефон</TH>
              <TH>Город</TH>
              <TH>Статус</TH>
            </tr>
          </THead>
          <tbody>
            {list.map((student) => (
              <TR key={student.id}>
                <TD className="font-medium text-slate-900">{student.fullName}</TD>
                <TD>{student.email}</TD>
                <TD>{student.phone}</TD>
                <TD>{student.city}</TD>
                <TD>
                  <Pill tone="success">активный</Pill>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>

      {editing ? (
        <GroupFormModal group={group} onClose={() => setEditing(false)} />
      ) : null}

      {creatingShared ? (
        <SharedLessonModal defaultGroupId={group.id} onClose={() => setCreatingShared(false)} />
      ) : null}
    </>
  )
}

function SlotLine({ row, teacher }: { row: ScheduleRow; teacher: string | undefined }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className="text-slate-800">
        {WEEKDAY_LONG[row.weekday]} {row.startTime}–{row.endTime}
      </span>
      <span className="text-slate-400">·</span>
      {teacher ? (
        <span className="text-slate-800">{teacher}</span>
      ) : (
        <span className="text-slate-400">преподаватель не назначен</span>
      )}
      {row.meetUrl ? (
        <a
          href={row.meetUrl}
          target="_blank"
          rel="noreferrer"
          className="text-slate-700 underline underline-offset-2"
        >
          Meet
        </a>
      ) : null}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-0.5 text-sm text-slate-500">{label}</div>
      <div className="text-sm text-slate-800">{value}</div>
    </div>
  )
}
