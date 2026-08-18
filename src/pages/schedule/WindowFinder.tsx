import { useMemo, useState } from 'react'
import { Card, CardTitle, EmptyState, Notice } from '../../ui/Card'
import { Checkbox, Field, Select } from '../../ui/Field'
import { Pill } from '../../ui/Pill'
import { useDataStore } from '../../store/useDataStore'
import { useSessionStore } from '../../store/useSessionStore'
import { buildVariants, findWindows } from '../../lib/availability'
import { WEEKDAY_SHORT } from '../../lib/date'
import { allTeachers } from '../../lib/subjects'

const DURATIONS = [60, 90, 120]

/**
 * §24 — the part that turns the calendar from a report into a tool: pick the
 * teachers, say how many lessons a week and how long, and see where their free
 * time actually overlaps. Variants with clashes are offered too, but labelled.
 */
export function WindowFinder() {
  const staff = useDataStore((s) => s.staff)
  const availability = useDataStore((s) => s.availability)
  const lessons = useDataStore((s) => s.lessons)
  const groups = useDataStore((s) => s.groups)
  const today = useSessionStore((s) => s.today)

  const teachers = allTeachers(staff)
  const [picked, setPicked] = useState<string[]>([])
  const [perWeek, setPerWeek] = useState(3)
  const [duration, setDuration] = useState(90)

  const variants = useMemo(() => {
    const candidates = findWindows(availability, lessons, picked, duration, today)
    return buildVariants(candidates, perWeek)
  }, [availability, lessons, picked, duration, perWeek, today])

  const noTemplate = picked.filter(
    (id) => !availability.some((a) => a.teacherId === id && a.cells.length > 0),
  )

  return (
    <Card>
      <CardTitle>Подбор окна для новой группы</CardTitle>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <div className="mb-1.5 text-sm text-slate-700">Преподаватели</div>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-card border border-line-input p-2">
            {teachers.map((t) => (
              <Checkbox
                key={t.id}
                checked={picked.includes(t.id)}
                onChange={(on) =>
                  setPicked(on ? [...picked, t.id] : picked.filter((x) => x !== t.id))
                }
                label={t.fullName}
              />
            ))}
          </div>
        </div>

        <Field label="Занятий в неделю">
          <Select value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Длительность">
          <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d === 60 ? '1 ч' : d === 90 ? '1,5 ч' : '2 ч'}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-4">
        {picked.length === 0 ? (
          <EmptyState>Выберите хотя бы одного преподавателя.</EmptyState>
        ) : noTemplate.length > 0 ? (
          <Notice tone="neutral">
            У {noTemplate.length === 1 ? 'преподавателя' : 'преподавателей'}{' '}
            {noTemplate.map((id) => staff.find((p) => p.id === id)?.fullName).join(', ')}{' '}
            не размечена доступность — пересечение посчитать нечем.
          </Notice>
        ) : variants.length === 0 ? (
          <Notice tone="neutral">
            Общего окна такой длительности нет. Попробуйте другую длительность или
            меньше занятий в неделю.
          </Notice>
        ) : (
          <div className="space-y-2">
            {variants.map((v, i) => (
              <div
                key={i}
                className="rounded-card border border-line px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">
                    {v.slots[0].startTime}–{v.slots[0].endTime}
                  </span>
                  {v.slots.map((s) => (
                    <Pill key={s.weekday} tone="neutral">
                      {WEEKDAY_SHORT[s.weekday]}
                    </Pill>
                  ))}
                  {v.conflictCount === 0 ? (
                    <Pill tone="success">свободно</Pill>
                  ) : (
                    <Pill tone="warning">конфликтов: {v.conflictCount}</Pill>
                  )}
                </div>

                {v.conflictCount > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                    {v.slots
                      .filter((s) => s.conflicts.length > 0)
                      .slice(0, 4)
                      .map((s) => {
                        const first = s.conflicts[0]
                        const gTitle = groups.find((g) => g.id === first.groupIds[0])?.title
                        return (
                          <li key={s.weekday}>
                            {WEEKDAY_SHORT[s.weekday]}: занято — {gTitle ?? 'занятие'}
                            {s.conflicts.length > 1 ? ` и ещё ${s.conflicts.length - 1}` : ''}
                          </li>
                        )
                      })}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
