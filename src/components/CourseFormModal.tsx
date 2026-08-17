import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/Field'
import { Pill } from '../ui/Pill'
import { useDataStore } from '../store/useDataStore'
import {
  BLOCK_REASON_TEXT,
  MAX_SUBJECTS_PER_COURSE,
  allCourseSubjects,
  archiveBlockedBecause,
  canAddSubject,
  courseSubjects,
  deleteBlockedBecause,
  subjectUsage,
} from '../lib/subjects'
import type { Course } from '../data/types'

/**
 * Course create / edit form with the "Предметы" block (part 1, §1–§5).
 *
 * Editing writes straight to the store, because archiving and deleting a subject
 * have to take effect against real schedule data. Creating keeps a local draft
 * until "Создать", where §4 guarantees at least one subject.
 */
export function CourseFormModal({
  open,
  course,
  onClose,
}: {
  open: boolean
  /** Null = create a new course. */
  course: Course | null
  onClose: () => void
}) {
  const isEdit = course !== null
  return open ? (
    isEdit ? (
      <EditCourse course={course} onClose={onClose} />
    ) : (
      <CreateCourse onClose={onClose} />
    )
  ) : null
}

// ---------------------------------------------------------------- create mode

function CreateCourse({ onClose }: { onClose: () => void }) {
  const createCourse = useDataStore((s) => s.createCourse)
  const [title, setTitle] = useState('')
  /** Extra subjects beyond the automatic one. */
  const [extra, setExtra] = useState<string[]>([])
  /** Once the user edits the first subject, it stops mirroring the course title. */
  const [firstSubject, setFirstSubject] = useState<string | null>(null)

  const firstValue = firstSubject ?? title
  const liveCount = 1 + extra.length
  const canSave = title.trim().length > 0 && firstValue.trim().length > 0

  const save = () => {
    if (!canSave) return
    createCourse(title.trim(), [firstValue, ...extra])
    onClose()
  }

  return (
    <Modal
      open
      title="Новый курс"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={save} disabled={!canSave}>
            Создать
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Название курса">
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например, ЕНТ"
            autoFocus
          />
        </Field>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm text-slate-700">Предметы</span>
            <span className="text-xs text-slate-500">
              {liveCount} из {MAX_SUBJECTS_PER_COURSE}
            </span>
          </div>

          <div className="space-y-2">
            <TextInput
              value={firstValue}
              onChange={(e) => setFirstSubject(e.target.value)}
              placeholder="Название предмета"
            />
            {extra.map((value, i) => (
              <div key={i} className="flex items-center gap-2">
                <TextInput
                  value={value}
                  onChange={(e) =>
                    setExtra(extra.map((v, j) => (j === i ? e.target.value : v)))
                  }
                  placeholder="Название предмета"
                />
                <Button
                  variant="secondary"
                  onClick={() => setExtra(extra.filter((_, j) => j !== i))}
                >
                  Убрать
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-2">
            <Button
              variant="secondary"
              disabled={liveCount >= MAX_SUBJECTS_PER_COURSE}
              onClick={() => setExtra([...extra, ''])}
            >
              + Добавить предмет
            </Button>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Первый предмет по умолчанию называется как курс. Если больше предметов
            не нужно, ничего не трогайте — курс не может остаться без предметов.
          </p>
        </div>
      </div>
    </Modal>
  )
}

// ------------------------------------------------------------------ edit mode

function EditCourse({ course, onClose }: { course: Course; onClose: () => void }) {
  const subjects = useDataStore((s) => s.subjects)
  const groups = useDataStore((s) => s.groups)
  const renameCourse = useDataStore((s) => s.renameCourse)
  const addSubject = useDataStore((s) => s.addSubject)
  const renameSubject = useDataStore((s) => s.renameSubject)
  const setSubjectArchived = useDataStore((s) => s.setSubjectArchived)
  const deleteSubject = useDataStore((s) => s.deleteSubject)

  const [courseTitle, setCourseTitle] = useState(course.title)
  /** Draft titles keyed by subject id — committed on blur so the field can be cleared. */
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => setCourseTitle(course.title), [course.title])

  const rows = allCourseSubjects(subjects, course.id)
  const liveCount = courseSubjects(subjects, course.id).length
  const canAdd = canAddSubject(subjects, course.id)

  const commitCourseTitle = () => {
    const next = courseTitle.trim()
    if (next.length > 0 && next !== course.title) renameCourse(course.id, next)
    else setCourseTitle(course.title)
  }

  const commitSubject = (id: string, current: string) => {
    const draft = drafts[id]
    if (draft === undefined) return
    const next = draft.trim()
    if (next.length > 0 && next !== current) renameSubject(id, next)
    setDrafts((d) => {
      const { [id]: _dropped, ...rest } = d
      return rest
    })
  }

  const addNew = () => {
    const next = newTitle.trim()
    if (next.length === 0 || !canAdd) return
    addSubject(course.id, next)
    setNewTitle('')
  }

  return (
    <Modal
      open
      title="Редактировать курс"
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Готово
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Название курса">
          <TextInput
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
            onBlur={commitCourseTitle}
          />
        </Field>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm text-slate-700">Предметы</span>
            <span className="text-xs text-slate-500">
              {liveCount} из {MAX_SUBJECTS_PER_COURSE}
            </span>
          </div>

          <div className="divide-y divide-muted rounded-card border border-line-input">
            {rows.map((subject) => {
              const usedIn = subjectUsage(groups, subject.id)
              const deleteBlock = deleteBlockedBecause(subjects, groups, subject)
              const archiveBlock = archiveBlockedBecause(subjects, subject)
              return (
                <div key={subject.id} className="p-3">
                  <div className="flex items-center gap-2">
                    <TextInput
                      value={drafts[subject.id] ?? subject.title}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [subject.id]: e.target.value }))
                      }
                      onBlur={() => commitSubject(subject.id, subject.title)}
                    />
                    {subject.isArchived ? <Pill tone="neutral">архивный</Pill> : null}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {subject.isArchived ? (
                      <button
                        type="button"
                        onClick={() => setSubjectArchived(subject.id, false)}
                        className="text-sm text-emerald-600 underline underline-offset-2"
                      >
                        Активировать
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={archiveBlock !== null}
                        onClick={() => setSubjectArchived(subject.id, true)}
                        className="text-sm text-red-600 underline underline-offset-2 disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                      >
                        Архивировать
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={deleteBlock !== null}
                      onClick={() => deleteSubject(subject.id)}
                      className="text-sm text-red-600 underline underline-offset-2 disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                    >
                      Удалить
                    </button>

                    <span className="text-xs text-slate-500">
                      {usedIn.length > 0
                        ? `Расписание в ${usedIn.length} гр.: ${usedIn
                            .map((g) => g.title)
                            .join(', ')}`
                        : 'Расписания нет'}
                    </span>
                  </div>

                  {deleteBlock || archiveBlock ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {BLOCK_REASON_TEXT[(archiveBlock ?? deleteBlock)!]}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <TextInput
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addNew()
              }}
              placeholder="Название нового предмета"
              disabled={!canAdd}
            />
            <Button
              variant="secondary"
              onClick={addNew}
              disabled={!canAdd || newTitle.trim().length === 0}
            >
              + Добавить
            </Button>
          </div>

          {!canAdd ? (
            <p className="mt-1 text-xs text-slate-500">
              Достигнут предел — {MAX_SUBJECTS_PER_COURSE} предметов на курс.
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
