import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

/** Form inputs use gray-200 borders (not slate-200) — verified on screen-19. */
const CONTROL =
  'h-[38px] w-full rounded-card border border-line-input bg-white px-3 text-sm text-slate-800 ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return <input className={`${CONTROL} ${className}`} {...rest} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props
  return (
    <select className={`${CONTROL} ${className}`} {...rest}>
      {children}
    </select>
  )
}

/** Compact variants used inside the top bar, where 38px is too tall. */
export const COMPACT_CONTROL =
  'h-[30px] rounded-card border border-line-input bg-white px-2 text-sm text-slate-800 ' +
  'focus:outline-none focus:ring-2 focus:ring-slate-300'
