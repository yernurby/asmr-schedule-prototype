import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { EmptyState, Notice } from '../ui/Card'
import { Field, TextInput } from '../ui/Field'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import { stamp } from '../lib/attendance'
import { unmarkedLessons } from '../lib/payroll'
import { formatDate } from '../lib/date'

/**
 * §12, §13 — the unmarked lessons behind the red badge, sorted out right here:
 * either counted by hand with a reason, or left unpaid.
 */
export function UnmarkedModal({
  teacherId,
  month,
  onClose,
}: {
  teacherId: string
  month: string
  onClose: () => void
}) {
  const lessons = useDataStore((s) => s.lessons)
  const groups = useDataStore((s) => s.groups)
  const subjects = useDataStore((s) => s.subjects)
  const staff = useDataStore((s) => s.staff)
  const countManually = useDataStore((s) => s.countLessonManually)

  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)
  const now = stamp(today, time)

  const [reason, setReason] = useState('')
  const list = unmarkedLessons(lessons, teacherId, month, now)
  const person = staff.find((p) => p.id === teacherId)

  return (
    <Modal
      open
      title={`Не отмечено · ${person?.fullName ?? ''}`}
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Закрыть
        </Button>
      }
    >
      <div className="mb-3">
        <Notice tone="neutral">
          Эти занятия не оплачиваются. Засчитать их можно вручную — с причиной,
          которая уйдёт в журнал действий.
        </Notice>
      </div>

      <Field label="Причина" hint="Одна на все засчитанные отсюда занятия.">
        <TextInput
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Например: урок был, преподаватель не успел отметить"
        />
      </Field>

      <div className="mt-3 space-y-2">
        {list.length === 0 ? (
          <EmptyState>Всё разобрано.</EmptyState>
        ) : (
          list.map((lesson) => (
            <div
              key={lesson.id}
              className="flex flex-wrap items-center gap-2 rounded-card border border-line px-3 py-2"
            >
              <span className="text-sm text-slate-800">
                {formatDate(lesson.date)} {lesson.startTime}–{lesson.endTime}
              </span>
              <span className="text-sm text-slate-600">
                {lesson.groupIds
                  .map((id) => groups.find((g) => g.id === id)?.title ?? id)
                  .join(', ')}{' '}
                · {subjects.find((s) => s.id === lesson.subjectId)?.title ?? ''}
              </span>
              <div className="ml-auto">
                <Button
                  variant="success"
                  disabled={reason.trim().length === 0}
                  onClick={() =>
                    countLessonSafely(countManually, lesson.id, reason, today, time)
                  }
                >
                  Засчитать
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}

function countLessonSafely(
  countManually: (id: string, reason: string, actor: string, at: string) => void,
  lessonId: string,
  reason: string,
  today: string,
  time: string,
) {
  countManually(lessonId, reason.trim(), 'Академ Хэд', `${today} ${time}`)
}
