import { useParams } from 'react-router-dom'
import { PageHeader } from '../ui/PageHeader'
import { Card, CardTitle, EmptyState, Notice, StatCard } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { Table, TD, TH, THead, TR } from '../ui/Table'
import {
  groupStudentCount,
  groupStudents,
  staffNames,
  useDataStore,
} from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import {
  GROUP_PHASE_LABEL,
  formatDate,
  groupPhase,
  WEEKDAY_LONG,
} from '../lib/date'

/**
 * Simplified copy of the real group card (screen-18): capacity, dates, documents,
 * notes and the student list. There are no lessons behind the schedule — that
 * is what part 2 adds.
 */
export function GroupDetailPage() {
  const { groupId = '' } = useParams()
  const groups = useDataStore((s) => s.groups)
  const courses = useDataStore((s) => s.courses)
  const staff = useDataStore((s) => s.staff)
  const students = useDataStore((s) => s.students)
  const enrollments = useDataStore((s) => s.enrollments)
  const today = useSessionStore((s) => s.today)

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
  const teachers = staffNames(staff, group.teacherIds)
  const curators = staffNames(staff, group.curatorIds)

  return (
    <>
      <PageHeader
        title={group.title}
        subtitle="Состав группы и заполняемость"
        backTo="/groups"
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

      <div className="mb-4">
        <Card>
          <CardTitle>Детали группы</CardTitle>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            <Detail label="Курс" value={course?.title ?? '—'} />
            <Detail label="Длительность" value={`${group.weeks} нед.`} />
            <Detail
              label="Преподаватели"
              value={teachers.length > 0 ? teachers.join(', ') : 'Не назначено'}
            />
            <Detail
              label="Кураторы"
              value={curators.length > 0 ? curators.join(', ') : 'Не назначено'}
            />
            <div className="md:col-span-2">
              <div className="mb-1 text-sm text-slate-500">Расписание</div>
              <div className="space-y-0.5">
                {group.schedule.map((row, i) => (
                  <div key={i} className="text-sm text-slate-800">
                    {WEEKDAY_LONG[row.weekday]} {row.startTime}–{row.endTime}
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Notice tone="info">
                  Это строка расписания, а не занятия. Открыть конкретный урок,
                  отменить его или перенести сейчас нельзя — появится в части 2.
                </Notice>
              </div>
            </div>
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
    </>
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
