import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/Field'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import { formatDate } from '../lib/date'
import type { Lesson } from '../data/types'

/** §17 — one lesson, one reason, and the teacher sees it. */
export function CancelLessonModal({
  lesson,
  onClose,
}: {
  lesson: Lesson
  onClose: () => void
}) {
  const cancelLesson = useDataStore((s) => s.cancelLesson)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)
  const [reason, setReason] = useState('')

  return (
    <Modal
      open
      title="Отменить занятие"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim().length === 0}
            onClick={() => {
              cancelLesson(lesson.id, reason.trim(), 'Академ Хэд', `${today} ${time}`)
              onClose()
            }}
          >
            Отменить занятие
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-700">
        {formatDate(lesson.date)}, {lesson.startTime}–{lesson.endTime}
      </p>
      <Field label="Причина" hint="Причину увидит преподаватель.">
        <TextInput
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Например: государственный праздник"
          autoFocus
        />
      </Field>
      <p className="mt-3 text-xs text-slate-500">
        Отменённое занятие не идёт в зарплату и не считается пропущенным. Его можно
        вернуть обратно.
      </p>
    </Modal>
  )
}
