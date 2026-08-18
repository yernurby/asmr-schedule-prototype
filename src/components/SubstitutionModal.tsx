import { useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Select, TextInput } from '../ui/Field'
import { Notice } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import { findConflicts } from '../lib/lessons'
import { reasonDeadline, limitState, tallyFor } from '../lib/events'
import { teachersForSubject } from '../lib/subjects'
import { formatDate } from '../lib/date'
import { monthOf } from '../lib/lessons'
import { REASON_CATEGORIES, type Lesson, type ScheduleEvent } from '../data/types'

/**
 * §1–§4, §26 — ask for a stand-in. Candidates who teach the subject and are free
 * come first, everyone else after, each labelled busy or free. The request only
 * takes effect once accepted, and going over the limit does not block it — it
 * just routes it through the director.
 */
export function SubstitutionModal({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const staff = useDataStore((s) => s.staff)
  const lessons = useDataStore((s) => s.lessons)
  const events = useDataStore((s) => s.scheduleEvents)
  const limits = useDataStore((s) => s.limits)
  const request = useDataStore((s) => s.requestSubstitution)

  const actorId = useSessionStore((s) => s.actorId)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)
  const at = `${today} ${time}`
  const now = Date.parse(`${today}T${time}:00`)

  const [substituteId, setSubstituteId] = useState('')
  const [later, setLater] = useState(false)
  const [category, setCategory] = useState<string>(REASON_CATEGORIES[0])
  const [reason, setReason] = useState('')

  const candidates = useMemo(() => {
    const knows = teachersForSubject(staff, lesson.subjectId).map((t) => t.id)
    return staff
      .filter((p) => p.roles.includes('teacher') && p.id !== lesson.teacherId)
      .map((p) => {
        const busy = findConflicts(lessons, {
          date: lesson.date,
          startTime: lesson.startTime,
          endTime: lesson.endTime,
          teacherIds: [p.id],
          groupIds: [],
        }).length > 0
        return { person: p, knows: knows.includes(p.id), busy }
      })
      // §2 — subject first, free first.
      .sort(
        (a, b) =>
          Number(b.knows) - Number(a.knows) ||
          Number(a.busy) - Number(b.busy) ||
          a.person.fullName.localeCompare(b.person.fullName),
      )
  }, [staff, lessons, lesson])

  const tally = actorId ? tallyFor(events, actorId, monthOf(today), now) : null
  const state = tally ? limitState(tally, limits) : 'ok'
  const overLimit = state === 'over' || state === 'edge'

  const canSave = substituteId.length > 0 && (later || reason.trim().length > 0)

  const save = () => {
    if (!canSave || !actorId) return
    const event: ScheduleEvent = {
      id: `se-${Date.now()}`,
      type: 'substitution',
      lessonId: lesson.id,
      initiatorId: actorId,
      createdAt: at,
      substituteId,
      requestStatus: 'pending',
      respondedAt: null,
      overLimit,
      fromDate: null,
      fromStartTime: null,
      fromEndTime: null,
      toDate: null,
      toStartTime: null,
      toEndTime: null,
      reason: later ? null : reason.trim(),
      reasonCategory: later ? null : category,
      reasonFileName: null,
      reasonDueAt: reasonDeadline(at),
      verdict: null,
      verdictComment: null,
      verdictBy: null,
      verdictAt: null,
    }
    request(event)
    onClose()
  }

  return (
    <Modal
      open
      title="Нужна замена"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={save} disabled={!canSave}>
            Отправить запрос
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-700">
        {formatDate(lesson.date)}, {lesson.startTime}–{lesson.endTime}
      </p>

      <div className="space-y-3">
        <div>
          <div className="mb-1.5 text-sm text-slate-700">Кто заменит</div>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-card border border-line-input p-2">
            {candidates.map(({ person, knows, busy }) => (
              <label
                key={person.id}
                className="flex cursor-pointer items-center gap-2 rounded-card px-2 py-1 hover:bg-page"
              >
                <input
                  type="radio"
                  name="substitute"
                  checked={substituteId === person.id}
                  onChange={() => setSubstituteId(person.id)}
                />
                <span className="text-sm text-slate-800">{person.fullName}</span>
                {knows ? <Pill tone="neutral">ведёт предмет</Pill> : null}
                {busy ? <Pill tone="warning">занят</Pill> : <Pill tone="success">свободен</Pill>}
              </label>
            ))}
          </div>
        </div>

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
            На объяснение есть 48 часов. Если причины не будет, замена
            автоматически станет неуважительной.
          </Notice>
        )}

        {overLimit ? (
          <div className="rounded-card bg-red-100 px-3 py-2 text-sm text-rose-700">
            {state === 'over'
              ? 'Лимит неуважительных замен на месяц исчерпан.'
              : 'Вы на границе лимита неуважительных замен.'}{' '}
            Замену всё равно можно создать — она уйдёт на подтверждение
            академическому директору и будет подсвечена в реестре.
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
