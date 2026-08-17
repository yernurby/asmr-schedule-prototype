import { NavLink } from 'react-router-dom'
import { menuFor } from '../navigation'
import { roleOption, useSessionStore } from '../../store/useSessionStore'

/**
 * Left menu: white, 256px, 1px slate-200 right border, brand heading on top —
 * the same chrome as "Операции" / "Куратор" in the real system.
 */
export function Sidebar() {
  const role = useSessionStore((s) => s.role)
  const sections = menuFor(role)

  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-line bg-surface">
      <div className="px-4 py-4">
        <span className="text-base font-semibold text-slate-900">
          {roleOption(role).brand}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-6">
        {sections.map((section, i) => (
          <div key={section.title ?? i} className={i > 0 ? 'mt-6' : ''}>
            {section.title ? (
              <div className="mb-1 border-t border-line px-2 pt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
                {section.title}
              </div>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-3 rounded-card px-3 py-2 text-sm',
                        isActive
                          ? 'bg-muted text-slate-900'
                          : 'text-slate-700 hover:bg-page',
                      ].join(' ')
                    }
                  >
                    <span className="text-slate-500">{item.icon}</span>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
