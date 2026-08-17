import { useMemo } from 'react'
import { PageHeader } from '../ui/PageHeader'
import { Pill } from '../ui/Pill'
import { Table, TD, TH, THead, TR } from '../ui/Table'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'

/** Curator's "Мои студенты" (screen-38), reduced to the columns we need. */
export function StudentsPage() {
  const students = useDataStore((s) => s.students)
  const groups = useDataStore((s) => s.groups)
  const enrollments = useDataStore((s) => s.enrollments)
  const actorId = useSessionStore((s) => s.actorId)

  const rows = useMemo(() => {
    const myGroupIds = new Set(
      groups.filter((g) => (actorId ? g.curatorIds.includes(actorId) : false)).map((g) => g.id),
    )
    const mine = enrollments.filter((e) => myGroupIds.has(e.groupId))
    return mine
      .map((e) => ({
        enrollment: e,
        student: students.find((s) => s.id === e.studentId),
        group: groups.find((g) => g.id === e.groupId),
      }))
      .filter((r) => r.student && r.group)
  }, [students, groups, enrollments, actorId])

  return (
    <>
      <PageHeader
        title="Мои студенты"
        subtitle="Студенты, зачисленные в ваши группы."
      />

      <div className="mb-2 text-right text-sm text-slate-500">{rows.length}</div>

      <Table>
        <THead>
          <tr>
            <TH>Студент</TH>
            <TH>Контакты</TH>
            <TH>Данные родителя</TH>
            <TH>Локация</TH>
            <TH>Группа</TH>
            <TH>Зачисление</TH>
          </tr>
        </THead>
        <tbody>
          {rows.map(({ enrollment, student, group }) => (
            <TR key={enrollment.id}>
              <TD className="font-medium text-slate-900">{student!.fullName}</TD>
              <TD>
                <div>{student!.email}</div>
                <div className="mt-0.5 text-xs text-slate-500">{student!.phone}</div>
              </TD>
              <TD>
                <div>{student!.parentName}</div>
                <div className="mt-0.5 text-xs text-slate-500">{student!.parentPhone}</div>
              </TD>
              <TD>{student!.city}</TD>
              <TD>{group!.title}</TD>
              <TD>
                <Pill tone="success">активный</Pill>
              </TD>
            </TR>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-sm text-slate-500">
                За вами не закреплено ни одной группы.
              </td>
            </tr>
          ) : null}
        </tbody>
      </Table>
    </>
  )
}
