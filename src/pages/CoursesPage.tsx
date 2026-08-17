import { useState } from 'react'
import { PageHeader, PartBadge } from '../ui/PageHeader'
import { Button, ActionLink } from '../ui/Button'
import { Pill } from '../ui/Pill'
import { Table, TD, TH, THead, TR } from '../ui/Table'
import { CourseFormModal } from '../components/CourseFormModal'
import { useDataStore } from '../store/useDataStore'
import { allCourseSubjects, courseSubjects } from '../lib/subjects'
import { countLabel } from '../lib/format'
import type { Course } from '../data/types'

/**
 * "Курсы" — now carries the subjects of each course (part 1, §15) and the
 * create / edit form with the "Предметы" block (§1).
 */
export function CoursesPage() {
  const courses = useDataStore((s) => s.courses)
  const subjects = useDataStore((s) => s.subjects)
  const groups = useDataStore((s) => s.groups)
  const setCourseActive = useDataStore((s) => s.setCourseActive)

  const [formOpen, setFormOpen] = useState(false)
  // Keep the id, not the object: the course is renamed through the store while
  // the form is open, and a snapshot would go stale.
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = courses.find((c) => c.id === editingId) ?? null

  const openCreate = () => {
    setEditingId(null)
    setFormOpen(true)
  }

  const openEdit = (course: Course) => {
    setEditingId(course.id)
    setFormOpen(true)
  }

  return (
    <>
      <PartBadge part={1} />

      <PageHeader
        title="Курсы"
        subtitle="Каталог курсов и их предметов."
        actions={
          <Button variant="primary" onClick={openCreate}>
            Новый курс
          </Button>
        }
      />

      <Table>
        <THead>
          <tr>
            <TH>Название</TH>
            <TH>Предметы</TH>
            <TH align="right">Группы</TH>
            <TH>Статус</TH>
            <TH>Действия</TH>
          </tr>
        </THead>
        <tbody>
          {courses.map((course) => {
            const live = courseSubjects(subjects, course.id)
            const archived = allCourseSubjects(subjects, course.id).filter(
              (s) => s.isArchived,
            )
            const groupCount = groups.filter((g) => g.courseId === course.id).length
            return (
              <TR key={course.id}>
                <TD className="font-medium text-slate-900">{course.title}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1.5">
                    {live.map((s) => (
                      <Pill key={s.id} tone="neutral">
                        {s.title}
                      </Pill>
                    ))}
                  </div>
                  {archived.length > 0 ? (
                    <div className="mt-1 text-xs text-slate-500">
                      + {countLabel(archived.length, 'архивный', 'архивных', 'архивных')}:{' '}
                      {archived.map((s) => s.title).join(', ')}
                    </div>
                  ) : null}
                </TD>
                <TD align="right">
                  {groupCount === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    countLabel(groupCount, 'группа', 'группы', 'групп')
                  )}
                </TD>
                <TD>
                  <Pill tone={course.isActive ? 'success' : 'neutral'}>
                    {course.isActive ? 'Активный' : 'Архивный'}
                  </Pill>
                </TD>
                <TD>
                  <div className="flex flex-wrap items-center gap-3">
                    <ActionLink onClick={() => openEdit(course)}>Редактировать</ActionLink>
                    {course.isActive ? (
                      <ActionLink
                        tone="danger"
                        onClick={() => setCourseActive(course.id, false)}
                      >
                        Архивировать
                      </ActionLink>
                    ) : (
                      <ActionLink
                        tone="success"
                        onClick={() => setCourseActive(course.id, true)}
                      >
                        Активировать
                      </ActionLink>
                    )}
                  </div>
                </TD>
              </TR>
            )
          })}
        </tbody>
      </Table>

      <CourseFormModal
        open={formOpen}
        course={editing}
        onClose={() => setFormOpen(false)}
      />
    </>
  )
}
