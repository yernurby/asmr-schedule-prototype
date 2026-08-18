import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageHeader, PartBadge } from '../ui/PageHeader'
import { Button } from '../ui/Button'
import { Card, CardTitle, EmptyState, Notice, StatCard } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { Select, TextInput } from '../ui/Field'
import { SectionTabs } from '../ui/Tabs'
import { QrPanel } from '../components/QrPanel'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import {
  attendanceWindow,
  audienceOf,
  canEditAttendance,
  countAttendance,
  effectiveState,
  SOURCE_LABEL,
  stamp,
  STATUS_LABEL,
  statusForScan,
} from '../lib/attendance'
import { formatDateLong } from '../lib/date'
import { LESSON_STATE_LABEL, type AttendanceStatus } from '../data/types'

const ROW_LIMIT = 80

/** §10–§22 — the attendance screen: rotate a code, touch only the exceptions. */
export function AttendancePage() {
  const { lessonId = '' } = useParams()
  const lessons = useDataStore((s) => s.lessons)
  const groups = useDataStore((s) => s.groups)
  const students = useDataStore((s) => s.students)
  const subjects = useDataStore((s) => s.subjects)
  const staff = useDataStore((s) => s.staff)
  const enrollments = useDataStore((s) => s.enrollments)
  const attendance = useDataStore((s) => s.attendance)
  const sessions = useDataStore((s) => s.attendanceSessions)
  const claims = useDataStore((s) => s.attendanceClaims)

  const openAttendance = useDataStore((s) => s.openAttendance)
  const setMark = useDataStore((s) => s.setAttendanceMark)
  const clearMark = useDataStore((s) => s.clearAttendanceMark)
  const markRestAbsent = useDataStore((s) => s.markRestAbsent)
  const resolveClaim = useDataStore((s) => s.resolveClaim)
  const logAudit = useDataStore((s) => s.logAudit)

  const role = useSessionStore((s) => s.role)
  const actorId = useSessionStore((s) => s.actorId)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)

  const now = stamp(today, time)
  const at = `${today} ${time}`
  const lesson = lessons.find((l) => l.id === lessonId)

  const [tab, setTab] = useState('list')
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [limit, setLimit] = useState(ROW_LIMIT)

  const myGroups = useMemo(
    () =>
      actorId
        ? groups.filter((g) => g.curatorIds.includes(actorId)).map((g) => g.id)
        : [],
    [groups, actorId],
  )

  if (!lesson) {
    return (
      <>
        <PageHeader title="Занятие не найдено" backTo="/schedule" />
        <Card>
          <EmptyState>Такого занятия нет.</EmptyState>
        </Card>
      </>
    )
  }

  const session = sessions.find((s) => s.lessonId === lesson.id)
  // Not named `window`: that shadows the global, and a stray `!window.open`
  // then reads the always-truthy window.open function and the guard disappears.
  const openWindow = attendanceWindow(lesson, now)
  const state = effectiveState(lesson, now)
  const permission = canEditAttendance(lesson, role, actorId, now, myGroups)
  const sourceOf = role === 'curator' ? 'curator' : role === 'academ_head' ? 'director' : 'teacher'

  // §21 — the whole audience for a teacher, only their own groups for a curator.
  const audience = audienceOf(enrollments, lesson).filter((a) =>
    role === 'curator' ? a.groupIds.some((id) => myGroups.includes(id)) : true,
  )

  const markOf = (studentId: string) =>
    attendance.find((m) => m.lessonId === lesson.id && m.studentId === studentId)

  const counters = countAttendance(attendance, lesson.id, audience.length)
  const outsiders = attendance.filter((m) => m.lessonId === lesson.id && m.outsideGroup)
  const lessonClaims = claims.filter((c) => c.lessonId === lesson.id)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return audience
      .map((a) => ({
        ...a,
        student: students.find((s) => s.id === a.studentId),
        mark: markOf(a.studentId),
      }))
      .filter((r) => r.student)
      .filter((r) => (q ? r.student!.fullName.toLowerCase().includes(q) : true))
      .filter((r) => (groupFilter === 'all' ? true : r.groupIds.includes(groupFilter)))
      // §13 — everyone still unmarked floats to the top.
      .sort((a, b) => {
        const rank = (m?: { status: AttendanceStatus }) =>
          !m ? 0 : m.status === 'absent' ? 1 : 2
        return rank(a.mark) - rank(b.mark) || a.student!.fullName.localeCompare(b.student!.fullName)
      })
  }, [audience, students, attendance, query, groupFilter])

  const change = (studentId: string, next: AttendanceStatus | null) => {
    if (!permission.allowed) return
    if (next === null) clearMark(lesson.id, studentId)
    else setMark({ lessonId: lesson.id, studentId, status: next, source: sourceOf, at })
    // §27 — edits after the lesson closed leave a trace.
    if (now > stamp(lesson.date, lesson.endTime)) {
      const student = students.find((s) => s.id === studentId)
      logAudit({
        at,
        actorName: SOURCE_LABEL[sourceOf],
        action: 'Правка посещаемости',
        details: `${student?.fullName ?? studentId}: ${next ? STATUS_LABEL[next] : 'отметка снята'} · ${lesson.date} ${lesson.startTime}`,
        effectiveFrom: null,
        groupId: lesson.groupIds[0] ?? null,
      })
    }
  }

  /** Prototype scaffolding: there are no real phones, so scans are simulated. */
  const simulateScan = (outsider = false) => {
    if (outsider) {
      const stranger = students.find(
        (s) => !audience.some((a) => a.studentId === s.id) && !markOf(s.id),
      )
      if (stranger) {
        setMark({
          lessonId: lesson.id,
          studentId: stranger.id,
          status: statusForScan(lesson, now),
          source: 'qr',
          at,
          outsideGroup: true,
        })
      }
      return
    }
    const next = audience.find((a) => !markOf(a.studentId))
    if (next) {
      setMark({
        lessonId: lesson.id,
        studentId: next.studentId,
        status: statusForScan(lesson, now),
        source: 'qr',
        at,
      })
    }
  }

  const teacher = staff.find((p) => p.id === lesson.teacherId)

  return (
    <>
      <PartBadge part={4} />

      <PageHeader
        title={`Посещаемость · ${subjects.find((s) => s.id === lesson.subjectId)?.title ?? ''}`}
        subtitle={`${formatDateLong(lesson.date)}, ${lesson.startTime}–${lesson.endTime} · ${lesson.groupIds
          .map((id) => groups.find((g) => g.id === id)?.title ?? id)
          .join(', ')} · ${teacher?.fullName ?? 'без преподавателя'}`}
        backTo="/schedule"
        actions={
          <div className="flex items-center gap-2">
            <Pill tone={state === 'held' ? 'success' : state === 'unmarked' ? 'danger' : 'neutral'}>
              {LESSON_STATE_LABEL[state]}
            </Pill>
            {!session ? (
              <Button
                variant="primary"
                disabled={!openWindow.open}
                onClick={() => openAttendance(lesson.id, SOURCE_LABEL[sourceOf], at)}
              >
                Провести занятие
              </Button>
            ) : null}
          </div>
        }
      />

      {!session ? (
        <Card>
          {openWindow.open ? (
            <Notice tone="info">
              Нажмите «Провести занятие», чтобы открыть отметку. Это же действие
              фиксирует, что урок состоялся — именно оно попадёт в зарплату.
            </Notice>
          ) : (
            <Notice tone="neutral">
              {openWindow.tooEarly
                ? 'Отметка откроется за 10 минут до начала занятия.'
                : 'Окно отметки закрыто — оно работает до 15 минут после конца занятия. Сначала перенесите занятие.'}
            </Notice>
          )}
        </Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard label="Отметились" value={counters.present} />
            <StatCard label="Опоздали" value={counters.late} />
            <StatCard label="Не отметились" value={counters.absent} />
            <StatCard
              label="Вручную"
              value={counters.manual}
              hint={`из ${counters.total}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card>
              <CardTitle>Код для отметки</CardTitle>
              <QrPanel session={session} />
              <div className="mt-4 border-t border-line pt-3">
                <div className="mb-1.5 text-xs uppercase tracking-wide text-slate-400">
                  Прототип
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => simulateScan(false)}>
                    Симулировать скан
                  </Button>
                  <Button variant="secondary" onClick={() => simulateScan(true)}>
                    Скан не из группы
                  </Button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Настоящих телефонов здесь нет, поэтому сканы имитируются. Время
                  скана берётся из панели времени, поэтому после 15 минут от начала
                  отметка станет опозданием.
                </p>
              </div>
            </Card>

            <Card flush>
              <div className="px-4 pt-4">
                <SectionTabs
                  items={[
                    { id: 'list', label: `Список (${audience.length})` },
                    { id: 'claims', label: `Заявки (${lessonClaims.filter((c) => c.status === 'pending').length})` },
                  ]}
                  value={tab}
                  onChange={setTab}
                />
              </div>

              {tab === 'claims' ? (
                <div className="px-4 pb-4">
                  {lessonClaims.length === 0 ? (
                    <EmptyState>Заявок нет.</EmptyState>
                  ) : (
                    <div className="space-y-2">
                      {lessonClaims.map((claim) => {
                        const student = students.find((s) => s.id === claim.studentId)
                        return (
                          <div
                            key={claim.id}
                            className="rounded-card border border-line px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-slate-900">
                                {student?.fullName ?? claim.studentId}
                              </span>
                              <span className="text-xs text-slate-500">{claim.at}</span>
                              {claim.status !== 'pending' ? (
                                <Pill tone={claim.status === 'approved' ? 'success' : 'neutral'}>
                                  {claim.status === 'approved' ? 'Подтверждена' : 'Отклонена'}
                                </Pill>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-slate-700">{claim.comment}</p>
                            {claim.status === 'pending' && permission.allowed ? (
                              <div className="mt-2 flex gap-2">
                                <Button
                                  variant="success"
                                  onClick={() => resolveClaim(claim.id, true, 'student_request', at)}
                                >
                                  Подтвердить
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => resolveClaim(claim.id, false, 'student_request', at)}
                                >
                                  Отклонить
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-end gap-3 px-4 pb-3">
                    <label className="block min-w-[200px] flex-1">
                      <span className="mb-1.5 block text-sm text-slate-700">Поиск</span>
                      <TextInput
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Имя студента"
                      />
                    </label>
                    {lesson.groupIds.length > 1 ? (
                      <label className="block min-w-[200px]">
                        <span className="mb-1.5 block text-sm text-slate-700">Группа</span>
                        <Select
                          value={groupFilter}
                          onChange={(e) => setGroupFilter(e.target.value)}
                        >
                          <option value="all">Все группы</option>
                          {lesson.groupIds.map((id) => (
                            <option key={id} value={id}>
                              {groups.find((g) => g.id === id)?.title ?? id}
                            </option>
                          ))}
                        </Select>
                      </label>
                    ) : null}
                    <Button
                      variant="secondary"
                      disabled={!permission.allowed}
                      onClick={() =>
                        markRestAbsent(
                          lesson.id,
                          audience.map((a) => a.studentId),
                          sourceOf,
                          at,
                        )
                      }
                    >
                      Остальных — отсутствовали
                    </Button>
                  </div>

                  {!permission.allowed ? (
                    <div className="px-4 pb-3">
                      <Notice tone="neutral">{permission.reason}</Notice>
                    </div>
                  ) : null}

                  {outsiders.length > 0 ? (
                    <div className="px-4 pb-3">
                      <div className="rounded-card bg-amber-100 px-3 py-2 text-sm text-amber-700">
                        Отсканировали не из этой группы: {outsiders.length}.{' '}
                        {outsiders
                          .slice(0, 4)
                          .map((m) => students.find((s) => s.id === m.studentId)?.fullName)
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    </div>
                  ) : null}

                  <div className="divide-y divide-muted border-t border-line">
                    {rows.slice(0, limit).map((row) => {
                      const mark = row.mark
                      const status: AttendanceStatus | null = mark ? mark.status : null
                      return (
                        <div
                          key={row.studentId}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2"
                        >
                          <span className="min-w-[180px] flex-1 text-sm text-slate-800">
                            {row.student!.fullName}
                            {lesson.groupIds.length > 1 ? (
                              <span className="ml-2 text-xs text-slate-500">
                                {row.groupIds
                                  .map((id) => groups.find((g) => g.id === id)?.title ?? id)
                                  .join(', ')}
                              </span>
                            ) : null}
                          </span>

                          {mark ? (
                            <span className="text-xs text-slate-500">
                              {SOURCE_LABEL[mark.source]} · {mark.at.slice(11)}
                            </span>
                          ) : null}

                          {/* §14 — one click per status, no dialog. */}
                          <div className="flex gap-1">
                            {(['present', 'late', 'absent'] as AttendanceStatus[]).map((s) => (
                              <button
                                key={s}
                                type="button"
                                disabled={!permission.allowed}
                                onClick={() => change(row.studentId, status === s ? null : s)}
                                className={[
                                  'h-[26px] rounded-card px-2 text-xs font-medium transition-colors',
                                  status === s
                                    ? s === 'present'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : s === 'late'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-slate-100 text-slate-600'
                                    : 'border border-line-strong bg-white text-slate-500 hover:bg-page',
                                  permission.allowed ? '' : 'cursor-not-allowed opacity-60',
                                ].join(' ')}
                              >
                                {STATUS_LABEL[s]}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}

                    {rows.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-slate-500">
                        Никого не найдено.
                      </div>
                    ) : null}
                  </div>

                  {rows.length > limit ? (
                    <div className="px-4 py-3">
                      <Button variant="secondary" onClick={() => setLimit(limit + ROW_LIMIT)}>
                        Показать ещё ({rows.length - limit})
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  )
}
