import { PageHeader } from '../ui/PageHeader'
import { Notice } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { Table, TD, TH, THead, TR } from '../ui/Table'
import { useDataStore } from '../store/useDataStore'
import { countLabel } from '../lib/format'

/**
 * Simplified copy of the real "Курсы" screen (screen-12): a course today is
 * just a title and a status. Part 1 adds subjects here.
 */
export function CoursesPage() {
  const courses = useDataStore((s) => s.courses)
  const groups = useDataStore((s) => s.groups)

  return (
    <>
      <PageHeader
        title="Курсы"
        subtitle="Каталог курсов. Упрощённая копия существующего экрана АСМР."
      />

      <div className="mb-4">
        <Notice tone="info">
          У курса сейчас нет предметов — только название. Часть 1 модуля добавляет
          сюда справочник предметов.
        </Notice>
      </div>

      <Table>
        <THead>
          <tr>
            <TH>Название</TH>
            <TH>Предметы</TH>
            <TH align="right">Группы</TH>
            <TH>Статус</TH>
          </tr>
        </THead>
        <tbody>
          {courses.map((course) => {
            const groupCount = groups.filter((g) => g.courseId === course.id).length
            return (
              <TR key={course.id}>
                <TD className="font-medium text-slate-900">{course.title}</TD>
                <TD>
                  <span className="text-slate-400">— не заданы</span>
                </TD>
                <TD align="right">
                  {groupCount === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    countLabel(groupCount, 'группа', 'группы', 'групп')
                  )}
                </TD>
                <TD>
                  <Pill tone={course.isActive ? 'success' : 'neutral'}>
                    {course.isActive ? 'Активный' : 'Архивный'}
                  </Pill>
                </TD>
              </TR>
            )
          })}
        </tbody>
      </Table>
    </>
  )
}
