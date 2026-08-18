import { useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Checkbox, COMPACT_CONTROL, Field, Select, TextInput } from '../ui/Field'
import { Pill } from '../ui/Pill'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import {
  allCourseSubjects,
  allTeachers,
  courseSubjects,
  groupTeacherIds,
  teachersForSubject,
} from '../lib/subjects'
import { WEEKDAY_SHORT } from '../lib/date'
import { ScheduleChangeModal } from './ScheduleChangeModal'
import { generateGroupLessons } from '../lib/lessons'
import { makeLessonIdFactory } from '../store/useDataStore'
import type { Group, ScheduleRow, Weekday } from '../data/types'

/**
 * Group form with the per-subject schedule (part 1, §8–§12).
 *
 * - rows are grouped by subject and each block folds away (§8)
 * - a row carries weekday, start, end, teacher and a Meet link (§9)
 * - the teacher list starts with people who have that subject ticked, with
 *   "показать всех" as the escape hatch (§10)
 * - a single-subject course gets a plain list with no grouping at all (§11)
 * - "Преподаватели" is read-only and derived from the rows (§12); curators stay
 *   a manual field
 */
export function GroupFormModal({
  group,
  mode = 'edit',
  onClose,
}: {
  group: Group
  /** In create mode nothing is written until "Создать", and the course is still open. */
  mode?: 'create' | 'edit'
  onClose: () => void
}) {
  const courses = useDataStore((s) => s.courses)
  const subjects = useDataStore((s) => s.subjects)
  const staff = useDataStore((s) => s.staff)
  const updateGroup = useDataStore((s) => s.updateGroup)
  const addGroup = useDataStore((s) => s.addGroup)
  const addLessons = useDataStore((s) => s.addLessons)
  const lessons = useDataStore((s) => s.lessons)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)

  const [draft, setDraft] = useState<Group>(group)
  const [pendingSchedule, setPendingSchedule] = useState<ScheduleRow[] | null>(null)

  const course = courses.find((c) => c.id === draft.courseId)
  const live = courseSubjects(subjects, draft.courseId)
  const single = live.length <= 1

  /**
   * Subjects to render: live ones, plus archived ones that still carry rows —
   * otherwise their schedule would become unreachable (§3 allows archiving a
   * subject precisely because its schedule stays).
   */
  const blocks = useMemo(() => {
    const all = allCourseSubjects(subjects, draft.courseId)
    return all.filter(
      (s) => !s.isArchived || draft.schedule.some((r) => r.subjectId === s.id),
    )
  }, [subjects, draft.courseId, draft.schedule])

  const [collapsed, setCollapsed] = useState<string[]>(() => blocks.map((b) => b.id))
  const [showAllFor, setShowAllFor] = useState<string[]>([])

  const curators = staff.filter((p) => p.roles.includes('curator'))
  const derivedTeacherIds = groupTeacherIds(draft)

  const patchRow = (rowId: string, patch: Partial<ScheduleRow>) =>
    setDraft((d) => ({
      ...d,
      schedule: d.schedule.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
    }))

  const addRow = (subjectId: string) =>
    setDraft((d) => {
      const taken = d.schedule.map((r) => r.id)
      let n = taken.length + 1
      while (taken.includes(`sr-${d.id}-${n}`)) n += 1
      const last = [...d.schedule].reverse().find((r) => r.subjectId === subjectId)
      return {
        ...d,
        schedule: [
          ...d.schedule,
          {
            id: `sr-${d.id}-${n}`,
            subjectId,
            weekday: last?.weekday ?? 1,
            startTime: last?.startTime ?? '17:00',
            endTime: last?.endTime ?? '18:30',
            teacherId: last?.teacherId ?? null,
            meetUrl: last?.meetUrl ?? null,
          },
        ],
      }
    })

  const removeRow = (rowId: string) =>
    setDraft((d) => ({ ...d, schedule: d.schedule.filter((r) => r.id !== rowId) }))

  const canSave = draft.title.trim().length > 0 && draft.courseId.length > 0

  const scheduleChanged =
    JSON.stringify(draft.schedule) !== JSON.stringify(group.schedule)

  const save = () => {
    if (!canSave) return
    const next = { ...draft, weeks: weeksBetween(draft.startDate, draft.endDate) }

    if (mode === 'create') {
      // A brand new group has no lessons yet, so part 2 §1 applies directly:
      // save it and generate the whole period at once. No effective date is
      // needed, because there is nothing to preserve.
      addGroup(next)
      const created = generateGroupLessons(next, makeLessonIdFactory(lessons))
      if (created.length > 0) {
        addLessons(
          created,
          'Академ Хэд',
          `${today} ${time}`,
          `Создана группа ${next.title}: занятий ${created.length}`,
        )
      }
      onClose()
      return
    }

    const { id: _id, schedule: _schedule, ...patch } = next
    updateGroup(group.id, patch)

    // §22 — a changed schedule never applies silently; it goes through the
    // effective-date dialog, which owns the lesson rewrite.
    if (scheduleChanged) setPendingSchedule(next.schedule)
    else onClose()
  }

  const renderRow = (row: ScheduleRow) => {
    const preferred = teachersForSubject(staff, row.subjectId)
    const showAll = showAllFor.includes(row.id) || preferred.length === 0
    let options = showAll ? allTeachers(staff) : preferred
    // Always keep the assigned teacher selectable, even if the subject was
    // later unticked on their card.
    if (row.teacherId && !options.some((p) => p.id === row.teacherId)) {
      const assigned = staff.find((p) => p.id === row.teacherId)
      if (assigned) options = [assigned, ...options]
    }

    return (
      <div key={row.id} className="rounded-card border border-line-input p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={row.weekday}
            onChange={(e) =>
              patchRow(row.id, { weekday: Number(e.target.value) as Weekday })
            }
            className={`${COMPACT_CONTROL} w-[72px]`}
            aria-label="День недели"
          >
            {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((d) => (
              <option key={d} value={d}>
                {WEEKDAY_SHORT[d]}
              </option>
            ))}
          </select>

          <input
            type="time"
            value={row.startTime}
            onChange={(e) => patchRow(row.id, { startTime: e.target.value })}
            className={`${COMPACT_CONTROL} w-[96px]`}
            aria-label="Начало"
          />
          <span className="text-sm text-slate-400">–</span>
          <input
            type="time"
            value={row.endTime}
            onChange={(e) => patchRow(row.id, { endTime: e.target.value })}
            className={`${COMPACT_CONTROL} w-[96px]`}
            aria-label="Конец"
          />

          <button
            type="button"
            onClick={() => removeRow(row.id)}
            className="ml-auto text-sm text-red-600 underline underline-offset-2"
          >
            Убрать
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={row.teacherId ?? ''}
            onChange={(e) => patchRow(row.id, { teacherId: e.target.value || null })}
            className={`${COMPACT_CONTROL} min-w-[220px]`}
            aria-label="Преподаватель"
          >
            <option value="">Преподаватель не назначен</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>

          {preferred.length > 0 && !showAllFor.includes(row.id) ? (
            <button
              type="button"
              onClick={() => setShowAllFor((prev) => [...prev, row.id])}
              className="text-xs text-slate-600 underline underline-offset-2"
            >
              показать всех
            </button>
          ) : null}

          {preferred.length === 0 ? (
            <span className="text-xs text-slate-500">
              никто не отметил этот предмет — показаны все
            </span>
          ) : null}
        </div>

        <div className="mt-2">
          <input
            type="url"
            value={row.meetUrl ?? ''}
            onChange={(e) => patchRow(row.id, { meetUrl: e.target.value || null })}
            placeholder="Ссылка на Meet"
            className={`${COMPACT_CONTROL} w-full`}
            aria-label="Ссылка на Meet"
          />
        </div>
      </div>
    )
  }

  return (
    <Modal
      open
      title={mode === 'create' ? 'Создать группу' : 'Редактировать группу'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={save} disabled={!canSave}>
            {mode === 'create' ? 'Создать' : 'Сохранить'}
          </Button>
        </>
      }
    >
      <div className="max-h-[62vh] space-y-4 overflow-y-auto pr-1">
        <Field label="Название">
          <TextInput
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </Field>

        <Field
          label="Курс"
          hint={
            mode === 'create'
              ? 'Расписание задаётся по предметам выбранного курса.'
              : 'Курс группы менять нельзя — расписание привязано к его предметам.'
          }
        >
          {mode === 'create' ? (
            <Select
              value={draft.courseId}
              onChange={(e) =>
                // Switching the course invalidates every row, since rows point
                // at subjects of the previous course.
                setDraft({ ...draft, courseId: e.target.value, schedule: [] })
              }
            >
              <option value="">Выберите курс</option>
              {courses
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
            </Select>
          ) : (
            <Select value={draft.courseId} disabled>
              <option value={draft.courseId}>{course?.title ?? '—'}</option>
            </Select>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата начала">
            <TextInput
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
            />
          </Field>
          <Field label="Дата окончания">
            <TextInput
              type="date"
              value={draft.endDate}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Вместимость">
          <TextInput
            type="number"
            min={1}
            value={draft.capacity}
            onChange={(e) =>
              setDraft({ ...draft, capacity: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </Field>

        {/* ---------------------------------------------------- schedule */}
        <div>
          <div className="mb-1.5 text-sm text-slate-700">Расписание</div>

          {draft.courseId === '' ? (
            <p className="rounded-card bg-muted px-3 py-2 text-sm text-slate-700">
              Сначала выберите курс — расписание задаётся по его предметам.
            </p>
          ) : single ? (
            // §11 — one subject, so no grouping: a plain list, as before part 1.
            <div className="space-y-2">
              {draft.schedule.map(renderRow)}
              <Button
                variant="secondary"
                onClick={() => addRow(live[0]?.id ?? blocks[0]?.id ?? '')}
                disabled={live.length === 0 && blocks.length === 0}
              >
                + Добавить строку
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {blocks.map((subject) => {
                const rows = draft.schedule.filter((r) => r.subjectId === subject.id)
                const isCollapsed = collapsed.includes(subject.id)
                return (
                  <div
                    key={subject.id}
                    className="rounded-card border border-line bg-page"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsed((prev) =>
                          prev.includes(subject.id)
                            ? prev.filter((id) => id !== subject.id)
                            : [...prev, subject.id],
                        )
                      }
                      className="flex w-full items-center gap-2 px-3 py-2 text-left"
                    >
                      <span className="text-xs text-slate-400">
                        {isCollapsed ? '▸' : '▾'}
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        {subject.title}
                      </span>
                      {subject.isArchived ? <Pill tone="neutral">архивный</Pill> : null}
                      <span className="ml-auto text-xs text-slate-500">
                        {rows.length === 0
                          ? 'расписания нет'
                          : rows
                              .map(
                                (r) =>
                                  `${WEEKDAY_SHORT[r.weekday]} ${r.startTime}–${r.endTime}`,
                              )
                              .join(' · ')}
                      </span>
                    </button>

                    {!isCollapsed ? (
                      <div className="space-y-2 border-t border-line bg-surface p-2.5">
                        {rows.map(renderRow)}
                        <Button
                          variant="secondary"
                          onClick={() => addRow(subject.id)}
                          disabled={subject.isArchived}
                        >
                          + Добавить строку
                        </Button>
                        {subject.isArchived ? (
                          <p className="text-xs text-slate-500">
                            Предмет заархивирован — новые строки по нему не добавляются.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* --------------------------------- derived teachers, manual curators */}
        <div>
          <div className="mb-1.5 text-sm text-slate-700">Преподаватели</div>
          <div className="rounded-card border border-line bg-page px-3 py-2">
            {derivedTeacherIds.length === 0 ? (
              <span className="text-sm text-slate-400">
                Никто не назначен — поставьте преподавателей в строках расписания
              </span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {derivedTeacherIds.map((id) => (
                  <Pill key={id} tone="neutral">
                    {staff.find((p) => p.id === id)?.fullName ?? id}
                  </Pill>
                ))}
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Поле считается само из строк расписания и не редактируется — иначе шапка
            и расписание разойдутся, и зарплата посчитается не тому.
          </p>
        </div>

        <div>
          <div className="mb-1.5 text-sm text-slate-700">Кураторы</div>
          <div className="space-y-1.5 rounded-card border border-line-input p-3">
            {curators.map((p) => (
              <Checkbox
                key={p.id}
                checked={draft.curatorIds.includes(p.id)}
                onChange={(next) =>
                  setDraft({
                    ...draft,
                    curatorIds: next
                      ? [...draft.curatorIds, p.id]
                      : draft.curatorIds.filter((id) => id !== p.id),
                  })
                }
                label={p.fullName}
              />
            ))}
          </div>
        </div>

        <Field label="Заметки">
          <TextInput
            value={draft.notes ?? ''}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })}
          />
        </Field>

        <Field label="Ссылка на Telegram-группу">
          <TextInput
            value={draft.telegramUrl ?? ''}
            onChange={(e) => setDraft({ ...draft, telegramUrl: e.target.value || null })}
          />
        </Field>

        <Checkbox
          checked={draft.enrollmentOpen}
          onChange={(next) => setDraft({ ...draft, enrollmentOpen: next })}
          label="Открыт для набора"
          hint="Если отключить, группа скрыта от отдела продаж."
        />
      </div>

      {pendingSchedule ? (
        <ScheduleChangeModal
          group={group}
          nextSchedule={pendingSchedule}
          onCancel={() => setPendingSchedule(null)}
          onDone={() => {
            setPendingSchedule(null)
            onClose()
          }}
        />
      ) : null}
    </Modal>
  )
}

/** Whole weeks covered by the date range, at least 1. */
function weeksBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`).getTime()
  const end = new Date(`${endDate}T00:00:00`).getTime()
  const days = Math.round((end - start) / 86_400_000) + 1
  return Math.max(1, Math.round(days / 7))
}
