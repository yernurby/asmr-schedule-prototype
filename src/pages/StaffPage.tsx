import { useState } from 'react'
import { PageHeader } from '../ui/PageHeader'
import { Pill } from '../ui/Pill'
import { Tabs } from '../ui/Tabs'
import { Table, TD, TH, THead, TR } from '../ui/Table'
import { useDataStore } from '../store/useDataStore'
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

/** Simplified copy of the real "Сотрудники / Staff" screen (screen-05). */
export function StaffPage() {
  const staff = useDataStore((s) => s.staff)
  const groups = useDataStore((s) => s.groups)
  const [tab, setTab] = useState('all')

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

  return (
    <>
      <PageHeader
        title="Сотрудники"
        subtitle="Преподаватели, кураторы и академический директор. Упрощённая копия существующего экрана."
      />

      <Tabs items={tabs} value={tab} onChange={setTab} />

      <Table>
        <THead>
          <tr>
            <TH>ФИО</TH>
            <TH>Роль</TH>
            <TH>Контакты</TH>
            <TH align="right">Групп</TH>
            <TH>Статус</TH>
          </tr>
        </THead>
        <tbody>
          {rows.map((person) => {
            const groupCount = groups.filter(
              (g) =>
                g.status === 'active' &&
                (g.teacherIds.includes(person.id) || g.curatorIds.includes(person.id)),
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
                  <div>{person.email}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{person.phone}</div>
                </TD>
                <TD align="right">
                  {groupCount === 0 ? <span className="text-slate-400">—</span> : groupCount}
                </TD>
                <TD>
                  <Pill tone={person.status === 'active' ? 'success' : 'neutral'}>
                    {person.status === 'active' ? 'Активен' : 'Неактивен'}
                  </Pill>
                </TD>
              </TR>
            )
          })}
        </tbody>
      </Table>
    </>
  )
}
