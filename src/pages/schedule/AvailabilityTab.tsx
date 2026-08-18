import { useMemo, useRef, useState } from 'react'
import { Card, CardTitle, EmptyState, Notice } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { Pill } from '../../ui/Pill'
import { WeekGrid } from '../../ui/WeekGrid'
import { useDataStore } from '../../store/useDataStore'
import { useSessionStore } from '../../store/useSessionStore'
import {
  availabilityOf,
  cellKey,
  outsideAvailabilitySlots,
} from '../../lib/availability'
import { weekDays } from '../../lib/calendar'
import { formatDate, WEEKDAY_LONG } from '../../lib/date'
import { countLabel } from '../../lib/format'
import type { Weekday } from '../../data/types'

/**
 * §1–§6 — the weekly template, painted by dragging, plus the list of lessons
 * that fall outside it and the request that replaces a WhatsApp message.
 */
export function AvailabilityTab() {
  const availability = useDataStore((s) => s.availability)
  const lessons = useDataStore((s) => s.lessons)
  const groups = useDataStore((s) => s.groups)
  const subjects = useDataStore((s) => s.subjects)
  const setAvailability = useDataStore((s) => s.setAvailability)
  const requests = useDataStore((s) => s.reshuffleRequests)
  const requestReshuffle = useDataStore((s) => s.requestReshuffle)

  const actorId = useSessionStore((s) => s.actorId)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)

  const stored = useMemo(
    () => (actorId ? availabilityOf(availability, actorId) : new Set<string>()),
    [availability, actorId],
  )

  const [draft, setDraft] = useState<Set<string>>(stored)
  const [dirty, setDirty] = useState(false)
  // Painting adds cells when it starts on an empty one and erases otherwise.
  const painting = useRef<'add' | 'remove' | null>(null)

  const days = weekDays(today)

  const apply = (weekday: Weekday, timeCell: string, mode: 'add' | 'remove') => {
    setDraft((prev) => {
      const next = new Set(prev)
      const key = cellKey(weekday, timeCell)
      if (mode === 'add') next.add(key)
      else next.delete(key)
      return next
    })
    setDirty(true)
  }

  const mySlots = useMemo(
    () =>
      actorId
        ? outsideAvailabilitySlots(
            [{ teacherId: actorId, cells: [...draft] }],
            lessons.filter((l) => l.teacherId === actorId),
            today,
          )
        : [],
    [actorId, draft, lessons, today],
  )

  const titleOf = (ids: string[]) =>
    ids.map((id) => groups.find((g) => g.id === id)?.title ?? id).join(', ')

  return (
    <>
      <Card className="mb-4">
        <CardTitle
          hint={
            dirty ? (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDraft(stored)
                    setDirty(false)
                  }}
                >
                  Отменить
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    if (actorId) setAvailability(actorId, [...draft])
                    setDirty(false)
                  }}
                >
                  Сохранить
                </Button>
              </div>
            ) : (
              <span className="text-sm text-slate-500">
                {countLabel(draft.size, 'слот', 'слота', 'слотов')} по 30 минут
              </span>
            )
          }
        >
          Моя доступность
        </CardTitle>

        <div className="mb-3">
          <Notice tone="info">
            Отметьте протягиванием мыши, когда готовы вести. Это шаблон на каждую
            неделю, без дат. Он ничего не запрещает — академический директор может
            поставить занятие и вне него, но увидит, что оно выбивается.
          </Notice>
        </div>

        <WeekGrid
          days={days}
          blocks={[]}
          background={draft}
          todayIso={today}
          nowTime={time}
          onCellMouseDown={(weekday, cell) => {
            const mode = draft.has(cellKey(weekday, cell)) ? 'remove' : 'add'
            painting.current = mode
            apply(weekday, cell, mode)
          }}
          onCellMouseEnter={(weekday, cell) => {
            if (painting.current) apply(weekday, cell, painting.current)
          }}
          onMouseUp={() => {
            painting.current = null
          }}
        />
      </Card>

      <Card>
        <CardTitle hint={countLabel(mySlots.length, 'слот', 'слота', 'слотов')}>
          Занятия вне доступности
        </CardTitle>

        {mySlots.length === 0 ? (
          <EmptyState>
            Всё в порядке — занятий вне вашей доступности нет.
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {mySlots.map((slot) => {
              const existing = requests.find(
                (r) => r.lessonId === slot.lessons[0].id && r.teacherId === actorId,
              )
              return (
                <div
                  key={slot.key}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-line px-3 py-2"
                >
                  <span className="text-sm font-medium text-slate-900">
                    {WEEKDAY_LONG[slot.weekday]} {slot.startTime}–{slot.endTime}
                  </span>
                  <span className="text-sm text-slate-700">
                    {titleOf(slot.groupIds)} ·{' '}
                    {subjects.find((s) => s.id === slot.subjectId)?.title ?? ''}
                  </span>
                  <span className="text-xs text-slate-500">
                    ближайшее {formatDate(slot.lessons[0].date)}, всего{' '}
                    {slot.lessons.length}
                  </span>
                  <div className="ml-auto">
                    {existing ? (
                      <Pill tone="warning">Перестановка запрошена</Pill>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          actorId &&
                          requestReshuffle(
                            actorId,
                            slot.lessons[0].id,
                            `${WEEKDAY_LONG[slot.weekday]} ${slot.startTime}–${slot.endTime} вне доступности`,
                            `${today} ${time}`,
                          )
                        }
                      >
                        Запросить перестановку
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </>
  )
}
