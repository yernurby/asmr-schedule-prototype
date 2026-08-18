import { useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Select, TextInput } from '../ui/Field'
import { Notice } from '../ui/Card'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import { hasSubstitution } from '../lib/lessons'
import { formatDate } from '../lib/date'
import { countLabel } from '../lib/format'

/**
 * §18, §19 — cancel a date range at once, narrowed by course or group, with a
 * count shown before anything happens and a separate warning about lessons that
 * already carry a substitution.
 */
export function BulkCancelModal({ onClose }: { onClose: () => void }) {
  const lessons = useDataStore((s) => s.lessons)
  const groups = useDataStore((s) => s.groups)
  const courses = useDataStore((s) => s.courses)
  const staff = useDataStore((s) => s.staff)
  const bulkCancel = useDataStore((s) => s.bulkCancelLessons)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)

  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [courseId, setCourseId] = useState('all')
  const [groupId, setGroupId] = useState('all')
  const [reason, setReason] = useState('')

  const target = useMemo(() => {
    const inCourse = new Set(
      groups.filter((g) => courseId === 'all' || g.courseId === courseId).map((g) => g.id),
    )
    return lessons.filter((l) => {
      if (l.state === 'cancelled') return false
      if (l.date < from || l.date > to) return false
      if (groupId !== 'all' && !l.groupIds.includes(groupId)) return false
      if (courseId !== 'all' && !l.groupIds.some((id) => inCourse.has(id))) return false
      return true
    })
  }, [lessons, groups, from, to, courseId, groupId])

  const teacherCount = new Set(target.map((l) => l.teacherId).filter(Boolean)).size
  const withSubstitution = target.filter(hasSubstitution)
  const summary = `Отменено ${countLabel(target.length, 'занятие', 'занятия', 'занятий')} у ${countLabel(teacherCount, 'преподавателя', 'преподавателей', 'преподавателей')}, ${formatDate(from)} — ${formatDate(to)}`

  return (
    <Modal
      open
      title="Массовая отмена занятий"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="danger"
            disabled={target.length === 0 || reason.trim().length === 0}
            onClick={() => {
              bulkCancel(
                target.map((l) => l.id),
                reason.trim(),
                'Академ Хэд',
                `${today} ${time}`,
                summary,
              )
              onClose()
            }}
          >
            Отменить {target.length}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="С даты">
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="По дату">
            <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>

        <Field label="Курс">
          <Select
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value)
              setGroupId('all')
            }}
          >
            <option value="all">Все курсы</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Группа">
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="all">Все группы</option>
            {groups
              .filter((g) => courseId === 'all' || g.courseId === courseId)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
          </Select>
        </Field>

        <Field label="Причина" hint="Причину увидят преподаватели.">
          <TextInput
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Например: зимние каникулы"
          />
        </Field>
      </div>

      <div className="mt-4 space-y-2">
        <Notice tone="info">
          Будет отменено{' '}
          <strong>
            {countLabel(target.length, 'занятие', 'занятия', 'занятий')}
          </strong>{' '}
          у {countLabel(teacherCount, 'преподавателя', 'преподавателей', 'преподавателей')}.
        </Notice>

        {withSubstitution.length > 0 ? (
          <div className="rounded-card bg-amber-100 px-3 py-2 text-sm text-amber-700">
            <div className="font-medium">
              Внимание: {countLabel(withSubstitution.length, 'занятие', 'занятия', 'занятий')} с
              оформленной заменой
            </div>
            <ul className="mt-1 space-y-0.5">
              {withSubstitution.slice(0, 5).map((l) => (
                <li key={l.id}>
                  {formatDate(l.date)} {l.startTime}–{l.endTime} ·{' '}
                  {staff.find((p) => p.id === l.teacherId)?.fullName ?? '—'} вместо{' '}
                  {staff.find((p) => p.id === l.originalTeacherId)?.fullName ?? '—'}
                </li>
              ))}
              {withSubstitution.length > 5 ? (
                <li>…и ещё {withSubstitution.length - 5}</li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <p className="text-xs text-slate-500">
          Отменённые занятия не идут в зарплату и не считаются пропущенными. Каждое
          можно вернуть обратно.
        </p>
      </div>
    </Modal>
  )
}
