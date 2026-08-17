import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
  stack: string | null
}

/**
 * Without this a single render error leaves a white page, which is the worst
 * possible failure mode for something people are asked to click through.
 * Shows what broke and offers the data reset, which fixes most stale-state cases.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, stack: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Both stacks matter: error.stack points at the throwing line, the component
    // stack says which screen it happened on.
    const parts = [error.stack, info.componentStack].filter(Boolean)
    this.setState({ error, stack: parts.join('\n\n— компоненты —\n') })
  }

  render() {
    const { error, stack } = this.state
    if (!error) return this.props.children

    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold text-slate-900">Что-то сломалось</h1>
        <p className="mt-2 text-sm text-slate-700">
          Прототип упал при отрисовке. Ниже — техническая причина.
        </p>

        <pre className="mt-4 overflow-x-auto rounded-card border border-line bg-page p-3 text-xs leading-5 text-slate-800">
          {error.message}
          {stack ? `\n${stack}` : ''}
        </pre>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-[34px] rounded-card border border-line-strong bg-white px-3 text-sm font-medium text-slate-700"
          >
            Перезагрузить
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.clear()
              window.location.reload()
            }}
            className="h-[34px] rounded-card bg-slate-900 px-3 text-sm font-medium text-white"
          >
            Сбросить данные и перезагрузить
          </button>
        </div>
      </div>
    )
  }
}
