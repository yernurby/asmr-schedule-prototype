import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Card'
import { Field, TextInput } from '../ui/Field'
import { useDataStore } from '../store/useDataStore'
import { useSessionStore } from '../store/useSessionStore'
import { formatMonth } from '../lib/date'

/** §14, §15, §18 — freezing warns about leftovers; unfreezing is logged. */
export function FreezeMonthModal({
  month,
  frozen,
  unresolved,
  onClose,
}: {
  month: string
  frozen: boolean
  unresolved: number
  onClose: () => void
}) {
  const setFrozen = useDataStore((s) => s.setMonthFrozenLogged)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)
  const [note, setNote] = useState('')

  return (
    <Modal
      open
      title={frozen ? 'Разморозить месяц' : 'Заморозить месяц'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant={frozen ? 'danger' : 'success'}
            disabled={frozen && note.trim().length === 0}
            onClick={() => {
              setFrozen(month, !frozen, 'Академ Хэд', `${today} ${time}`, note.trim())
              onClose()
            }}
          >
            {frozen ? 'Разморозить' : 'Заморозить'}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-700">{formatMonth(month)}</p>

      {frozen ? (
        <>
          <Notice tone="neutral">
            Разморозка снимает фиксацию сумм и снова разрешает менять расписание
            внутри месяца. Действие попадёт в журнал: кто и когда.
          </Notice>
          <div className="mt-3">
            <Field label="Причина разморозки" hint="Обязательно — уйдёт в журнал.">
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </>
      ) : (
        <>
          {unresolved > 0 ? (
            <div className="mb-3 rounded-card bg-amber-100 px-3 py-2 text-sm text-amber-700">
              Осталось {unresolved} неотмеченных занятий. Заморозить можно, но они
              так и останутся неоплаченными.
            </div>
          ) : null}
          <Notice tone="info">
            После заморозки суммы фиксируются, расписание нельзя менять задним
            числом внутрь месяца, а посещаемость правит только академический
            директор — с записью в журнал.
          </Notice>
        </>
      )}
    </Modal>
  )
}
