import { useMemo, useState } from 'react'
import { Card, CardTitle, EmptyState, StatCard } from '../../ui/Card'
import { Pill } from '../../ui/Pill'
import { Field, TextInput } from '../../ui/Field'
import { Table, TD, TH, THead, TR } from '../../ui/Table'
import { useDataStore } from '../../store/useDataStore'
import { useSessionStore } from '../../store/useSessionStore'
import { LIMIT_LABEL, limitState, tallyFor } from '../../lib/events'
import { audienceOf, countAttendance, effectiveState, stamp } from '../../lib/attendance'
import { monthOf } from '../../lib/lessons'
import { formatMonth } from '../../lib/date'
import { allTeachers } from '../../lib/subjects'
import { REASON_CATEGORIES } from '../../data/types'

/** §35–§39 — the numbers behind the register, month by month. */
export function AnalyticsTab() {
  const events = useDataStore((s) => s.scheduleEvents)
  const lessons = useDataStore((s) => s.lessons)
  const staff = useDataStore((s) => s.staff)
  const limits = useDataStore((s) => s.limits)
  const enrollments = useDataStore((s) => s.enrollments)
  const attendance = useDataStore((s) => s.attendance)

  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)
  const now = stamp(today, time)
  const [month, setMonth] = useState(monthOf(today))

  const monthLessons = useMemo(
    () => lessons.filter((l) => monthOf(l.date) === month && l.state !== 'cancelled'),
    [lessons, month],
  )

  const held = monthLessons.filter((l) => {
    const s = effectiveState(l, now)
    return s === 'held' || s === 'manual'
  })
  const unmarked = monthLessons.filter((l) => effectiveState(l, now) === 'unmarked')

  const monthEvents = events.filter((e) => e.createdAt.slice(0, 7) === month)
  const substitutions = monthEvents.filter((e) => e.type === 'substitution').length
  const transfers = monthEvents.filter((e) => e.type === 'transfer').length

  // §36 — average attendance across the lessons that actually happened.
  const attendanceRate = useMemo(() => {
    let sum = 0
    let counted = 0
    for (const lesson of held) {
      const audience = audienceOf(enrollments, lesson)
      if (audience.length === 0) continue
      const c = countAttendance(attendance, lesson.id, audience.length)
      sum += (c.present + c.late) / audience.length
      counted += 1
    }
    return counted === 0 ? 0 : Math.round((sum / counted) * 100)
  }, [held, enrollments, attendance])

  // §38 — what the reasons actually are, "без объяснения" included.
  const reasons = useMemo(() => {
    const buckets = new Map<string, number>()
    for (const e of monthEvents) {
      const key = e.reason ? (e.reasonCategory ?? 'Другое') : 'Без объяснения'
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
    const known = [...REASON_CATEGORIES, 'Без объяснения']
    return known
      .map((k) => ({ key: k, count: buckets.get(k) ?? 0 }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [monthEvents])

  const maxReason = Math.max(1, ...reasons.map((r) => r.count))

  return (
    <>
      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Месяц" hint="Можно смотреть предыдущие месяцы и сравнивать.">
            <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-6">
        <StatCard label="По плану" value={monthLessons.length} />
        <StatCard label="Проведено" value={held.length} />
        <StatCard label="Не отмечено" value={unmarked.length} />
        <StatCard label="Замен" value={substitutions} />
        <StatCard label="Переносов" value={transfers} />
        <StatCard label="Ср. посещаемость" value={`${attendanceRate}%`} />
      </div>

      <Card flush className="mb-4">
        <div className="px-4 pb-3 pt-4">
          <CardTitle hint={`Лимиты: ${limits.substitutionsPerMonth} замен, ${limits.transfersPerMonth} переносов`}>
            По преподавателям за {formatMonth(month)}
          </CardTitle>
        </div>
        <Table>
          <THead>
            <tr>
              <TH>Преподаватель</TH>
              <TH align="right">Замены неув.</TH>
              <TH align="right">Замены ув.</TH>
              <TH align="right">Переносы неув.</TH>
              <TH align="right">Переносы ув.</TH>
              <TH align="right">Не размечено</TH>
              <TH align="right">Не отмечено</TH>
              <TH>Статус</TH>
            </tr>
          </THead>
          <tbody>
            {allTeachers(staff).map((person) => {
              const tally = tallyFor(events, person.id, month, now)
              const state = limitState(tally, limits)
              const notMarked = unmarked.filter((l) => l.teacherId === person.id).length
              return (
                <TR key={person.id}>
                  <TD className="font-medium text-slate-900">{person.fullName}</TD>
                  <TD align="right">{tally.substitutionInvalid}</TD>
                  <TD align="right">{tally.substitutionValid}</TD>
                  <TD align="right">{tally.transferInvalid}</TD>
                  <TD align="right">{tally.transferValid}</TD>
                  <TD align="right">
                    {tally.unresolved > 0 ? (
                      <span className="text-amber-700">{tally.unresolved}</span>
                    ) : (
                      0
                    )}
                  </TD>
                  <TD align="right">{notMarked}</TD>
                  <TD>
                    <Pill
                      tone={state === 'over' ? 'danger' : state === 'edge' ? 'warning' : 'success'}
                    >
                      {LIMIT_LABEL[state]}
                    </Pill>
                  </TD>
                </TR>
              )
            })}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardTitle>Распределение причин</CardTitle>
        {reasons.length === 0 ? (
          <EmptyState>За этот месяц событий нет.</EmptyState>
        ) : (
          <div className="space-y-2">
            {reasons.map((r) => (
              <div key={r.key} className="flex items-center gap-3">
                <span className="w-56 shrink-0 text-sm text-slate-700">{r.key}</span>
                <div className="h-4 flex-1 rounded bg-page">
                  <div
                    className={`h-4 rounded ${r.key === 'Без объяснения' ? 'bg-red-200' : 'bg-blue-200'}`}
                    style={{ width: `${(r.count / maxReason) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm text-slate-700">{r.count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}
