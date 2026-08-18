import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../ui/PageHeader'
import { Card, Notice, StatCard } from '../ui/Card'
import { Button } from '../ui/Button'
import { Pill } from '../ui/Pill'
import { SectionTabs } from '../ui/Tabs'
import { SubText, Table, TD, TH, THead, TR } from '../ui/Table'
import { useDataStore } from '../store/useDataStore'
import { formatMoney } from '../lib/format'
import { formatMonth, durationHours } from '../lib/date'
import { migrateSchedule, monthOf } from '../lib/lessons'
import { effectiveState, stamp } from '../lib/attendance'
import { useSessionStore } from '../store/useSessionStore'
import type { Group, Subject } from '../data/types'

/**
 * Simplified copy of "Зарплата Академа" (screen-21, screen-22).
 *
 * `lessons1h` / `lessons15h` come from the seed as zeros, exactly as in the real
 * system where they are typed in by hand. The "по расписанию" column is the
 * number part 6 will be able to prove; it is a reference point and does not feed
 * the total.
 *
 * Since part 1 that reference number is counted per teacher from the rows they
 * are actually assigned to — a NUET group is now split between a maths teacher
 * and a critical-thinking teacher, so the whole group's schedule no longer
 * belongs to one person.
 */
export function PayrollPage() {
  const payroll = useDataStore((s) => s.payroll)
  const staff = useDataStore((s) => s.staff)
  const groups = useDataStore((s) => s.groups)
  const subjects = useDataStore((s) => s.subjects)
  const lessons = useDataStore((s) => s.lessons)
  const frozenMonths = useDataStore((s) => s.frozenMonths)
  const setMonthFrozen = useDataStore((s) => s.setMonthFrozen)
  const today = useSessionStore((st) => st.today)
  const time = useSessionStore((st) => st.time)
  const now = stamp(today, time)
  const [tab, setTab] = useState('teachers')

  const month = payroll[0]?.month ?? ''

  const total = payroll.reduce(
    (sum, row) =>
      sum +
      row.lines.reduce(
        (acc, line) => acc + line.ratePerHour * (line.lessons1h + line.lessons15h * 1.5),
        0,
      ),
    0,
  )

  const frozen = frozenMonths.includes(month)

  /** §33, §35 — automatic payroll stays off while anything needs sorting out. */
  const needsReview = useMemo(
    () => migrateSchedule(groups, subjects).needsReview,
    [groups, subjects],
  )

  /**
   * Since part 2 the reference number is counted from real lessons of the month,
   * and cancelled ones are excluded — §20 says they neither pay nor count as
   * missed.
   */
  const monthLessonsOf = (teacherId: string) =>
    lessons.filter((l) => {
      if (l.teacherId !== teacherId) return false
      if (monthOf(l.date) !== month) return false
      // §32 — only a lesson that was actually marked, or counted by hand, is paid.
      const state = effectiveState(l, now)
      return state === 'held' || state === 'manual'
    })

  const unmarkedOf = (teacherId: string) =>
    lessons.filter(
      (l) =>
        l.teacherId === teacherId &&
        monthOf(l.date) === month &&
        effectiveState(l, now) === 'unmarked',
    ).length

  /** Rows of a group that belong to one teacher. */
  const rowsOfTeacher = (group: Group, teacherId: string) =>
    group.schedule.filter((r) => r.teacherId === teacherId)

  const subjectTitles = (group: Group, teacherId: string): Subject[] => {
    const ids = new Set(rowsOfTeacher(group, teacherId).map((r) => r.subjectId))
    return subjects.filter((s) => ids.has(s.id))
  }

  return (
    <>
      <PageHeader
        title="Зарплата Академа"
        subtitle="Расчёт по преподавателям. Упрощённая копия существующего экрана АСМР."
        actions={
          <Button
            variant={frozen ? 'secondary' : 'success'}
            onClick={() => setMonthFrozen(month, !frozen)}
          >
            {frozen ? 'Разморозить месяц' : 'Заморозить месяц'}
          </Button>
        }
      />

      <SectionTabs
        items={[
          { id: 'teachers', label: 'Преподаватели' },
          { id: 'curators', label: 'Кураторы' },
          { id: 'head', label: 'Академ Хэд' },
          { id: 'settings', label: 'Настройки' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab !== 'teachers' ? (
        <Card>
          <p className="text-sm text-slate-500">
            В прототипе воспроизведена только вкладка «Преподаватели» — именно её
            меняет часть 6.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-4 space-y-2">
            <Notice tone="info">
              Колонки «Уроки 1 ч» и «Уроки 1,5 ч» сегодня заполняются вручную, со
              слов преподавателей. Часть 6 подставит туда факт. Колонка «Занятий по
              факту» считает только проведённые и засчитанные вручную — отменённые
              и неотмеченные не оплачиваются.
            </Notice>

            {needsReview.length > 0 ? (
              <div className="rounded-card bg-amber-100 px-3 py-2 text-sm text-amber-700">
                Автоматический расчёт включать нельзя:{' '}
                <Link to="/migration" className="underline underline-offset-2">
                  {needsReview.length} групп требуют разбора
                </Link>
                . Пока список не пуст, первый же месяц посчитается криво.
              </div>
            ) : null}

            {frozenMonths.length > 0 ? (
              <div className="rounded-card bg-muted px-3 py-2 text-sm text-slate-700">
                Закрытые по зарплате месяцы:{' '}
                {frozenMonths.map((m) => formatMonth(m)).join(', ')}. Изменение
                расписания с датой внутри такого месяца не пропускается.
              </div>
            ) : null}
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard label="Месяц" value={formatMonth(month)} />
            <StatCard label="Преподавателей" value={payroll.length} />
            <StatCard label="Фонд ЗП" value={formatMoney(total)} />
          </div>

          <Table>
            <THead>
              <tr>
                <TH>ФИО</TH>
                <TH>Группы и предметы</TH>
                <TH align="right">Ставка/час</TH>
                <TH align="right">Уроки 1 ч</TH>
                <TH align="right">Уроки 1,5 ч</TH>
                <TH align="right">Занятий по факту</TH>
                <TH>Статус</TH>
                <TH align="right">Итого ЗП</TH>
              </tr>
            </THead>
            <tbody>
              {payroll.map((row) => {
                const person = staff.find((p) => p.id === row.staffId)
                const rowTotal = row.lines.reduce(
                  (acc, line) =>
                    acc + line.ratePerHour * (line.lessons1h + line.lessons15h * 1.5),
                  0,
                )
                const rate = row.lines[0]?.ratePerHour ?? 0

                const monthLessons = monthLessonsOf(row.staffId)
                const monthHours = monthLessons.reduce(
                  (acc, l) => acc + durationHours(l.startTime, l.endTime),
                  0,
                )

                return (
                  <TR key={row.id}>
                    <TD className="font-medium text-slate-900">
                      {person?.fullName ?? row.staffId}
                    </TD>
                    <TD>
                      {row.lines.length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        row.lines.map((line) => {
                          const g = groups.find((x) => x.id === line.groupId)
                          if (!g) return null
                          const own = subjectTitles(g, row.staffId)
                          return (
                            <div key={line.groupId}>
                              {g.title}
                              <SubText>{own.map((s) => s.title).join(', ') || '—'}</SubText>
                            </div>
                          )
                        })
                      )}
                    </TD>
                    <TD align="right">{rate ? formatMoney(rate) : '—'}</TD>
                    <TD align="right">
                      <ManualCell value={row.lines.reduce((a, l) => a + l.lessons1h, 0)} />
                    </TD>
                    <TD align="right">
                      <ManualCell value={row.lines.reduce((a, l) => a + l.lessons15h, 0)} />
                    </TD>
                    <TD align="right">
                      <span className="text-slate-500">{monthLessons.length}</span>
                      <SubText>{monthHours.toLocaleString('ru-RU')} ч за месяц</SubText>
                      {unmarkedOf(row.staffId) > 0 ? (
                        <SubText>
                          <Link
                            to="/schedule/unmarked"
                            className="text-amber-700 underline underline-offset-2"
                          >
                            не отмечено: {unmarkedOf(row.staffId)}
                          </Link>
                        </SubText>
                      ) : null}
                    </TD>
                    <TD>
                      <Pill tone={row.status === 'confirmed' ? 'success' : 'neutral'}>
                        {row.status === 'confirmed' ? 'Подтверждено' : 'Черновик'}
                      </Pill>
                    </TD>
                    <TD align="right" className="font-medium text-slate-900">
                      {formatMoney(rowTotal)}
                    </TD>
                  </TR>
                )
              })}
            </tbody>
          </Table>
        </>
      )}
    </>
  )
}

/** Field that is typed in by hand today — outlined so the gap is obvious. */
function ManualCell({ value }: { value: number }) {
  return (
    <span className="inline-flex h-[30px] min-w-[52px] items-center justify-end rounded-card border border-line-input bg-white px-2 text-sm text-slate-800">
      {value}
    </span>
  )
}
