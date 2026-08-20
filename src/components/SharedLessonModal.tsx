import { useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Checkbox, COMPACT_CONTROL, Field, Select, TextInput } from '../ui/Field'
import { Notice } from '../ui/Card'
import { makeLessonIdFactory, useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import { findConflicts, seriesOccurrences, type SeriesSlot } from '../lib/lessons'
import { courseSubjects } from '../lib/subjects'
import { addDays, formatDate, WEEKDAY_SHORT } from '../lib/date'
import { countLabel } from '../lib/format'
import {
  LESSON_TYPE_LABEL,
  RECURRENCE_LABEL,
  type Lesson,
  type LessonType,
  type Recurrence,
  type Weekday,
} from '../data/types'

/**
 * §7–§13 — a lesson created outside any single group's schedule: one title, one
 * or more teachers, one or more groups, and a repeat rule. Only the academ
 * director gets here (§11); the caller gates the button.
 */
export function SharedLessonModal({
  defaultGroupId,
  onClose,
}: {
  /** §16 — opening from a group card pre-selects that group. */
  defaultGroupId?: string
  onClose: () => void
}) {
  const groups = useDataStore((s) => s.groups)
  const courses = useDataStore((s) => s.courses)
  const subjects = useDataStore((s) => s.subjects)
  const staff = useDataStore((s) => s.staff)
  const lessons = useDataStore((s) => s.lessons)
  const addLessons = useDataStore((s) => s.addLessons)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)

  const base = groups.find((g) => g.id === defaultGroupId)

  const [title, setTitle] = useState('')
  const [type, setType] = useState<LessonType>('lecture')
  const [courseId, setCourseId] = useState(base?.courseId ?? courses[0]?.id ?? '')
  const [subjectId, setSubjectId] = useState('')
  const [teacherIds, setTeacherIds] = useState<string[]>([])
  const [groupIds, setGroupIds] = useState<string[]>(defaultGroupId ? [defaultGroupId] : [])
  const [date, setDate] = useState(today)
  // §8 — one series can run on several weekdays, each at its own time:
  // Monday at 10:00 and Thursday at 15:00 is one lecture, not two.
  const [slots, setSlots] = useState<SeriesSlot[]>([
    { weekday: 6, startTime: '10:00', endTime: '11:30' },
  ])
  const [recurrence, setRecurrence] = useState<Recurrence>('weekly')
  // Opened from a group card the series runs to that group's end; opened from
  // the calendar there is nothing to inherit, so default to a term ahead rather
  // than to today, which would produce an empty range.
  const [until, setUntil] = useState(base?.endDate ?? addDays(today, 7 * 13))
  const [meetUrl, setMeetUrl] = useState('')
  const [showAllGroups, setShowAllGroups] = useState(false)

  const subjectOptions = courseSubjects(subjects, courseId)
  const teachers = staff.filter((p) => p.roles.includes('teacher'))

  // §12 — groups of the same course come first, but nothing stops a cross-course
  // office hour.
  const groupOptions = showAllGroups
    ? groups.filter((g) => g.status === 'active')
    : groups.filter((g) => g.status === 'active' && g.courseId === courseId)

  const occurrences = useMemo(
    () => seriesOccurrences(slots, date, until, recurrence),
    [slots, date, until, recurrence],
  )

  // §13 — check every planned date, not just the first one.
  const conflicts = useMemo(() => {
    if (teacherIds.length === 0 && groupIds.length === 0) return []
    return occurrences.flatMap((o) =>
      findConflicts(lessons, {
        date: o.date,
        startTime: o.startTime,
        endTime: o.endTime,
        teacherIds,
        groupIds,
      }),
    )
  }, [occurrences, lessons, teacherIds, groupIds])

  const canSave =
    title.trim().length > 0 &&
    subjectId.length > 0 &&
    groupIds.length > 0 &&
    slots.length > 0 &&
    occurrences.length > 0

  const save = () => {
    if (!canSave) return
    const makeId = makeLessonIdFactory(lessons)
    const seriesId = `ser-${Date.parse(`${date}T00:00:00`)}-${lessons.length}`
    const created: Lesson[] = []
    for (const occurrence of occurrences) {
      // One lesson per occurrence; several teachers on one slot become one lesson
      // each, so payroll can attribute the hour to the right person.
      const owners = teacherIds.length > 0 ? teacherIds : [null]
      for (const teacherId of owners) {
        created.push({
          id: makeId(),
          date: occurrence.date,
          startTime: occurrence.startTime,
          endTime: occurrence.endTime,
          subjectId,
          teacherId,
          originalTeacherId: teacherId,
          groupIds,
          type,
          meetUrl: meetUrl.trim() || null,
          state: 'planned',
          title: title.trim(),
          cancelReason: null,
          sourceRowId: null,
          seriesId,
        })
      }
    }
    addLessons(
      created,
      'Академ Хэд',
      `${today} ${time}`,
      `${title.trim()} · ${LESSON_TYPE_LABEL[type]} · ${countLabel(groupIds.length, 'группа', 'группы', 'групп')} · занятий ${created.length}`,
    )
    onClose()
  }

  const toggle = (list: string[], id: string, on: boolean) =>
    on ? [...list, id] : list.filter((x) => x !== id)

  return (
    <Modal
      open
      title="Создать общее занятие"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={save} disabled={!canSave}>
            {conflicts.length > 0 ? 'Всё равно создать' : 'Создать'}
          </Button>
        </>
      }
    >
      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        <Field label="Название" hint="Его увидят преподаватель и студенты.">
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Лекция по математике"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Тип занятия">
            <Select value={type} onChange={(e) => setType(e.target.value as LessonType)}>
              {Object.entries(LESSON_TYPE_LABEL).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Курс">
            <Select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value)
                setSubjectId('')
              }}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Предмет">
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Выберите предмет</option>
            {subjectOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
        </Field>

        <div>
          <div className="mb-1.5 text-sm text-slate-700">Преподаватели</div>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-card border border-line-input p-2.5">
            {teachers.map((p) => (
              <Checkbox
                key={p.id}
                checked={teacherIds.includes(p.id)}
                onChange={(on) => setTeacherIds(toggle(teacherIds, p.id, on))}
                label={p.fullName}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm text-slate-700">Группы</span>
            <button
              type="button"
              onClick={() => setShowAllGroups(!showAllGroups)}
              className="text-xs text-slate-600 underline underline-offset-2"
            >
              {showAllGroups ? 'только этот курс' : 'показать все курсы'}
            </button>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-card border border-line-input p-2.5">
            {groupOptions.map((g) => (
              <Checkbox
                key={g.id}
                checked={groupIds.includes(g.id)}
                onChange={(on) => setGroupIds(toggle(groupIds, g.id, on))}
                label={g.title}
                hint={courses.find((c) => c.id === g.courseId)?.title}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm text-slate-700">Дни и время</span>
            <span className="text-xs text-slate-500">
              У каждого дня своё время
            </span>
          </div>

          <div className="space-y-2">
            {slots.map((slot, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-card border border-line-input p-2.5"
              >
                <select
                  value={slot.weekday}
                  onChange={(e) =>
                    setSlots(
                      slots.map((x, j) =>
                        j === i ? { ...x, weekday: Number(e.target.value) as Weekday } : x,
                      ),
                    )
                  }
                  className={`${COMPACT_CONTROL} w-[76px]`}
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
                  value={slot.startTime}
                  onChange={(e) =>
                    setSlots(
                      slots.map((x, j) => (j === i ? { ...x, startTime: e.target.value } : x)),
                    )
                  }
                  className={`${COMPACT_CONTROL} w-[100px]`}
                  aria-label="Начало"
                />
                <span className="text-sm text-slate-400">–</span>
                <input
                  type="time"
                  value={slot.endTime}
                  onChange={(e) =>
                    setSlots(
                      slots.map((x, j) => (j === i ? { ...x, endTime: e.target.value } : x)),
                    )
                  }
                  className={`${COMPACT_CONTROL} w-[100px]`}
                  aria-label="Конец"
                />

                {slots.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setSlots(slots.filter((_, j) => j !== i))}
                    className="ml-auto text-sm text-red-600 underline underline-offset-2"
                  >
                    Убрать
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-2">
            <Button
              variant="secondary"
              onClick={() =>
                setSlots([
                  ...slots,
                  {
                    weekday: ((slots[slots.length - 1].weekday % 7) + 1) as Weekday,
                    startTime: slots[slots.length - 1].startTime,
                    endTime: slots[slots.length - 1].endTime,
                  },
                ])
              }
            >
              + Добавить день
            </Button>
          </div>
        </div>

        <Field label="Начиная с даты">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Повторение">
            <Select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            >
              {Object.entries(RECURRENCE_LABEL).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          {recurrence !== 'once' ? (
            <Field label="До даты">
              <TextInput
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
            </Field>
          ) : null}
        </div>

        <Field label="Ссылка на Meet">
          <TextInput
            value={meetUrl}
            onChange={(e) => setMeetUrl(e.target.value)}
            placeholder="https://meet.google.com/..."
          />
        </Field>
      </div>

      <div className="mt-3 space-y-2">
        <Notice tone="info">
          Будет создано{' '}
          <strong>
            {countLabel(occurrences.length, 'занятие', 'занятия', 'занятий')}
          </strong>
          {occurrences.length > 1 ? (
            <>
              {' '}
              — {slots.map((sl) => `${WEEKDAY_SHORT[sl.weekday]} ${sl.startTime}`).join(', ')}
              , с {formatDate(occurrences[0].date)} по{' '}
              {formatDate(occurrences[occurrences.length - 1].date)}
            </>
          ) : null}
          .
        </Notice>

        {conflicts.length > 0 ? (
          <div className="rounded-card bg-amber-100 px-3 py-2 text-sm text-amber-700">
            <div className="font-medium">
              Конфликтов: {conflicts.length}. Сохранить всё равно можно.
            </div>
            <ul className="mt-1 space-y-0.5">
              {conflicts.slice(0, 6).map((c, i) => (
                <li key={i}>
                  {formatDate(c.lesson.date)} {c.lesson.startTime}–{c.lesson.endTime} ·{' '}
                  {c.kind === 'teacher'
                    ? `занят преподаватель ${staff.find((p) => p.id === c.holderId)?.fullName ?? ''}`
                    : `занята группа ${groups.find((g) => g.id === c.holderId)?.title ?? ''}`}
                </li>
              ))}
              {conflicts.length > 6 ? <li>…и ещё {conflicts.length - 6}</li> : null}
            </ul>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
