import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, PartBadge } from '../ui/PageHeader'
import { Card, Notice, StatCard } from '../ui/Card'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Field'
import { Pill } from '../ui/Pill'
import { SectionTabs } from '../ui/Tabs'
import { SubText, Table, TD, TH, THead, TR } from '../ui/Table'
import { UnmarkedModal } from '../components/UnmarkedModal'
import { FreezeMonthModal } from '../components/FreezeMonthModal'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import { formatMoney } from '../lib/format'
import { formatMonth } from '../lib/date'
import { migrateSchedule } from '../lib/lessons'
import { stamp } from '../lib/attendance'
import { buildPayrollLines, legacyTotal, sumLines, unmarkedLessons } from '../lib/payroll'
import type { PayrollLine } from '../data/types'

/**
 * "Зарплата Академа" — since part 6 the lesson counts are computed from lessons
 * that actually happened instead of being typed in from memory. Rates stay
 * manual on purpose: that is how a 150-person lecture and a 30-person seminar
 * can be paid differently without inventing any logic.
 */
export function PayrollPage() {
  const payroll = useDataStore((s) => s.payroll)
  const staff = useDataStore((s) => s.staff)
  const groups = useDataStore((s) => s.groups)
  const subjects = useDataStore((s) => s.subjects)
  const lessons = useDataStore((s) => s.lessons)
  const events = useDataStore((s) => s.scheduleEvents)
  const frozenMonths = useDataStore((s) => s.frozenMonths)
  const setRate = useDataStore((s) => s.setPayrollRate)
  const syncPayroll = useDataStore((s) => s.syncPayroll)

  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)
  const now = stamp(today, time)

  const [tab, setTab] = useState('teachers')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [parallel, setParallel] = useState(false)
  const [unmarkedFor, setUnmarkedFor] = useState<string | null>(null)
  const [freezing, setFreezing] = useState(false)

  const month = payroll[0]?.month ?? ''
  const frozen = frozenMonths.includes(month)

  const needsReview = useMemo(
    () => migrateSchedule(groups, subjects).needsReview,
    [groups, subjects],
  )

  const ctx = { groups, subjects, staff, events }

  const sheets = useMemo(
    () =>
      payroll.map((row) => {
        const person = staff.find((p) => p.id === row.staffId)
        const lines = buildPayrollLines(lessons, row, person, ctx, now)
        return {
          row,
          person,
          lines,
          total: sumLines(lines),
          legacy: legacyTotal(row),
          unmarked: unmarkedLessons(lessons, row.staffId, row.month, now),
          fresh: lines.filter((l) => !row.knownKeys.includes(l.key)).length,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payroll, staff, lessons, groups, subjects, events, now],
  )

  const fund = sheets.reduce((acc, s) => acc + s.total, 0)
  const unresolved = sheets.reduce((acc, s) => acc + s.unmarked.length, 0)

  const sync = () =>
    syncPayroll(
      month,
      Object.fromEntries(sheets.map((s) => [s.row.id, s.lines.map((l) => l.key)])),
    )

  return (
    <>
      <PartBadge part={6} />

      <PageHeader
        title="Зарплата Академа"
        subtitle="Количество уроков считается по фактически проведённым занятиям."
        actions={
          <>
            <Button variant="secondary" onClick={sync}>
              Синхронизировать занятия
            </Button>
            <Button
              variant={frozen ? 'secondary' : 'success'}
              onClick={() => setFreezing(true)}
            >
              {frozen ? 'Разморозить месяц' : 'Заморозить месяц'}
            </Button>
          </>
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
              В расчёт идут занятия «Проведено» и «Засчитано вручную». Отменённые и
              неотмеченные не оплачиваются. Занятие числится за тем, кто его вёл —
              при замене за заменяющим, — и попадает в месяц, когда состоялось.
            </Notice>

            {needsReview.length > 0 ? (
              <div className="rounded-card bg-amber-100 px-3 py-2 text-sm text-amber-700">
                <Link to="/migration" className="underline underline-offset-2">
                  {needsReview.length} групп требуют разбора
                </Link>{' '}
                — до этого автоматический расчёт считается неполным.
              </div>
            ) : null}

            {frozen ? (
              <div className="rounded-card bg-muted px-3 py-2 text-sm text-slate-700">
                {formatMonth(month)} заморожен: суммы зафиксированы, расписание
                внутрь месяца не меняется, посещаемость правит только академический
                директор.
              </div>
            ) : null}
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard label="Месяц" value={formatMonth(month)} />
            <StatCard label="Преподавателей" value={payroll.length} />
            <StatCard label="Фонд ЗП" value={formatMoney(fund)} />
            <StatCard
              label="Не отмечено"
              value={unresolved}
              hint={unresolved > 0 ? 'Не оплачивается' : 'Всё разобрано'}
            />
          </div>

          <div className="mb-3">
            <Checkbox
              checked={parallel}
              onChange={setParallel}
              label="Параллельный счёт со старой колонкой"
              hint="Показывает рядом то, что раньше вбивали руками, чтобы сверить переход."
            />
          </div>

          <Table>
            <THead>
              <tr>
                <TH>ФИО</TH>
                <TH align="right">Уроки 1 ч</TH>
                <TH align="right">Уроки 1,5 ч</TH>
                <TH>Не отмечено</TH>
                {parallel ? <TH align="right">Старый счёт</TH> : null}
                <TH>Статус</TH>
                <TH align="right">Итого ЗП</TH>
              </tr>
            </THead>
            <tbody>
              {sheets.map((sheet) => {
                const open = expanded === sheet.row.id
                const h1 = sheet.lines.reduce((a, l) => a + l.lessons1h, 0)
                const h15 = sheet.lines.reduce((a, l) => a + l.lessons15h, 0)
                return (
                  <>
                    <TR key={sheet.row.id}>
                      <TD>
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : sheet.row.id)}
                          className="text-left font-medium text-slate-900"
                        >
                          <span className="mr-1.5 text-slate-400">{open ? '▾' : '▸'}</span>
                          {sheet.person?.fullName ?? sheet.row.staffId}
                        </button>
                        {sheet.fresh > 0 ? (
                          <SubText>{sheet.fresh} новых строк после синхронизации</SubText>
                        ) : null}
                      </TD>
                      <TD align="right">{h1}</TD>
                      <TD align="right">{h15}</TD>
                      <TD>
                        {sheet.unmarked.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setUnmarkedFor(sheet.row.staffId)}
                            className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-rose-700"
                          >
                            {sheet.unmarked.length} не отмечено
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TD>
                      {parallel ? (
                        <TD align="right">
                          <span className="text-slate-500">{formatMoney(sheet.legacy)}</span>
                          <SubText>вводили руками</SubText>
                        </TD>
                      ) : null}
                      <TD>
                        <Pill tone={sheet.row.status === 'confirmed' ? 'success' : 'neutral'}>
                          {sheet.row.status === 'confirmed' ? 'Подтверждено' : 'Черновик'}
                        </Pill>
                      </TD>
                      <TD align="right" className="font-medium text-slate-900">
                        {formatMoney(sheet.total)}
                      </TD>
                    </TR>

                    {open ? (
                      <tr key={`${sheet.row.id}-sheet`}>
                        <td colSpan={parallel ? 7 : 6} className="bg-page px-4 py-3">
                          <PayrollSheet
                            lines={sheet.lines}
                            frozen={frozen}
                            onRate={(key, rate) => setRate(sheet.row.id, key, rate)}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </>
                )
              })}
            </tbody>
          </Table>
        </>
      )}

      {unmarkedFor ? (
        <UnmarkedModal
          teacherId={unmarkedFor}
          month={month}
          onClose={() => setUnmarkedFor(null)}
        />
      ) : null}

      {freezing ? (
        <FreezeMonthModal
          month={month}
          frozen={frozen}
          unresolved={unresolved}
          onClose={() => setFreezing(false)}
        />
      ) : null}
    </>
  )
}

/** §5–§11 — the sheet itself: three kinds of line, one editable rate each. */
function PayrollSheet({
  lines,
  frozen,
  onRate,
}: {
  lines: PayrollLine[]
  frozen: boolean
  onRate: (key: string, rate: number) => void
}) {
  if (lines.length === 0) {
    return <p className="text-sm text-slate-500">Проведённых занятий в этом месяце нет.</p>
  }
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-page">
          <tr>
            <TH>Строка</TH>
            <TH align="right">Ставка/час</TH>
            <TH align="right">Уроки 1 ч</TH>
            <TH align="right">Уроки 1,5 ч</TH>
            <TH align="right">Итого</TH>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <TR key={line.key}>
              <TD>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">{line.title}</span>
                  {line.kind === 'shared' ? <Pill tone="info">общее</Pill> : null}
                  {line.kind === 'substitution' ? <Pill tone="warning">замены</Pill> : null}
                </div>
                {line.subtitle ? <SubText>{line.subtitle}</SubText> : null}
                {line.groupTitles.length > 0 ? (
                  <SubText>{line.groupTitles.join(', ')}</SubText>
                ) : null}
                {line.details.map((d) => (
                  <SubText key={d}>{d}</SubText>
                ))}
              </TD>
              <TD align="right">
                <input
                  type="number"
                  min={0}
                  step={500}
                  disabled={frozen}
                  value={line.ratePerHour}
                  onChange={(e) => onRate(line.key, Number(e.target.value) || 0)}
                  className="h-[30px] w-24 rounded-card border border-line-input px-2 text-right text-sm disabled:bg-page"
                />
              </TD>
              <TD align="right">{line.lessons1h}</TD>
              <TD align="right">{line.lessons15h}</TD>
              <TD align="right" className="font-medium text-slate-900">
                {formatMoney(line.total)}
              </TD>
            </TR>
          ))}
        </tbody>
      </table>
    </div>
  )
}
