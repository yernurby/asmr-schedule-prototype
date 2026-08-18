import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Select, TextInput } from '../ui/Field'
import { Notice } from '../ui/Card'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import { checkTransfer, reasonDeadline } from '../lib/events'
import { formatDate } from '../lib/date'
import { REASON_CATEGORIES, type Lesson, type ScheduleEvent } from '../data/types'

/**
 * §14–§17, §19 — a transfer the teacher makes themselves, so the checks are
 * hard: availability, own conflicts, group conflicts. A move inside the same day
 * is recorded as a shift, which never reaches a counter (§20).
 */
export function TransferModal({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const lessons = useDataStore((s) => s.lessons)
  const groups = useDataStore((s) => s.groups)
  const availability = useDataStore((s) => s.availability)
  const applyTransfer = useDataStore((s) => s.applyTransfer)

  const actorId = useSessionStore((s) => s.actorId)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)
  const at = `${today} ${time}`
  const now = Date.parse(`${today}T${time}:00`)

  const [toDate, setToDate] = useState(lesson.date)
  const [start, setStart] = useState(lesson.startTime)
  const [end, setEnd] = useState(lesson.endTime)
  const [later, setLater] = useState(false)
  const [category, setCategory] = useState<string>(REASON_CATEGORIES[0])
  const [reason, setReason] = useState('')

  const nameOfGroup = (id: string) => groups.find((g) => g.id === id)?.title ?? id
  const check = checkTransfer(lesson, toDate, start, end, availability, lessons, now, nameOfGroup)

  const unchanged =
    toDate === lesson.date && start === lesson.startTime && end === lesson.endTime
  const canSave = check.ok && !unchanged && (later || reason.trim().length > 0)

  const save = () => {
    if (!canSave || !actorId) return
    const event: ScheduleEvent = {
      id: `se-${Date.now()}`,
      // §19 — same calendar day is a shift, not a transfer.
      type: check.isShift ? 'shift' : 'transfer',
      lessonId: lesson.id,
      initiatorId: actorId,
      createdAt: at,
      substituteId: null,
      requestStatus: null,
      respondedAt: null,
      fromDate: lesson.date,
      fromStartTime: lesson.startTime,
      fromEndTime: lesson.endTime,
      toDate,
      toStartTime: start,
      toEndTime: end,
      needsApproval: check.needsApproval,
      approvalStatus: check.needsApproval ? 'pending' : undefined,
      reason: later ? null : reason.trim(),
      reasonCategory: later ? null : category,
      reasonFileName: null,
      reasonDueAt: reasonDeadline(at),
      verdict: null,
      verdictComment: null,
      verdictBy: null,
      verdictAt: null,
    }
    applyTransfer(event)
    onClose()
  }

  return (
    <Modal
      open
      title="Перенести занятие"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={save} disabled={!canSave}>
            {check.isShift ? 'Записать сдвиг' : 'Перенести'}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-700">
        Сейчас: {formatDate(lesson.date)}, {lesson.startTime}–{lesson.endTime}
      </p>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Новая дата">
            <TextInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </Field>
          <Field label="Начало">
            <TextInput type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Конец">
            <TextInput type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>

        {check.problems.length > 0 ? (
          <div className="rounded-card bg-red-100 px-3 py-2 text-sm text-rose-700">
            <div className="font-medium">Перенести нельзя:</div>
            <ul className="mt-1 space-y-0.5">
              {check.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {check.isShift && !unchanged ? (
          <Notice tone="info">
            Это тот же день — запишется как сдвиг. В счётчик переносов он не
            попадёт, но в реестре будет виден.
          </Notice>
        ) : null}

        {check.needsApproval ? (
          <Notice tone="neutral">
            До занятия меньше суток — перенос уйдёт на подтверждение
            академическому директору.
          </Notice>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={later} onChange={(e) => setLater(e.target.checked)} />
          Заполню причину позже
        </label>

        {!later ? (
          <>
            <Field label="Категория причины">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {REASON_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Причина">
              <TextInput
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Коротко, что случилось"
              />
            </Field>
          </>
        ) : (
          <Notice tone="neutral">
            На объяснение есть 48 часов, потом событие само станет неуважительным.
          </Notice>
        )}
      </div>
    </Modal>
  )
}
