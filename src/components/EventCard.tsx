import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/Field'
import { Notice } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import { effectiveVerdict, limitState, LIMIT_LABEL, tallyFor } from '../lib/events'
import { stamp } from '../lib/attendance'
import { formatDate } from '../lib/date'
import { monthOf } from '../lib/lessons'
import {
  EVENT_TYPE_LABEL,
  VERDICT_LABEL,
  type ScheduleEvent,
  type Verdict,
} from '../data/types'

/**
 * §31–§33 — one card per event. Not a ticket: the whole action is a single
 * verdict click. But files and comments do not fit a table row, hence a card.
 * §32 — "сохранить и открыть следующее" keeps the queue moving.
 */
export function EventCard({
  event,
  queue,
  onClose,
  onNext,
}: {
  event: ScheduleEvent
  queue: string[]
  onClose: () => void
  onNext: (id: string) => void
}) {
  const lessons = useDataStore((s) => s.lessons)
  const groups = useDataStore((s) => s.groups)
  const staff = useDataStore((s) => s.staff)
  const subjects = useDataStore((s) => s.subjects)
  const events = useDataStore((s) => s.scheduleEvents)
  const limits = useDataStore((s) => s.limits)
  const setVerdict = useDataStore((s) => s.setEventVerdict)

  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)
  const now = stamp(today, time)

  const [comment, setComment] = useState(event.verdictComment ?? '')

  const lesson = lessons.find((l) => l.id === event.lessonId)
  const nameOf = (id: string | null) =>
    id ? (staff.find((p) => p.id === id)?.fullName ?? id) : '—'

  const tally = tallyFor(events, event.initiatorId, monthOf(today), now)
  const state = limitState(tally, limits)
  const current = effectiveVerdict(event, now)

  const remaining = queue.filter((id) => id !== event.id)

  const apply = (verdict: Verdict, goNext: boolean) => {
    setVerdict(event.id, verdict, comment.trim(), 'Академ Хэд', `${today} ${time}`)
    if (goNext && remaining.length > 0) {
      setComment('')
      onNext(remaining[0])
    } else {
      onClose()
    }
  }

  return (
    <Modal
      open
      title={`${EVENT_TYPE_LABEL[event.type]} · ${lesson ? formatDate(lesson.date) : ''}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={() => apply('deferred', false)}>
            Отложить
          </Button>
          <Button variant="danger" onClick={() => apply('invalid', false)}>
            Неуважительная
          </Button>
          <Button variant="success" onClick={() => apply('valid', false)}>
            Уважительная
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <Row label="Преподаватель" value={nameOf(event.initiatorId)} />
          <Row
            label={event.type === 'substitution' ? 'Заменяющий' : 'Новое время'}
            value={
              event.type === 'substitution'
                ? nameOf(event.substituteId)
                : `${event.toDate ? formatDate(event.toDate) : ''} ${event.toStartTime}–${event.toEndTime}`
            }
          />
          <Row
            label="Занятие"
            value={
              lesson
                ? `${subjects.find((s) => s.id === lesson.subjectId)?.title ?? ''} · ${lesson.groupIds
                    .map((id) => groups.find((g) => g.id === id)?.title ?? id)
                    .join(', ')}`
                : '—'
            }
          />
          <Row label="Создано" value={event.createdAt} />
        </div>

        <div>
          <div className="text-slate-500">Причина</div>
          {event.reason ? (
            <>
              <div className="text-slate-800">{event.reason}</div>
              {event.reasonCategory ? (
                <div className="mt-1">
                  <Pill tone="neutral">{event.reasonCategory}</Pill>
                </div>
              ) : null}
              {event.reasonFileName ? (
                <div className="mt-1 text-xs text-slate-600 underline underline-offset-2">
                  📎 {event.reasonFileName}
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-rose-700">
              Без объяснения. Срок был до {event.reasonDueAt}.
            </div>
          )}
        </div>

        <div className="rounded-card bg-page px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            За {monthOf(today)} у преподавателя
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span>
              Замены: {tally.substitutionInvalid} неув. / {tally.substitutionValid} ув.
            </span>
            <span className="text-slate-400">·</span>
            <span>
              Переносы: {tally.transferInvalid} неув. / {tally.transferValid} ув.
            </span>
            <Pill tone={state === 'over' ? 'danger' : state === 'edge' ? 'warning' : 'success'}>
              {LIMIT_LABEL[state]}
            </Pill>
          </div>
          {tally.unresolved > 0 ? (
            <div className="mt-1 text-xs text-slate-500">
              Не размечено: {tally.unresolved} — пока не считаются никуда.
            </div>
          ) : null}
        </div>

        {current ? (
          <Notice tone="neutral">
            Текущая разметка: {VERDICT_LABEL[current]}
            {event.verdict ? ` · ${event.verdictBy}, ${event.verdictAt}` : ' · автоматически'}
          </Notice>
        ) : null}

        <Field label="Комментарий" hint="Его увидит преподаватель.">
          <TextInput value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>

        {remaining.length > 0 ? (
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <Button variant="primary" onClick={() => apply('valid', true)}>
              Уважительная и следующее
            </Button>
            <Button variant="secondary" onClick={() => apply('invalid', true)}>
              Неуважительная и следующее
            </Button>
            <span className="self-center text-xs text-slate-500">
              в очереди ещё {remaining.length}
            </span>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <div className="text-slate-800">{value}</div>
    </div>
  )
}
