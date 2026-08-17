import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Field'
import { useDataStore } from '../store/useDataStore'
import { courseSubjects, scheduledSubjectIdsOf } from '../lib/subjects'
import type { Staff } from '../data/types'

/**
 * "Предметы" on a teacher card (part 1, §6). Several subjects can be ticked,
 * including subjects from different courses. Only shown for the teacher role —
 * the caller is responsible for that check.
 *
 * Subjects the teacher is already scheduled for are marked, so unticking one by
 * accident is visible rather than silent.
 */
export function TeacherSubjectsModal({
  person,
  onClose,
}: {
  person: Staff
  onClose: () => void
}) {
  const courses = useDataStore((s) => s.courses)
  const subjects = useDataStore((s) => s.subjects)
  const groups = useDataStore((s) => s.groups)
  const setStaffSubjects = useDataStore((s) => s.setStaffSubjects)

  const [selected, setSelected] = useState<string[]>(person.subjectIds)
  const scheduled = scheduledSubjectIdsOf(groups, person.id)

  const toggle = (id: string, next: boolean) =>
    setSelected((prev) => (next ? [...prev, id] : prev.filter((x) => x !== id)))

  const droppedButScheduled = scheduled.filter((id) => !selected.includes(id))

  return (
    <Modal
      open
      title="Предметы преподавателя"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setStaffSubjects(person.id, selected)
              onClose()
            }}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-700">
        {person.fullName}. Отметьте предметы, которые преподаватель может вести —
        можно из разных курсов. По этому списку он предлагается при постановке в
        расписание.
      </p>

      <div className="space-y-4">
        {courses.map((course) => {
          const list = courseSubjects(subjects, course.id)
          if (list.length === 0) return null
          return (
            <div key={course.id}>
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                {course.title}
              </div>
              <div className="space-y-1.5">
                {list.map((subject) => (
                  <Checkbox
                    key={subject.id}
                    checked={selected.includes(subject.id)}
                    onChange={(next) => toggle(subject.id, next)}
                    label={
                      <>
                        {subject.title}
                        {scheduled.includes(subject.id) ? (
                          <span className="ml-2 text-xs text-slate-500">в расписании</span>
                        ) : null}
                      </>
                    }
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {droppedButScheduled.length > 0 ? (
        <p className="mt-4 rounded-card bg-muted px-3 py-2 text-xs text-slate-700">
          Снят предмет, по которому преподаватель уже стоит в расписании. Расписание
          не изменится — он просто перестанет предлагаться первым при выборе.
        </p>
      ) : null}
    </Modal>
  )
}
