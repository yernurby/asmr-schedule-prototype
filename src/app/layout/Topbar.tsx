import { useState } from 'react'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { RoleSwitcher } from './RoleSwitcher'
import { TimeMachine } from './TimeMachine'
import { roleOption, useSessionStore, SESSION_STORAGE_KEY } from '../../store/useSessionStore'
import { DATA_STORAGE_KEY, useDataStore } from '../../store/useDataStore'
import { APP_STEP, APP_VERSION } from '../../version'

/**
 * Top bar: 64px, white, 1px slate-200 bottom border — same chrome as the real
 * system. The right-hand side carries the prototype controls instead of the
 * tenant / language selectors.
 */
export function Topbar() {
  const role = useSessionStore((s) => s.role)
  const [confirmReset, setConfirmReset] = useState(false)
  const resetData = useDataStore((s) => s.reset)

  const doReset = () => {
    localStorage.removeItem(DATA_STORAGE_KEY)
    localStorage.removeItem(SESSION_STORAGE_KEY)
    resetData()
    window.location.reload()
  }

  return (
    <header className="flex h-topbar shrink-0 items-center gap-4 border-b border-line bg-surface px-6">
      <span className="text-base font-semibold text-slate-900">
        {roleOption(role).portal}
      </span>

      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-slate-400">
          v{APP_VERSION} · {APP_STEP}
        </span>
        <TimeMachine />
        <RoleSwitcher />
        <Button variant="secondary" onClick={() => setConfirmReset(true)}>
          Сбросить данные
        </Button>
      </div>

      <Modal
        open={confirmReset}
        title="Сбросить данные?"
        onClose={() => setConfirmReset(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              Отмена
            </Button>
            <Button variant="primary" onClick={doReset}>
              Сбросить
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          Все изменения, сделанные в прототипе, будут удалены. Данные вернутся к
          стартовому набору, роль и время прототипа — к значениям по умолчанию.
        </p>
      </Modal>
    </header>
  )
}
