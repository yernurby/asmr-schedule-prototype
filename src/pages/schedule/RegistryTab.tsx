import { useMemo, useState } from 'react'
import { Card, CardTitle, EmptyState, StatCard } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { Pill } from '../../ui/Pill'
import { Field, Select, TextInput } from '../../ui/Field'
import { SubText, Table, TD, TH, THead, TR } from '../../ui/Table'
import { EventCard } from '../../components/EventCard'
import { useDataStore } from '../../store/useDataStore'
import { useSessionStore } from '../../store/useSessionStore'
import {
  effectiveRequestStatus,
  effectiveVerdict,
  needsVerdict,
  reasonOverdue,
} from '../../lib/events'
import { stamp } from '../../lib/attendance'
import { formatDate } from '../../lib/date'
import { monthOf } from '../../lib/lessons'
import { EVENT_TYPE_LABEL, VERDICT_LABEL, type ScheduleEvent } from '../../data/types'

/** §27–§34 — the director's working queue and the whole register. */
export function RegistryTab() {
  const events = useDataStore((s) => s.scheduleEvents)
  const lessons = useDataStore((s) => s.lessons)
  const staff = useDataStore((s) => s.staff)
  const groups = useDataStore((s) => s.groups)
  const courses = useDataStore((s) => s.courses)
  const limits = useDataStore((s) => s.limits)
  const setLimits = useDataStore((s) => s.setLimits)

  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)
  const now = stamp(today, time)

  const [month, setMonth] = useState(monthOf(today))
  const [teacherId, setTeacherId] = useState('all')
  const [courseId, setCourseId] = useState('all')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const lessonOf = (e: ScheduleEvent) => lessons.find((l) => l.id === e.lessonId)
  const nameOf = (id: string | null) =>
    id ? (staff.find((p) => p.id === id)?.fullName ?? id) : '—'

  const rows = useMemo(() => {
    return events
      .filter((e) => (month ? e.createdAt.slice(0, 7) === month : true))
      .filter((e) => (teacherId === 'all' ? true : e.initiatorId === teacherId))
      .filter((e) => (type === 'all' ? true : e.type === type))
      .filter((e) => {
        if (courseId === 'all') return true
        const lesson = lessonOf(e)
        return lesson
          ? lesson.groupIds.some(
              (id) => groups.find((g) => g.id === id)?.courseId === courseId,
            )
          : false
      })
      .filter((e) => {
        if (status === 'all') return true
        if (status === 'pending') return needsVerdict(e)
        if (status === 'overdue') return needsVerdict(e) && reasonOverdue(e, now)
        return effectiveVerdict(e, now) === status
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [events, month, teacherId, type, status, courseId, groups, lessons, now])

  const queue = events.filter((e) => needsVerdict(e))
  const overdue = queue.filter((e) => reasonOverdue(e, now))
  const openEvent = events.find((e) => e.id === openId) ?? null
  const queueIds = queue.map((e) => e.id)

  /** §34 — the register, straight into a spreadsheet. */
  const exportCsv = () => {
    const head = ['Дата занятия', 'Тип', 'Преподаватель', 'Занятие', 'Куда/кто', 'Причина', 'Разметка']
    const body = rows.map((e) => {
      const lesson = lessonOf(e)
      return [
        lesson ? `${lesson.date} ${lesson.startTime}` : '',
        EVENT_TYPE_LABEL[e.type],
        nameOf(e.initiatorId),
        lesson ? lesson.groupIds.map((id) => groups.find((g) => g.id === id)?.title).join(' / ') : '',
        e.type === 'substitution' ? nameOf(e.substituteId) : `${e.toDate} ${e.toStartTime}`,
        e.reason ?? 'без объяснения',
        effectiveVerdict(e, now) ? VERDICT_LABEL[effectiveVerdict(e, now)!] : 'не размечено',
      ]
    })
    const csv = [head, ...body]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `registry-${month}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Требуют разметки" value={queue.length} hint="Очередь на сегодня" />
        <StatCard label="Просрочено 48 ч" value={overdue.length} hint="Без объяснения" />
        <StatCard label="Всего событий" value={events.length} />
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Лимиты в месяц
          </div>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={limits.substitutionsPerMonth}
              onChange={(e) =>
                setLimits({ ...limits, substitutionsPerMonth: Number(e.target.value) })
              }
              className="h-[30px] w-14 rounded-card border border-line-input px-2 text-sm"
              aria-label="Лимит замен"
            />
            <span className="text-xs text-slate-500">замен</span>
            <input
              type="number"
              min={0}
              value={limits.transfersPerMonth}
              onChange={(e) =>
                setLimits({ ...limits, transfersPerMonth: Number(e.target.value) })
              }
              className="h-[30px] w-14 rounded-card border border-line-input px-2 text-sm"
              aria-label="Лимит переносов"
            />
            <span className="text-xs text-slate-500">переносов</span>
          </div>
        </Card>
      </div>

      {overdue.length > 0 ? (
        <div className="mb-4 rounded-card bg-red-100 px-3 py-2 text-sm text-rose-700">
          {overdue.length} событий без объяснения дольше 48 часов — они уже считаются
          неуважительными, но разметку можно изменить.
        </div>
      ) : null}

      <Card className="mb-4">
        <CardTitle
          hint={
            <Button variant="secondary" onClick={exportCsv}>
              Выгрузить в Excel
            </Button>
          }
        >
          Фильтры
        </CardTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <Field label="Месяц">
            <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
          <Field label="Преподаватель">
            <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="all">Все</option>
              {staff
                .filter((p) => p.roles.includes('teacher'))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Курс">
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="all">Все</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Тип">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">Любой</option>
              <option value="substitution">Замена</option>
              <option value="transfer">Перенос</option>
              <option value="shift">Сдвиг</option>
            </Select>
          </Field>
          <Field label="Разметка">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Любая</option>
              <option value="pending">Не размечено</option>
              <option value="overdue">Просрочено</option>
              <option value="valid">Уважительная</option>
              <option value="invalid">Неуважительная</option>
            </Select>
          </Field>
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState>Событий по такому фильтру нет.</EmptyState>
        </Card>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Занятие</TH>
              <TH>Тип</TH>
              <TH>Преподаватель</TH>
              <TH>Кто заменил / куда перенесли</TH>
              <TH>Причина</TH>
              <TH>Разметка</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((e) => {
              const lesson = lessonOf(e)
              const verdict = effectiveVerdict(e, now)
              const late = reasonOverdue(e, now)
              const reqStatus = effectiveRequestStatus(e, lesson, now)
              return (
                <TR key={e.id} highlighted={e.overLimit === true}>
                  <TD>
                    <button
                      type="button"
                      onClick={() => setOpenId(e.id)}
                      className="font-medium text-slate-900 underline underline-offset-2"
                    >
                      {lesson ? formatDate(lesson.date) : '—'}
                    </button>
                    <SubText>
                      {lesson ? `${lesson.startTime}–${lesson.endTime}` : ''} ·{' '}
                      {lesson?.groupIds
                        .map((id) => groups.find((g) => g.id === id)?.title ?? id)
                        .join(', ')}
                    </SubText>
                  </TD>
                  <TD>
                    <Pill tone={e.type === 'shift' ? 'neutral' : 'info'}>
                      {EVENT_TYPE_LABEL[e.type]}
                    </Pill>
                    {e.overLimit ? <SubText>сверх лимита</SubText> : null}
                  </TD>
                  <TD>{nameOf(e.initiatorId)}</TD>
                  <TD>
                    {e.type === 'substitution' ? (
                      <>
                        {nameOf(e.substituteId)}
                        <SubText>
                          {reqStatus === 'pending'
                            ? 'ждёт подтверждения'
                            : reqStatus === 'accepted'
                              ? 'подтверждено'
                              : reqStatus === 'declined'
                                ? 'отказ'
                                : reqStatus === 'escalated'
                                  ? 'молчит — ушло директору'
                                  : ''}
                        </SubText>
                      </>
                    ) : (
                      <>
                        {e.toDate ? formatDate(e.toDate) : '—'} {e.toStartTime}–{e.toEndTime}
                        {e.needsApproval ? <SubText>нужно подтверждение</SubText> : null}
                      </>
                    )}
                  </TD>
                  <TD>
                    {e.reason ?? (
                      <span className={late ? 'text-rose-700' : 'text-slate-400'}>
                        без объяснения
                      </span>
                    )}
                    {e.reasonCategory ? <SubText>{e.reasonCategory}</SubText> : null}
                  </TD>
                  <TD>
                    {verdict ? (
                      <Pill tone={verdict === 'valid' ? 'success' : 'danger'}>
                        {VERDICT_LABEL[verdict]}
                      </Pill>
                    ) : (
                      <Pill tone="warning">Не размечено</Pill>
                    )}
                    {!e.verdict && late ? <SubText>авто, 48 ч вышли</SubText> : null}
                  </TD>
                </TR>
              )
            })}
          </tbody>
        </Table>
      )}

      {openEvent ? (
        <EventCard
          event={openEvent}
          queue={queueIds}
          onClose={() => setOpenId(null)}
          onNext={(id) => setOpenId(id)}
        />
      ) : null}
    </>
  )
}
