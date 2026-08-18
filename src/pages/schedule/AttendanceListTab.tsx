import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState, Notice } from '../../ui/Card'
import { ActionLink, Button } from '../../ui/Button'
import { Pill } from '../../ui/Pill'
import { Modal } from '../../ui/Modal'
import { Field, Select, TextInput } from '../../ui/Field'
import { SubText, Table, TD, TH, THead, TR } from '../../ui/Table'
import { useDataStore } from '../../store/useDataStore'
import { useSessionStore } from '../../store/useSessionStore'
import {
  audienceOf,
  countAttendance,
  effectiveState,
  needsUnmarkedNotice,
  stamp,
} from '../../lib/attendance'
import { formatDate, formatMonth } from '../../lib/date'
import { monthOf } from '../../lib/lessons'
import { LESSON_STATE_LABEL } from '../../data/types'

/**
 * §24 — the curator's own way in: attendance of their groups as a list, without
 * walking through a teacher's calendar.
 * §35 — for the director the same table filtered to everything unmarked in the
 * month, so the pile can be cleared before payroll closes.
 */
export function AttendanceListTab({ unmarkedOnly = false }: { unmarkedOnly?: boolean }) {
  const lessons = useDataStore((s) => s.lessons)
  const groups = useDataStore((s) => s.groups)
  const staff = useDataStore((s) => s.staff)
  const subjects = useDataStore((s) => s.subjects)
  const enrollments = useDataStore((s) => s.enrollments)
  const attendance = useDataStore((s) => s.attendance)
  const claims = useDataStore((s) => s.attendanceClaims)
  const countManually = useDataStore((s) => s.countLessonManually)

  const role = useSessionStore((s) => s.role)
  const actorId = useSessionStore((s) => s.actorId)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)

  const now = stamp(today, time)
  const [month, setMonth] = useState(monthOf(today))
  const [groupFilter, setGroupFilter] = useState('all')
  const [counting, setCounting] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const myGroups = useMemo(
    () =>
      actorId ? groups.filter((g) => g.curatorIds.includes(actorId)).map((g) => g.id) : [],
    [groups, actorId],
  )

  const rows = useMemo(() => {
    let list = lessons.filter((l) => monthOf(l.date) === month)
    if (role === 'curator') {
      list = list.filter((l) => l.groupIds.some((id) => myGroups.includes(id)))
    }
    if (groupFilter !== 'all') list = list.filter((l) => l.groupIds.includes(groupFilter))
    if (unmarkedOnly) list = list.filter((l) => effectiveState(l, now) === 'unmarked')
    else list = list.filter((l) => l.date <= today)
    return list.sort(
      (a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime),
    )
  }, [lessons, month, role, myGroups, groupFilter, unmarkedOnly, now, today])

  const noticeCount = lessons.filter((l) => needsUnmarkedNotice(l, now)).length
  const groupOptions = role === 'curator' ? groups.filter((g) => myGroups.includes(g.id)) : groups

  return (
    <>
      {unmarkedOnly && noticeCount > 0 ? (
        <div className="mb-4 rounded-card bg-amber-100 px-3 py-2 text-sm text-amber-700">
          Уведомление: {noticeCount} занятий не отмечены больше трёх часов после
          окончания. Они не оплачиваются, пока не засчитаны вручную.
        </div>
      ) : null}

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Месяц">
            <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
          <Field label="Группа">
            <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
              <option value="all">Все группы</option>
              {groupOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end pb-2 text-sm text-slate-500">
            {rows.length} занятий за {formatMonth(month)}
          </div>
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState>
            {unmarkedOnly
              ? 'Неотмеченных занятий за этот месяц нет.'
              : 'Занятий за этот месяц нет.'}
          </EmptyState>
        </Card>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Дата</TH>
              <TH>Занятие</TH>
              <TH>Преподаватель</TH>
              <TH>Состояние</TH>
              <TH align="right">Был / опоздал / нет</TH>
              <TH>Действия</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((lesson) => {
              const state = effectiveState(lesson, now)
              const audience = audienceOf(enrollments, lesson).filter((a) =>
                role === 'curator' ? a.groupIds.some((id) => myGroups.includes(id)) : true,
              )
              const c = countAttendance(attendance, lesson.id, audience.length)
              const pending = claims.filter(
                (x) => x.lessonId === lesson.id && x.status === 'pending',
              ).length
              return (
                <TR key={lesson.id}>
                  <TD className="whitespace-nowrap">
                    {formatDate(lesson.date)}
                    <SubText>
                      {lesson.startTime}–{lesson.endTime}
                    </SubText>
                  </TD>
                  <TD>
                    <Link
                      to={`/attendance/${lesson.id}`}
                      className="font-medium text-slate-900 underline underline-offset-2"
                    >
                      {lesson.title ?? subjects.find((s) => s.id === lesson.subjectId)?.title}
                    </Link>
                    <SubText>
                      {lesson.groupIds
                        .map((id) => groups.find((g) => g.id === id)?.title ?? id)
                        .join(', ')}
                    </SubText>
                  </TD>
                  <TD>{staff.find((p) => p.id === lesson.teacherId)?.fullName ?? '—'}</TD>
                  <TD>
                    <Pill
                      tone={
                        state === 'held'
                          ? 'success'
                          : state === 'unmarked'
                            ? 'danger'
                            : state === 'manual'
                              ? 'warning'
                              : 'neutral'
                      }
                    >
                      {LESSON_STATE_LABEL[state]}
                    </Pill>
                    {pending > 0 ? <SubText>заявок: {pending}</SubText> : null}
                  </TD>
                  <TD align="right">
                    {state === 'held' || state === 'manual' ? (
                      `${c.present} / ${c.late} / ${c.absent}`
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        to={`/attendance/${lesson.id}`}
                        className="text-sm text-slate-700 underline underline-offset-2"
                      >
                        Открыть
                      </Link>
                      {role === 'academ_head' && state === 'unmarked' ? (
                        <ActionLink tone="success" onClick={() => setCounting(lesson.id)}>
                          Засчитать
                        </ActionLink>
                      ) : null}
                    </div>
                  </TD>
                </TR>
              )
            })}
          </tbody>
        </Table>
      )}

      <Modal
        open={counting !== null}
        title="Засчитать занятие"
        onClose={() => setCounting(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCounting(null)}>
              Отмена
            </Button>
            <Button
              variant="primary"
              disabled={reason.trim().length === 0}
              onClick={() => {
                if (counting) {
                  countManually(counting, reason.trim(), 'Академ Хэд', `${today} ${time}`)
                }
                setReason('')
                setCounting(null)
              }}
            >
              Засчитать
            </Button>
          </>
        }
      >
        <Notice tone="neutral">
          Занятие перейдёт в «Засчитано вручную» и попадёт в зарплату. Причина
          обязательна и уйдёт в журнал действий.
        </Notice>
        <div className="mt-3">
          <Field label="Причина">
            <TextInput
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Например: урок был, преподаватель забыл открыть отметку"
              autoFocus
            />
          </Field>
        </div>
      </Modal>
    </>
  )
}
