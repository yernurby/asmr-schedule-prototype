import type { ReactNode } from 'react'
import { useEffect } from 'react'

/**
 * Modal geometry from screen-19: 512px wide, 8px radius, pinned near the top,
 * overlay rgba(0,0,0,0.30).
 */
export function Modal({
  open,
  title,
  onClose,
  footer,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.30)' }}
      onClick={onClose}
    >
      <div
        className="mt-14 w-full max-w-modal rounded-modal bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-1 text-xl leading-none text-slate-400 hover:text-slate-700"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 px-6 pb-5">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}
