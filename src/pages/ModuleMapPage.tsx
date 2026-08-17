import { Link } from 'react-router-dom'
import { PageHeader } from '../ui/PageHeader'
import { Card, Notice } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { MODULE_PARTS, STATUS_LABEL, type PartStatus } from '../data/moduleMap'

const STATUS_TONE: Record<PartStatus, 'neutral' | 'warning' | 'success'> = {
  planned: 'neutral',
  'in-progress': 'warning',
  done: 'success',
}

export function ModuleMapPage() {
  return (
    <>
      <PageHeader
        title="Карта модуля"
        subtitle="Шесть частей модуля расписания: что входит, от чего зависит и что смотреть в прототипе."
      />

      <div className="mb-4">
        <Notice tone="info">
          Сейчас готов только каркас. Логика частей появляется по мере того, как
          приходит техническое задание на каждую из них — карта обновляется на
          каждом шаге.
        </Notice>
      </div>

      <div className="space-y-4">
        {MODULE_PARTS.map((part) => (
          <Card key={part.number}>
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500">Часть {part.number}</div>
                <h2 className="mt-0.5 text-base font-semibold text-slate-900">
                  {part.title}
                </h2>
                <p className="mt-1 max-w-3xl text-sm text-slate-700">{part.goal}</p>
              </div>
              <Pill tone={STATUS_TONE[part.status]}>{STATUS_LABEL[part.status]}</Pill>
            </div>

            <div className="grid grid-cols-1 gap-6 border-t border-line pt-3 md:grid-cols-4">
              <Column title="Что входит">
                <ul className="space-y-1">
                  {part.includes.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Column>

              <Column title="От чего зависит">
                {part.dependsOn.length === 0 ? (
                  <span className="text-slate-400">Ни от чего</span>
                ) : (
                  <ul className="space-y-1">
                    {part.dependsOn.map((n) => (
                      <li key={n}>
                        Часть {n} · {MODULE_PARTS[n - 1].title}
                      </li>
                    ))}
                  </ul>
                )}
              </Column>

              <Column title="Экраны прототипа">
                {part.screens.length === 0 ? (
                  <span className="text-slate-400">Пока нет</span>
                ) : (
                  <ul className="space-y-1">
                    {part.screens.map((s) => (
                      <li key={s.to}>
                        <Link to={s.to} className="text-slate-700 underline underline-offset-2">
                          {s.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Column>

              <Column title="Что смотреть">
                <ul className="space-y-1">
                  {part.whatToLook.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Column>
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="text-sm leading-6 text-slate-700">{children}</div>
    </div>
  )
}
