import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader, PartBadge } from '../../ui/PageHeader'
import { Button } from '../../ui/Button'
import { SectionTabs } from '../../ui/Tabs'
import { SharedLessonModal } from '../../components/SharedLessonModal'
import { BulkCancelModal } from '../../components/BulkCancelModal'
import { useSessionStore } from '../../store/useSessionStore'
import { CalendarTab } from './CalendarTab'
import { MyScheduleTab } from './MyScheduleTab'
import { AvailabilityTab } from './AvailabilityTab'
import { WorkloadTab } from './WorkloadTab'
import { ConflictsTab } from './ConflictsTab'
import { LessonsTab } from './LessonsTab'
import { AttendanceListTab } from './AttendanceListTab'
import { RegistryTab } from './RegistryTab'
import { AnalyticsTab } from './AnalyticsTab'
import { MyEventsTab } from './MyEventsTab'
import type { RoleId } from '../../data/types'

interface TabDef {
  id: string
  label: string
  render: () => ReactNode
}

/**
 * §32 — calendar, workload and the lesson list live in one section with tabs,
 * instead of growing the left menu. §33 — "Новое занятие" and "Отменить занятия"
 * sit in the section header, so they work from any tab.
 */
export function SchedulePage() {
  const navigate = useNavigate()
  const { tab } = useParams()
  const role = useSessionStore((s) => s.role)
  const [creating, setCreating] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const tabs = tabsFor(role)
  const active = tabs.find((t) => t.id === tab) ?? tabs[0]
  const isDirector = role === 'academ_head'

  return (
    <>
      <PartBadge part={3} />

      <PageHeader
        title="Расписание"
        subtitle="Календарь, доступность и нагрузка."
        actions={
          isDirector ? (
            <>
              <Button variant="secondary" onClick={() => setCancelling(true)}>
                Отменить занятия
              </Button>
              <Button variant="primary" onClick={() => setCreating(true)}>
                Новое занятие
              </Button>
            </>
          ) : undefined
        }
      />

      <SectionTabs
        items={tabs.map((t) => ({ id: t.id, label: t.label }))}
        value={active.id}
        onChange={(id) => navigate(`/schedule/${id}`)}
      />

      {active.render()}

      {creating ? <SharedLessonModal onClose={() => setCreating(false)} /> : null}
      {cancelling ? <BulkCancelModal onClose={() => setCancelling(false)} /> : null}
    </>
  )
}

function tabsFor(role: RoleId): TabDef[] {
  if (role === 'teacher') {
    return [
      { id: 'my', label: 'Моё расписание', render: () => <MyScheduleTab /> },
      { id: 'availability', label: 'Моя доступность', render: () => <AvailabilityTab /> },
      { id: 'events', label: 'Замены и переносы', render: () => <MyEventsTab /> },
      { id: 'lessons', label: 'Список занятий', render: () => <LessonsTab /> },
    ]
  }
  if (role === 'curator') {
    return [
      { id: 'calendar', label: 'Календарь', render: () => <CalendarTab /> },
      // §24 — the curator reaches attendance of their groups directly.
      { id: 'attendance', label: 'Посещаемость', render: () => <AttendanceListTab /> },
      { id: 'lessons', label: 'Список занятий', render: () => <LessonsTab /> },
    ]
  }
  return [
    { id: 'calendar', label: 'Календарь', render: () => <CalendarTab /> },
    { id: 'lessons', label: 'Список занятий', render: () => <LessonsTab /> },
    { id: 'attendance', label: 'Посещаемость', render: () => <AttendanceListTab /> },
    // §35 — everything unmarked in the month, to clear before payroll closes.
    {
      id: 'unmarked',
      label: 'Не отмечено',
      render: () => <AttendanceListTab unmarkedOnly />,
    },
    { id: 'registry', label: 'Замены и переносы', render: () => <RegistryTab /> },
    { id: 'analytics', label: 'Аналитика', render: () => <AnalyticsTab /> },
    { id: 'workload', label: 'Нагрузка', render: () => <WorkloadTab /> },
    { id: 'conflicts', label: 'Вне доступности', render: () => <ConflictsTab /> },
  ]
}
