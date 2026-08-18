import { useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/Field'
import { Notice } from '../ui/Card'
import { makeLessonIdFactory, useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import { isMonthFrozen, monthOf, planScheduleChange } from '../lib/lessons'
import { formatDate, formatMonth } from '../lib/date'
import { countLabel } from '../lib/format'
import type { Group, ScheduleRow } from '../data/types'

/**
 * §22–§26 — the most dangerous operation in the module.
 *
 * Nothing happens until the director names the date the change takes effect,
 * sees how many lessons will be removed and created, and confirms. Lessons
 * before that date are never touched (§23); a closed payroll month is refused
 * outright (§24); lessons that already carry a substitution are listed and the
 * director decides what to do with them (§25).
 */
export function ScheduleChangeModal({
  group,
  nextSchedule,
  onCancel,
  onDone,
}: {
  group: Group
  nextSchedule: ScheduleRow[]
  onCancel: () => void
  onDone: () => void
}) {
  const lessons = useDataStore((s) => s.lessons)
  const frozenMonths = useDataStore((s) => s.frozenMonths)
  const applyScheduleChange = useDataStore((s) => s.applyScheduleChange)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)

  const [effectiveFrom, setEffectiveFrom] = useState(today)
  const [keepAffected, setKeepAffected] = useState(true)

  const frozen = isMonthFrozen(frozenMonths, effectiveFrom)

  const plan = useMemo(
    () =>
      planScheduleChange(
        lessons,
        group,
        nextSchedule,
        effectiveFrom,
        makeLessonIdFactory(lessons),
      ),
    [lessons, group, nextSchedule, effectiveFrom],
  )

  // A kept substitution already occupies that day for that subject, so the new
  // schedule must not add a second lesson next to it — even if the time moved.
  const kept = keepAffected ? plan.affected : []
  const keptSlots = new Set(kept.map((l) => `${l.date} ${l.subjectId}`))
  const toCreate = plan.toCreate.filter(
    (l) => !keptSlots.has(`${l.date} ${l.subjectId}`),
  )
  const deleteIds = [
    ...plan.toDelete.map((l) => l.id),
    ...(keepAffected ? [] : plan.affected.map((l) => l.id)),
  ]

  const summary =
    `Удалено ${deleteIds.length}, создано ${toCreate.length}, ` +
    `затронуто с заменами ${plan.affected.length}`

  return (
    <Modal
      open
      title="Изменение расписания"
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
          <Button
            variant="primary"
            disabled={frozen}
            onClick={() => {
              applyScheduleChange(
                group.id,
                nextSchedule,
                effectiveFrom,
                deleteIds,
                toCreate,
                'Академ Хэд',
                `${today} ${time}`,
                summary,
              )
              onDone()
            }}
          >
            Применить изменения
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-700">
        Группа {group.title}. Расписание изменено — укажите, с какого числа новое
        расписание вступает в силу.
      </p>

      <Field
        label="Действует с"
        hint="Всё, что раньше этой даты, останется как есть — вместе с посещаемостью и заменами."
      >
        <TextInput
          type="date"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
        />
      </Field>

      {frozen ? (
        <div className="mt-3 rounded-card bg-red-100 px-3 py-2 text-sm text-rose-700">
          <div className="font-medium">
            {formatMonth(monthOf(effectiveFrom))} закрыт по зарплате
          </div>
          Изменение с этой даты не пропускается: выплаты за закрытый месяц уже
          согласованы, и задним числом они поедут. Выберите дату в открытом месяце.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <Notice tone="info">
            Будет удалено <strong>{deleteIds.length}</strong>, создано{' '}
            <strong>{toCreate.length}</strong>, затронуто с заменами{' '}
            <strong>{plan.affected.length}</strong>. Не тронуто занятий до этой даты:{' '}
            {plan.untouched}.
          </Notice>

          {plan.affected.length > 0 ? (
            <div className="rounded-card bg-amber-100 px-3 py-2 text-sm text-amber-700">
              <div className="font-medium">
                {countLabel(plan.affected.length, 'занятие', 'занятия', 'занятий')} с
                оформленной заменой
              </div>
              <ul className="mt-1 space-y-0.5">
                {plan.affected.slice(0, 6).map((l) => (
                  <li key={l.id}>
                    {formatDate(l.date)} {l.startTime}–{l.endTime}
                  </li>
                ))}
                {plan.affected.length > 6 ? (
                  <li>…и ещё {plan.affected.length - 6}</li>
                ) : null}
              </ul>

              <div className="mt-2 space-y-1">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={keepAffected}
                    onChange={() => setKeepAffected(true)}
                  />
                  <span>Оставить как есть — замена сохранится</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!keepAffected}
                    onChange={() => setKeepAffected(false)}
                  />
                  <span>Удалить вместе с остальными</span>
                </label>
              </div>
            </div>
          ) : null}

          <p className="text-xs text-slate-500">
            Изменение попадёт в журнал действий: кто, когда и с какой даты.
          </p>
        </div>
      )}
    </Modal>
  )
}
