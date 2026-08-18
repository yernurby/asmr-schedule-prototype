import { Link } from 'react-router-dom'
import { Card, CardTitle, EmptyState, Notice } from '../../ui/Card'
import { ActionLink } from '../../ui/Button'
import { Pill } from '../../ui/Pill'
import { SubText, Table, TD, TH, THead, TR } from '../../ui/Table'
import { useDataStore } from '../../store/useDataStore'
import { useSessionStore } from '../../store/useSessionStore'
import { outsideAvailabilitySlots } from '../../lib/availability'
import { formatDate, WEEKDAY_LONG } from '../../lib/date'
import { countLabel } from '../../lib/format'

/** §7 — every out-of-availability slot across all teachers, in one place. */
export function ConflictsTab() {
  const availability = useDataStore((s) => s.availability)
  const lessons = useDataStore((s) => s.lessons)
  const staff = useDataStore((s) => s.staff)
  const groups = useDataStore((s) => s.groups)
  const subjects = useDataStore((s) => s.subjects)
  const requests = useDataStore((s) => s.reshuffleRequests)
  const dismissReshuffle = useDataStore((s) => s.dismissReshuffle)
  const today = useSessionStore((s) => s.today)

  const slots = outsideAvailabilitySlots(availability, lessons, today)

  return (
    <>
      <div className="mb-4">
        <Notice tone="info">
          Доступность ничего не запрещает — это заявление о намерениях. Список
          показывает, где расписание расходится с ним, чтобы вы решали сами.
          Жёстким ограничением доступность станет в части 5, при переносах.
        </Notice>
      </div>

      <Card flush>
        <div className="px-4 pb-3 pt-4">
          <CardTitle
            hint={`${countLabel(slots.length, 'слот', 'слота', 'слотов')}, запросов: ${requests.length}`}
          >
            Занятия вне доступности
          </CardTitle>
        </div>

        {slots.length === 0 ? (
          <div className="px-4 pb-4">
            <EmptyState>Расхождений нет.</EmptyState>
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Преподаватель</TH>
                <TH>Слот</TH>
                <TH>Группа и предмет</TH>
                <TH align="right">Занятий впереди</TH>
                <TH>Запрос</TH>
              </tr>
            </THead>
            <tbody>
              {slots.map((slot) => {
                const teacher = staff.find((p) => p.id === slot.teacherId)
                const request = requests.find(
                  (r) =>
                    r.teacherId === slot.teacherId &&
                    slot.lessons.some((l) => l.id === r.lessonId),
                )
                return (
                  <TR key={slot.key}>
                    <TD className="font-medium text-slate-900">
                      {teacher?.fullName ?? slot.teacherId}
                    </TD>
                    <TD>
                      {WEEKDAY_LONG[slot.weekday]} {slot.startTime}–{slot.endTime}
                      <SubText>ближайшее {formatDate(slot.lessons[0].date)}</SubText>
                    </TD>
                    <TD>
                      {slot.groupIds
                        .map((id) => groups.find((g) => g.id === id)?.title ?? id)
                        .join(', ')}
                      <SubText>
                        {subjects.find((s) => s.id === slot.subjectId)?.title ?? ''}
                      </SubText>
                    </TD>
                    <TD align="right">
                      <Link
                        to={`/lessons/${slot.lessons[0].id}`}
                        className="underline underline-offset-2"
                      >
                        {slot.lessons.length}
                      </Link>
                    </TD>
                    <TD>
                      {request ? (
                        <div className="space-y-1">
                          <Pill tone="warning">Просит перестановку</Pill>
                          <div className="text-xs text-slate-500">{request.note}</div>
                          <ActionLink onClick={() => dismissReshuffle(request.id)}>
                            Закрыть запрос
                          </ActionLink>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TD>
                  </TR>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}
