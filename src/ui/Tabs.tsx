export interface TabItem {
  id: string
  label: string
  count?: number
}

/**
 * Pill-shaped filter tabs used above tables (screen-16 "Все группы (323)").
 * Active tab is solid slate-900, inactive is white with a slate-300 border.
 */
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={[
              'h-[34px] rounded-card px-3 text-sm font-medium transition-colors',
              active
                ? 'bg-slate-900 text-white'
                : 'border border-line-strong bg-white text-slate-700 hover:bg-page',
            ].join(' ')}
          >
            {item.label}
            {item.count !== undefined ? ` (${item.count})` : ''}
          </button>
        )
      })}
    </div>
  )
}

/** Underlined section tabs used on "Зарплата Академа". */
export function SectionTabs({
  items,
  value,
  onChange,
}: {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="mb-5 flex gap-5 border-b border-line">
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={[
              '-mb-px border-b-2 pb-2 text-sm',
              active
                ? 'border-slate-900 font-medium text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
