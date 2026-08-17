import { useState } from 'react'
import { PageHeader } from '../ui/PageHeader'
import { Card, Notice, StatCard } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { SectionTabs } from '../ui/Tabs'
import { SubText, Table, TD, TH, THead, TR } from '../ui/Table'
import { useDataStore } from '../store/useDataStore'
import { formatMoney } from '../lib/format'
import { formatMonth, durationHours } from '../lib/date'

/**
 * Simplified copy of "Зарплата Академа" (screen-21, screen-22).
 *
 * `lessons1h` / `lessons15h` come from the seed as zeros, exactly as in the real
 * system where they are typed in by hand. The "по расписанию" column below is
 * the number the module WILL be able to prove in part 6 — it is shown here only
 * as a reference point, and is not used in the total.
 */
export function PayrollPage() {
  const payroll = useDataStore((s) => s.payroll)
  const staff = useDataStore((s) => s.staff)
  const groups = useDataStore((s) => s.groups)
  const [tab, setTab] = useState('teachers')

  const month = payroll[0]?.month ?? ''

  const total = payroll.reduce(
    (sum, row) =>
      sum +
      row.lines.reduce(
        (acc, line) =>
          acc + line.ratePerHour * (line.lessons1h + line.lessons15h * 1.5),
        0,
      ),
    0,
  )

  return (
    <>
      <PageHeader
        title="Зарплата Академа"
        subtitle="Расчёт по преподавателям. Упрощённая копия существующего экрана АСМР."
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
          <div className="mb-4">
            <Notice tone="info">
              Колонки «Уроки 1 ч» и «Уроки 1,5 ч» сегодня заполняются вручную, со
              слов преподавателей. Часть 6 подставит сюда число фактически
              проведённых занятий и покажет расшифровку.
            </Notice>
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
                <TH>Группы</TH>
                <TH align="right">Ставка/час</TH>
                <TH align="right">Уроки 1 ч</TH>
                <TH align="right">Уроки 1,5 ч</TH>
                <TH align="right">По расписанию</TH>
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

                // How many lessons a week the schedule implies — the reference
                // number part 6 will replace with actual, attended lessons.
                const perWeek = row.lines.reduce((acc, line) => {
                  const g = groups.find((x) => x.id === line.groupId)
                  return acc + (g ? g.schedule.length : 0)
                }, 0)

                const hoursPerWeek = row.lines.reduce((acc, line) => {
                  const g = groups.find((x) => x.id === line.groupId)
                  if (!g) return acc
                  return (
                    acc +
                    g.schedule.reduce(
                      (h, s) => h + durationHours(s.startTime, s.endTime),
                      0,
                    )
                  )
                }, 0)

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
                          return <div key={line.groupId}>{g?.title ?? line.groupId}</div>
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
                      <span className="text-slate-500">{perWeek} / нед.</span>
                      <SubText>{hoursPerWeek.toLocaleString('ru-RU')} ч / нед.</SubText>
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

/** Field that is typed in by hand today — highlighted so the gap is obvious. */
function ManualCell({ value }: { value: number }) {
  return (
    <span className="inline-flex h-[30px] min-w-[52px] items-center justify-end rounded-card border border-line-input bg-white px-2 text-sm text-slate-800">
      {value}
    </span>
  )
}
