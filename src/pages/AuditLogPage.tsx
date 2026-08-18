import { PageHeader, PartBadge } from '../ui/PageHeader'
import { Card, EmptyState } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { SubText, Table, TD, TH, THead, TR } from '../ui/Table'
import { useDataStore } from '../store/useDataStore'
import { formatDate } from '../lib/date'

/**
 * §29 — every schedule change lands here: who, when, what and from which date.
 * This is the answer to "почему у меня в марте на два урока меньше".
 */
export function AuditLogPage() {
  const auditLog = useDataStore((s) => s.auditLog)
  const groups = useDataStore((s) => s.groups)

  return (
    <>
      <PartBadge part={2} />

      <PageHeader
        title="Журнал действий"
        subtitle="Изменения расписания, отмены и переносы — с датой вступления в силу."
      />

      {auditLog.length === 0 ? (
        <Card>
          <EmptyState>Записей пока нет.</EmptyState>
        </Card>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Когда</TH>
              <TH>Кто</TH>
              <TH>Действие</TH>
              <TH>Что изменилось</TH>
              <TH>Действует с</TH>
            </tr>
          </THead>
          <tbody>
            {auditLog.map((entry) => {
              const group = groups.find((g) => g.id === entry.groupId)
              return (
                <TR key={entry.id}>
                  <TD className="whitespace-nowrap">{entry.at}</TD>
                  <TD>{entry.actorName}</TD>
                  <TD>
                    <span className="font-medium text-slate-900">{entry.action}</span>
                    {group ? <SubText>{group.title}</SubText> : null}
                  </TD>
                  <TD>{entry.details}</TD>
                  <TD>
                    {entry.effectiveFrom ? (
                      <Pill tone="warning">{formatDate(entry.effectiveFrom)}</Pill>
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
    </>
  )
}
