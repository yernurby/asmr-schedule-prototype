import { useState } from 'react'
import { Card, CardTitle, EmptyState, Notice } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { Pill } from '../../ui/Pill'
import { Field, Select, TextInput } from '../../ui/Field'
import { useDataStore } from '../../store/useDataStore'
import { useSessionStore } from '../../store/useSessionStore'
import {
  effectiveRequestStatus,
  effectiveVerdict,
  limitState,
  LIMIT_LABEL,
  reasonHoursLeft,
  reasonOverdue,
  tallyFor,
} from '../../lib/events'
import { stamp } from '../../lib/attendance'
import { formatDate } from '../../lib/date'
import { monthOf } from '../../lib/lessons'
import {
  EVENT_TYPE_LABEL,
  REASON_CATEGORIES,
  VERDICT_LABEL,
  type ScheduleEvent,
} from '../../data/types'

/** §4, §7, §13 — the teacher's own side: incoming requests and reason debts. */
export function MyEventsTab() {
  const events = useDataStore((s) => s.scheduleEvents)
  const lessons = useDataStore((s) => s.lessons)
  const staff = useDataStore((s) => s.staff)
  const groups = useDataStore((s) => s.groups)
  const limits = useDataStore((s) => s.limits)
  const answer = useDataStore((s) => s.answerSubstitution)
  const setReason = useDataStore((s) => s.setEventReason)

  const actorId = useSessionStore((s) => s.actorId)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)
  const now = stamp(today, time)

  const [editing, setEditing] = useState<string | null>(null)
  const [category, setCategory] = useState<string>(REASON_CATEGORIES[0])
  const [text, setText] = useState('')
  const [file, setFile] = useState('')

  const lessonOf = (e: ScheduleEvent) => lessons.find((l) => l.id === e.lessonId)
  const nameOf = (id: string | null) =>
    id ? (staff.find((p) => p.id === id)?.fullName ?? id) : '—'
  const groupsOf = (e: ScheduleEvent) =>
    lessonOf(e)
      ?.groupIds.map((id) => groups.find((g) => g.id === id)?.title ?? id)
      .join(', ') ?? ''

  const incoming = events.filter(
    (e) => e.substituteId === actorId && e.requestStatus === 'pending',
  )
  const mine = events.filter((e) => e.initiatorId === actorId)
  const debts = mine.filter((e) => !e.reason)

  const tally = actorId ? tallyFor(events, actorId, monthOf(today), now) : null
  const state = tally ? limitState(tally, limits) : 'ok'

  return (
    <>
      <Card className="mb-4">
        <CardTitle
          hint={
            tally ? (
              <Pill tone={state === 'over' ? 'danger' : state === 'edge' ? 'warning' : 'success'}>
                {LIMIT_LABEL[state]}
              </Pill>
            ) : undefined
          }
        >
          Мои счётчики за {monthOf(today)}
        </CardTitle>
        {tally ? (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700">
            <span>
              Замены: {tally.substitutionInvalid} неув. / {tally.substitutionValid} ув.
              <span className="text-slate-400"> (лимит {limits.substitutionsPerMonth})</span>
            </span>
            <span>
              Переносы: {tally.transferInvalid} неув. / {tally.transferValid} ув.
              <span className="text-slate-400"> (лимит {limits.transfersPerMonth})</span>
            </span>
            {tally.unresolved > 0 ? (
              <span className="text-amber-700">Не размечено: {tally.unresolved}</span>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card className="mb-4">
        <CardTitle hint={`${incoming.length}`}>Запросы на замену — вам</CardTitle>
        {incoming.length === 0 ? (
          <EmptyState>Новых запросов нет.</EmptyState>
        ) : (
          <div className="space-y-2">
            {incoming.map((e) => {
              const lesson = lessonOf(e)
              return (
                <div key={e.id} className="rounded-card border border-line px-3 py-2">
                  <div className="text-sm text-slate-800">
                    {nameOf(e.initiatorId)} просит заменить{' '}
                    {lesson ? formatDate(lesson.date) : ''} {lesson?.startTime}–
                    {lesson?.endTime} · {groupsOf(e)}
                  </div>
                  {e.reason ? (
                    <div className="mt-0.5 text-xs text-slate-500">Причина: {e.reason}</div>
                  ) : null}
                  <div className="mt-2 flex gap-2">
                    <Button variant="success" onClick={() => answer(e.id, true, `${today} ${time}`)}>
                      Согласен заменить
                    </Button>
                    <Button variant="secondary" onClick={() => answer(e.id, false, `${today} ${time}`)}>
                      Не могу
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Пока вы не подтвердите, занятие остаётся за {nameOf(e.initiatorId)}.
                    Если промолчать, запрос уйдёт академическому директору.
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <CardTitle hint={`${debts.length}`}>Нужно объяснить</CardTitle>
        {debts.length === 0 ? (
          <EmptyState>Долгов по объяснениям нет.</EmptyState>
        ) : (
          <div className="space-y-2">
            {debts.map((e) => {
              const lesson = lessonOf(e)
              const late = reasonOverdue(e, now)
              const left = reasonHoursLeft(e, now)
              return (
                <div
                  key={e.id}
                  className={`rounded-card border px-3 py-2 ${late ? 'border-red-200 bg-red-100' : 'border-line'}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="neutral">{EVENT_TYPE_LABEL[e.type]}</Pill>
                    <span className="text-sm text-slate-800">
                      {lesson ? formatDate(lesson.date) : ''} {lesson?.startTime} · {groupsOf(e)}
                    </span>
                    {late ? (
                      <Pill tone="danger">48 часов вышли — считается неуважительной</Pill>
                    ) : (
                      <Pill tone="warning">осталось {left} ч</Pill>
                    )}
                  </div>

                  {editing === e.id ? (
                    <div className="mt-2 space-y-2">
                      <Field label="Категория">
                        <Select value={category} onChange={(ev) => setCategory(ev.target.value)}>
                          {REASON_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Причина">
                        <TextInput value={text} onChange={(ev) => setText(ev.target.value)} />
                      </Field>
                      <Field label="Файл" hint="Например, справка. Достаточно имени файла.">
                        <TextInput
                          value={file}
                          onChange={(ev) => setFile(ev.target.value)}
                          placeholder="spravka.pdf"
                        />
                      </Field>
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          disabled={text.trim().length === 0}
                          onClick={() => {
                            setReason(e.id, text.trim(), category, file.trim() || null)
                            setText('')
                            setFile('')
                            setEditing(null)
                          }}
                        >
                          Сохранить
                        </Button>
                        <Button variant="secondary" onClick={() => setEditing(null)}>
                          Отмена
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <Button variant="secondary" onClick={() => setEditing(e.id)}>
                        Объяснить
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle hint={`${mine.length}`}>Мои замены и переносы</CardTitle>
        {mine.length === 0 ? (
          <EmptyState>Пока ничего нет.</EmptyState>
        ) : (
          <div className="space-y-1.5">
            {mine.map((e) => {
              const lesson = lessonOf(e)
              const verdict = effectiveVerdict(e, now)
              const req = effectiveRequestStatus(e, lesson, now)
              return (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center gap-2 rounded-card border border-line px-3 py-2 text-sm"
                >
                  <Pill tone="neutral">{EVENT_TYPE_LABEL[e.type]}</Pill>
                  <span className="text-slate-800">
                    {lesson ? formatDate(lesson.date) : ''} {lesson?.startTime}
                  </span>
                  {e.type === 'substitution' ? (
                    <span className="text-slate-600">
                      {nameOf(e.substituteId)} ·{' '}
                      {req === 'pending'
                        ? 'ждёт ответа'
                        : req === 'accepted'
                          ? 'подтверждено'
                          : req === 'declined'
                            ? 'отказ — выберите другого'
                            : 'ушло директору'}
                    </span>
                  ) : (
                    <span className="text-slate-600">
                      → {e.toDate ? formatDate(e.toDate) : ''} {e.toStartTime}
                    </span>
                  )}
                  {verdict ? (
                    <Pill tone={verdict === 'valid' ? 'success' : 'danger'}>
                      {VERDICT_LABEL[verdict]}
                    </Pill>
                  ) : (
                    <Pill tone="warning">не размечено</Pill>
                  )}
                  {e.verdictComment ? (
                    <span className="text-xs text-slate-500">{e.verdictComment}</span>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <div className="mt-4">
        <Notice tone="info">
          Замена вступает в силу только после подтверждения заменяющим — занятие
          влияет на деньги двоих. Сдвиг в пределах того же дня в счётчики не идёт.
        </Notice>
      </div>
    </>
  )
}
