import { useMemo, useState } from 'react'
import { marked } from 'marked'
import { PageHeader } from '../ui/PageHeader'
import { Card, EmptyState } from '../ui/Card'

/**
 * Reads the spec files straight out of /docs at build time, so the prototype
 * always shows the same text that was handed over — no copy in two places.
 */
const RAW = import.meta.glob('/docs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

interface DocEntry {
  path: string
  file: string
  title: string
  markdown: string
}

const TITLES: Record<string, string> = {
  'design-tokens.md': 'Design tokens',
  'existing-screens.md': 'Существующие экраны АСМР',
  '01-предметы-курсов.md': 'Часть 1 · Предметы у курсов',
  '02-занятия-и-расписание.md': 'Часть 2 · Занятия и изменение расписания',
}

/** Known files get a friendly title; otherwise fall back to the first heading. */
function titleFor(file: string, markdown: string): string {
  if (TITLES[file]) return TITLES[file]
  const heading = markdown.match(/^#\s+(.+)$/m)
  if (heading) return heading[1].trim()
  const firstLine = markdown.split('\n').find((l) => l.trim().length > 0)
  if (firstLine) return firstLine.replace(/^#+\s*/, '').trim()
  return file.replace(/\.md$/, '')
}

const DOCS: DocEntry[] = Object.entries(RAW)
  .map(([path, markdown]) => {
    const file = path.split('/').pop() ?? path
    return { path, file, title: titleFor(file, markdown), markdown }
  })
  .sort((a, b) => a.file.localeCompare(b.file, 'ru'))

export function RequirementsPage() {
  const [active, setActive] = useState(DOCS[0]?.file ?? '')
  const current = DOCS.find((d) => d.file === active) ?? DOCS[0]

  const html = useMemo(
    () => (current ? (marked.parse(current.markdown, { async: false }) as string) : ''),
    [current],
  )

  return (
    <>
      <PageHeader
        title="Требования"
        subtitle="Тексты технического задания и рабочие документы модуля — как есть, из папки docs/."
      />

      {DOCS.length === 0 ? (
        <Card>
          <EmptyState>В папке docs/ пока нет документов.</EmptyState>
        </Card>
      ) : (
        <div className="flex gap-6">
          <nav className="w-64 shrink-0">
            <ul className="space-y-0.5">
              {DOCS.map((doc) => (
                <li key={doc.file}>
                  <button
                    type="button"
                    onClick={() => setActive(doc.file)}
                    className={[
                      'w-full rounded-card px-3 py-2 text-left text-sm',
                      doc.file === current?.file
                        ? 'bg-muted text-slate-900'
                        : 'text-slate-700 hover:bg-white',
                    ].join(' ')}
                  >
                    {doc.title}
                    <span className="mt-0.5 block text-xs text-slate-400">{doc.file}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <Card className="min-w-0 flex-1 px-6 py-5">
            <article className="md max-w-4xl" dangerouslySetInnerHTML={{ __html: html }} />
          </Card>
        </div>
      )}
    </>
  )
}
