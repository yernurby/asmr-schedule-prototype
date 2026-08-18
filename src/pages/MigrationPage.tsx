import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, PartBadge } from '../ui/PageHeader'
import { Button } from '../ui/Button'
import { Card, CardTitle, EmptyState, Notice, StatCard } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { Table, TD, TH, THead, TR } from '../ui/Table'
import { makeLessonIdFactory, useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import {
  generateGroupLessons,
  groupTakesLessons,
  MIGRATION_REASON_TEXT,
  migrateSchedule,
  ownLessons,
} from '../lib/lessons'
import { WEEKDAY_SHORT } from '../lib/date'
import { countLabel } from '../lib/format'

/**
 * §30–§35 — the one-off conversion of existing data.
 *
 * What can be inferred is filled in (§31, §32); everything else lands in
 * «требуют разбора» and is fixed by hand (§33). While that list is not empty,
 * part 6 must not switch payroll to automatic (§35).
 */
export function MigrationPage() {
  const groups = useDataStore((s) => s.groups)
  const subjects = useDataStore((s) => s.subjects)
  const lessons = useDataStore((s) => s.lessons)
  const applyMigration = useDataStore((s) => s.applyMigration)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)
  const [done, setDone] = useState(false)

  const report = useMemo(() => migrateSchedule(groups, subjects), [groups, subjects])

  const willFill = report.patched.filter(
    (g, i) => JSON.stringify(g.schedule) !== JSON.stringify(groups[i].schedule),
  )

  const withoutLessons = report.patched.filter(
    (g) => groupTakesLessons(g) && ownLessons(lessons, g.id).length === 0,
  )

  const run = () => {
    const makeId = makeLessonIdFactory(lessons)
    const created = withoutLessons.flatMap((g) => generateGroupLessons(g, makeId))
    applyMigration(report.patched, created, 'Академ Хэд', `${today} ${time}`)
    setDone(true)
  }

  return (
    <>
      <PartBadge part={2} />

      <PageHeader
        title="Перенос данных"
        subtitle="Проставить предметы и преподавателей там, где это можно вывести, и создать занятия."
        actions={
          <Button
            variant="primary"
            onClick={run}
            disabled={willFill.length === 0 && withoutLessons.length === 0}
          >
            Выполнить перенос
          </Button>
        }
      />

      {done ? (
        <div className="mb-4">
          <Notice tone="info">
            Перенос выполнен. Записан в журнал действий.
          </Notice>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Заполнится автоматически"
          value={willFill.length}
          hint="Групп, где предмет или преподаватель выводится однозначно"
        />
        <StatCard
          label="Требуют разбора"
          value={report.needsReview.length}
          hint="Разбирается вручную"
        />
        <StatCard
          label="Без занятий"
          value={withoutLessons.length}
          hint="Активных групп, для которых занятия ещё не созданы"
        />
      </div>

      <div className="mb-4">
        <Notice tone={report.needsReview.length > 0 ? 'neutral' : 'info'}>
          {report.needsReview.length > 0 ? (
            <>
              Пока список «требуют разбора» не пуст, автоматический расчёт зарплаты
              в части 6 включать нельзя — первый же месяц посчитается криво.
            </>
          ) : (
            <>Список «требуют разбора» пуст — расчёт зарплаты можно переводить в авто.</>
          )}
        </Notice>
      </div>

      <Card flush>
        <div className="px-4 pb-3 pt-4">
          <CardTitle hint={countLabel(report.needsReview.length, 'группа', 'группы', 'групп')}>
            Требуют разбора
          </CardTitle>
        </div>

        {report.needsReview.length === 0 ? (
          <div className="px-4 pb-4">
            <EmptyState>Всё разобрано — ручной работы не осталось.</EmptyState>
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Группа</TH>
                <TH>Причина</TH>
                <TH>Строки</TH>
              </tr>
            </THead>
            <tbody>
              {report.needsReview.map((row) => (
                <TR key={row.group.id}>
                  <TD>
                    <Link
                      to={`/groups/${row.group.id}`}
                      className="font-medium text-slate-900 underline underline-offset-2"
                    >
                      {row.group.title}
                    </Link>
                  </TD>
                  <TD>
                    <Pill tone="warning">{MIGRATION_REASON_TEXT[row.reason]}</Pill>
                  </TD>
                  <TD>
                    {row.rows.map((r) => (
                      <div key={r.id} className="whitespace-nowrap text-sm text-slate-700">
                        {WEEKDAY_SHORT[r.weekday]} {r.startTime}–{r.endTime}
                        {!r.subjectId ? ' · без предмета' : ''}
                        {!r.teacherId ? ' · без преподавателя' : ''}
                      </div>
                    ))}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}
