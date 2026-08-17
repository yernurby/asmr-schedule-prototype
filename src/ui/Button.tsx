import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger'

/**
 * Button variants measured from reference/screens — see docs/design-tokens.md §5.
 * Height 34px, radius 6px, 14px medium. Do not add variants without a screenshot.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800',
  secondary:
    'bg-white text-slate-700 border border-line-strong hover:bg-page',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  danger: 'bg-white text-rose-700 border border-rose-700 hover:bg-rose-50',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  children: ReactNode
}

export function Button({ variant = 'secondary', className = '', children, ...rest }: Props) {
  return (
    <button
      type="button"
      className={[
        'inline-flex h-[34px] items-center gap-2 rounded-card px-3 text-sm font-medium',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
        VARIANTS[variant],
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}

export type ActionTone = 'neutral' | 'danger' | 'success'

const ACTION_TONES: Record<ActionTone, string> = {
  neutral: 'text-slate-700',
  danger: 'text-red-600',
  success: 'text-emerald-600',
}

/** Underlined text action used inside table rows ("Редактировать", "Архивировать"). */
export function ActionLink({
  tone = 'neutral',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ActionTone; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`text-sm underline underline-offset-2 hover:no-underline ${ACTION_TONES[tone]}`}
      {...rest}
    >
      {children}
    </button>
  )
}
