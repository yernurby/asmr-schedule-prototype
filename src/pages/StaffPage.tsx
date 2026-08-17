import { useState } from 'react'
import { PageHeader, PartBadge } from '../ui/PageHeader'
import { ActionLink } from '../ui/Button'
import { Pill } from '../ui/Pill'
import { Tabs } from '../ui/Tabs'
import { Table, TD, TH, THead, TR } from '../ui/Table'
import { TeacherSubjectsModal } from '../components/TeacherSubjectsModal'
import { useDataStore } from '../store/useDataStore'
import { groupTeacherIds } from '../lib/subjects'
import type { StaffRole } from '../data/types'

const ROLE_LABEL: Record<StaffRole, string> = {
  teacher: 'Преподаватель',
  curator: 'Куратор',
  academ_head: 'Академ Хэд',
}

const ROLE_TONE: Record<StaffRole, 'warning' | 'success' | 'info'> = {
  teacher: 'warning',
  curator: 'success',
  academ_head: 'info',
}

/**
 * "Сотрудники" — now shows and edits the "Предметы" field, which exists only for
 * the teacher role (part 1, §6).
 */
export function StaffPage() {
  const staff = useDataStore((s) => s.staff)
  const subjects = useDataStore((s) => s.subjects)
  const courses = useDataStore((s) => s.courses)
  const groups = useDataStore((s) => s.groups)
  const [tab, setTab] = useState('all')
  const [editingId, setEditingId] = useState<string | null>(null)

  const editing = staff.find((p) => p.id === editingId) ?? null

  const tabs = [
    { id: 'all', label: 'Все', count: staff.length },
    {
      id: 'teacher',
      label: 'Преподаватели',
      count: staff.filter((s) => s.roles.includes('teacher')).length,
    },
    {
      id: 'curator',
      label: 'Кураторы',
      count: staff.filter((s) => s.roles.includes('curator')).length,
    },
    {
      id: 'academ_head',
      label: 'Академ Хэд',
      count: staff.filter((s) => s.roles.includes('academ_head')).length,
    },
  ]

  const rows =
    tab === 'all' ? staff : staff.filter((s) => s.roles.includes(tab as StaffRole))

  /** "NUET · Математика" — the course matters, subjects never cross courses (§5). */
  const subjectLabel = (subjectId: string) => {
    const subject = subjects.find((s) => s.id === subjectId)
    if (!subject) return null
    const course = courses.find((c) => c.id === subject.courseId)
    return { course: course?.title ?? '—', title: subject.title, archived: subject.isArchived }
  }

  return (
    <>
      <PartBadge part={1} />

      <PageHeader
        title="Сотрудники"
        subtitle="Преподаватели, кураторы и академический директор. У преподавателей — предметы, которые они могут вести."
      />

      <Tabs items={tabs} value={tab} onChange={setTab} />

      <Table>
        <THead>
          <tr>
            <TH>ФИО</TH>
            <TH>Роль</TH>
            <TH>Предметы</TH>
            <TH>Контакты</TH>
            <TH align="right">Групп</TH>
            <TH>Действия</TH>
          </tr>
        </THead>
        <tbody>
          {rows.map((person) => {
            const isTeacher = person.roles.includes('teacher')
            const groupCount = groups.filter(
              (g) =>
                g.status === 'active' &&
                (groupTeacherIds(g).includes(person.id) ||
                  g.curatorIds.includes(person.id)),
            ).length

            return (
              <TR key={person.id}>
                <TD className="font-medium text-slate-900">{person.fullName}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1.5">
                    {person.roles.map((r) => (
                      <Pill key={r} tone={ROLE_TONE[r]}>
                        {ROLE_LABEL[r]}
                      </Pill>
                    ))}
                  </div>
                  {person.jobTitle ? (
                    <div className="mt-1 text-xs text-slate-500">{person.jobTitle}</div>
                  ) : null}
                </TD>

                <TD>
                  {!isTeacher ? (
                    // §6 — the field exists for teachers only.
                    <span className="text-slate-400">—</span>
                  ) : person.subjectIds.length === 0 ? (
                    <span className="text-slate-400">не заданы</span>
                  ) : (
                    <div className="space-y-1">
                      {person.subjectIds.map((id) => {
                        const label = subjectLabel(id)
                        if (!label) return null
                        // For single-subject courses the subject is named after
                        // the course (§17), so "IELTS · IELTS" would just be noise.
                        const sameName = label.course === label.title
                        return (
                          <div key={id} className="text-sm text-slate-800">
                            {sameName ? null : (
                              <span className="text-slate-500">{label.course} · </span>
                            )}
                            {label.title}
                            {label.archived ? (
                              <span className="ml-1.5 text-xs text-slate-400">
                                (архивный)
                              </span>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </TD>

                <TD>
                  <div>{person.email}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{person.phone}</div>
                </TD>
                <TD align="right">
                  {groupCount === 0 ? <span className="text-slate-400">—</span> : groupCount}
                </TD>
                <TD>
                  {isTeacher ? (
                    <ActionLink onClick={() => setEditingId(person.id)}>
                      Предметы
                    </ActionLink>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TD>
              </TR>
            )
          })}
        </tbody>
      </Table>

      {editing ? (
        <TeacherSubjectsModal person={editing} onClose={() => setEditingId(null)} />
      ) : null}
    </>
  )
}
