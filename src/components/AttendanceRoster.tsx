import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Pill } from '../ui/Pill'
import { TextInput } from '../ui/Field'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import {
  audienceOf,
  canEditAttendance,
  countAttendance,
  stamp,
  STATUS_LABEL,
  SOURCE_LABEL,
} from '../lib/attendance'
import type { AttendanceStatus, Lesson } from '../data/types'

const STATUSES: AttendanceStatus[] = ['present', 'late', 'absent']

/**
 * The class list behind any lesson: who was there, where the mark came from, and
 * — when the role is allowed to — one-click editing.
 *
 * Used from the lesson card and from the teacher's week, so that clicking a
 * lesson anywhere shows the people in it, not just its time.
 */
export function AttendanceRoster({
  lesson,
  compact = false,
}: {
  lesson: Lesson
  compact?: boolean
}) {
  const students = useDataStore((s) => s.students)
  const groups = useDataStore((s) => s.groups)
  const enrollments = useDataStore((s) => s.enrollments)
  const attendance = useDataStore((s) => s.attendance)
  const setMark = useDataStore((s) => s.setAttendanceMark)
  const clearMark = useDataStore((s) => s.clearAttendanceMark)

  const role = useSessionStore((s) => s.role)
  const actorId = useSessionStore((s) => s.actorId)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)
  const now = stamp(today, time)
  const at = `${today} ${time}`

  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(compact ? 8 : 40)

  const myGroups = useMemo(
    () =>
      actorId ? groups.filter((g) => g.curatorIds.includes(actorId)).map((g) => g.id) : [],
    [groups, actorId],
  )

  const permission = canEditAttendance(lesson, role, actorId, now, myGroups)
  const source = role === 'curator' ? 'curator' : role === 'academ_head' ? 'director' : 'teacher'

  const audience = audienceOf(enrollments, lesson).filter((a) =>
    role === 'curator' ? a.groupIds.some((id) => myGroups.includes(id)) : true,
  )
  const counters = countAttendance(attendance, lesson.id, audience.length)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return audience
      .map((a) => ({
        ...a,
        student: students.find((s) => s.id === a.studentId),
        mark: attendance.find(
          (m) => m.lessonId === lesson.id && m.studentId === a.studentId,
        ),
      }))
      .filter((r) => r.student)
      .filter((r) => (q ? r.student!.fullName.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        const rank = (m?: { status: AttendanceStatus }) =>
          !m ? 0 : m.status === 'absent' ? 1 : 2
        return (
          rank(a.mark) - rank(b.mark) ||
          a.student!.fullName.localeCompare(b.student!.fullName)
        )
      })
  }, [audience, students, attendance, lesson.id, query])

  const change = (studentId: string, next: AttendanceStatus) => {
    if (!permission.allowed) return
    const current = attendance.find(
      (m) => m.lessonId === lesson.id && m.studentId === studentId,
    )
    if (current?.status === next) clearMark(lesson.id, studentId)
    else setMark({ lessonId: lesson.id, studentId, status: next, source, at })
  }

  if (audience.length === 0) {
    return <p className="text-sm text-slate-500">В этом занятии нет студентов.</p>
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Pill tone="success">был {counters.present}</Pill>
        <Pill tone="warning">опоздал {counters.late}</Pill>
        <Pill tone="neutral">не отметились {counters.absent}</Pill>
        {counters.manual > 0 ? <Pill tone="info">вручную {counters.manual}</Pill> : null}
        <Link
          to={`/attendance/${lesson.id}`}
          className="ml-auto text-sm text-slate-700 underline underline-offset-2"
        >
          Открыть экран отметки
        </Link>
      </div>

      {!permission.allowed && permission.reason ? (
        <p className="mb-2 rounded-card bg-muted px-3 py-2 text-xs text-slate-600">
          {permission.reason}
        </p>
      ) : null}

      {audience.length > 8 ? (
        <div className="mb-2">
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени"
          />
        </div>
      ) : null}

      <div className="divide-y divide-muted rounded-card border border-line">
        {rows.slice(0, limit).map((row) => (
          <div key={row.studentId} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="text-sm text-slate-800">{row.student!.fullName}</span>
            {row.mark ? (
              <span className="text-xs text-slate-400">
                {SOURCE_LABEL[row.mark.source] ?? row.mark.source}
              </span>
            ) : null}
            <div className="ml-auto flex gap-1">
              {STATUSES.map((status) => {
                const active = row.mark ? row.mark.status === status : status === 'absent'
                return (
                  <button
                    key={status}
                    type="button"
                    disabled={!permission.allowed}
                    onClick={() => change(row.studentId, status)}
                    className={[
                      'h-[26px] rounded-card px-2 text-xs font-medium transition-colors',
                      active
                        ? status === 'present'
                          ? 'bg-emerald-100 text-emerald-700'
                          : status === 'late'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-muted text-slate-500'
                        : 'text-slate-400 hover:bg-page',
                      permission.allowed ? '' : 'cursor-not-allowed',
                    ].join(' ')}
                  >
                    {STATUS_LABEL[status]}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {rows.length > limit ? (
        <div className="mt-2">
          <Button variant="secondary" onClick={() => setLimit(limit + 40)}>
            Показать ещё ({rows.length - limit})
          </Button>
        </div>
      ) : null}
    </div>
  )
}
