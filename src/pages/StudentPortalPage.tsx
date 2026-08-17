import { PageHeader } from '../ui/PageHeader'
import { Card, EmptyState } from '../ui/Card'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'

/**
 * Student portal. In the real system a student sees nothing schedule-related
 * yet, so this page only states that — parts 2 and 4 will give it content.
 */
export function StudentPortalPage() {
  const actorId = useSessionStore((s) => s.actorId)
  const students = useDataStore((s) => s.students)
  const student = students.find((s) => s.id === actorId)

  return (
    <>
      <PageHeader
        title={student?.fullName ?? 'Портал студента'}
        subtitle="У студента в АСМР сейчас нет разделов, связанных с расписанием."
      />
      <Card>
        <EmptyState>
          Пусто. Расписание своих занятий и посещаемость студент увидит после
          частей 2 и 4.
        </EmptyState>
      </Card>
    </>
  )
}
