import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardTitle } from '../../ui/Card'
import { Checkbox } from '../../ui/Field'
import { WeekGrid, assignLanes, type WeekGridBlock } from '../../ui/WeekGrid'
import { WeekNav } from './WeekNav'
import { WindowFinder } from './WindowFinder'
import { useDataStore } from '../../store/useDataStore'
import { useSessionStore } from '../../store/useSessionStore'
import { availabilityOf, isOutsideAvailability } from '../../lib/availability'
import { lessonBlockClass, weekDays } from '../../lib/calendar'
import { stamp } from '../../lib/attendance'
import { weekdayOf } from '../../lib/date'
import { shortName } from '../../lib/people'
import { allTeachers } from '../../lib/subjects'

/** §21–§24 — every teacher's week, filtered, with free windows on demand. */
export function CalendarTab() {
  const navigate = useNavigate()
  const lessons = useDataStore((s) => s.lessons)
  const groups = useDataStore((s) => s.groups)
  const courses = useDataStore((s) => s.courses)
  const subjects = useDataStore((s) => s.subjects)
  const staff = useDataStore((s) => s.staff)
  const availability = useDataStore((s) => s.availability)

  const role = useSessionStore((s) => s.role)
  const actorId = useSessionStore((s) => s.actorId)
  const today = useSessionStore((s) => s.today)
  const time = useSessionStore((s) => s.time)

  const [anchor, setAnchor] = useState(today)
  const [courseIds, setCourseIds] = useState<string[]>([])
  const [subjectIds, setSubjectIds] = useState<string[]>([])
  const [teacherIds, setTeacherIds] = useState<string[]>([])
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [showFree, setShowFree] = useState(false)

  const days = weekDays(anchor)
  const teachers = allTeachers(staff)

  // A curator only ever sees the groups they run.
  const scopedLessons = useMemo(() => {
    if (role !== 'curator' || !actorId) return lessons
    const mine = new Set(
      groups.filter((g) => g.curatorIds.includes(actorId)).map((g) => g.id),
    )
    return lessons.filter((l) => l.groupIds.some((id) => mine.has(id)))
  }, [lessons, role, actorId, groups])

  const filtered = useMemo(() => {
    const daySet = new Set(days)
    return scopedLessons.filter((l) => {
      if (!daySet.has(l.date)) return false
      if (subjectIds.length > 0 && !subjectIds.includes(l.subjectId)) return false
      if (teacherIds.length > 0 && (!l.teacherId || !teacherIds.includes(l.teacherId)))
        return false
      if (groupIds.length > 0 && !l.groupIds.some((id) => groupIds.includes(id)))
        return false
      if (courseIds.length > 0) {
        const ok = l.groupIds.some((id) => {
          const g = groups.find((x) => x.id === id)
          return g ? courseIds.includes(g.courseId) : false
        })
        if (!ok) return false
      }
      return true
    })
  }, [scopedLessons, days, courseIds, subjectIds, teacherIds, groupIds, groups])

  const blocks: WeekGridBlock[] = assignLanes(
    filtered.map((l) => ({ ...l, weekday: weekdayOf(l.date) })),
  ).map(({ item, lane, lanes }) => {
    const subject = subjects.find((s) => s.id === item.subjectId)
    const teacher = staff.find((p) => p.id === item.teacherId)
    const groupTitles = item.groupIds
      .map((id) => groups.find((g) => g.id === id)?.title ?? '')
      .filter(Boolean)
    const short = item.endTime && item.startTime && groupTitles.length > 0
    const outside = isOutsideAvailability(availability, item)
    return {
      key: item.id,
      weekday: item.weekday,
      startTime: item.startTime,
      endTime: item.endTime,
      lane,
      lanes,
      className: lessonBlockClass(item, stamp(today, time)),
      onClick: () => navigate(`/lessons/${item.id}`),
      title: `${item.startTime}–${item.endTime} · ${groupTitles.join(', ')} · ${subject?.title ?? ''} · ${teacher?.fullName ?? 'без преподавателя'}`,
      content: (
        <LessonLabel
          startTime={item.startTime}
          endTime={item.endTime}
          groups={item.groupIds.length > 2 ? `${item.groupIds.length} групп` : groupTitles.join(', ')}
          subject={subject?.title}
          teacher={teacher ? shortName(teacher.fullName) : undefined}
          compact={!short}
          outside={outside}
        />
      ),
    }
  })

  // §23 — availability of the chosen teachers, drawn as a background.
  const background = useMemo(() => {
    if (!showFree) return undefined
    const ids = teacherIds.length > 0 ? teacherIds : teachers.map((t) => t.id)
    const merged = new Set<string>()
    for (const id of ids) for (const cell of availabilityOf(availability, id)) merged.add(cell)
    return merged
  }, [showFree, teacherIds, teachers, availability])

  return (
    <>
      <Card className="mb-4">
        <CardTitle hint={`${filtered.length} занятий на неделе`}>Фильтры</CardTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <MultiPick
            label="Курс"
            options={courses.map((c) => ({ id: c.id, label: c.title }))}
            value={courseIds}
            onChange={setCourseIds}
          />
          <MultiPick
            label="Предмет"
            options={subjects.map((s) => ({
              id: s.id,
              label: s.title,
              hint: courses.find((c) => c.id === s.courseId)?.title,
            }))}
            value={subjectIds}
            onChange={setSubjectIds}
          />
          <MultiPick
            label="Преподаватель"
            options={teachers.map((t) => ({ id: t.id, label: t.fullName }))}
            value={teacherIds}
            onChange={setTeacherIds}
          />
          <MultiPick
            label="Группа"
            options={groups.map((g) => ({ id: g.id, label: g.title }))}
            value={groupIds}
            onChange={setGroupIds}
          />
        </div>

        <div className="mt-3 border-t border-line pt-3">
          <Checkbox
            checked={showFree}
            onChange={setShowFree}
            label="Показывать свободные окна"
            hint="Рисует доступность выбранных преподавателей фоном под занятиями."
          />
        </div>
      </Card>

      <WeekNav anchor={anchor} onChange={setAnchor} today={today} days={days} />

      <WeekGrid
        days={days}
        blocks={blocks}
        background={background}
        todayIso={today}
        nowTime={time}
      />

      {role === 'academ_head' ? (
        <div className="mt-4">
          <WindowFinder />
        </div>
      ) : null}
    </>
  )
}

/** §13 — time, group, subject, teacher; short blocks keep only the first two. */
export function LessonLabel({
  startTime,
  endTime,
  groups,
  subject,
  teacher,
  compact,
  outside,
}: {
  startTime: string
  endTime: string
  groups: string
  subject?: string
  teacher?: string
  compact?: boolean
  outside?: boolean
}) {
  return (
    <>
      <div className="truncate font-medium">
        {startTime}–{endTime}
        {outside ? <span title="Вне доступности"> ⚠</span> : null}
      </div>
      <div className="truncate">{groups}</div>
      {compact ? null : (
        <>
          {subject ? <div className="truncate opacity-80">{subject}</div> : null}
          {teacher ? <div className="truncate opacity-80">{teacher}</div> : null}
        </>
      )}
    </>
  )
}

function MultiPick({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: string; label: string; hint?: string }[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm text-slate-700">{label}</span>
        {value.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-slate-500 underline underline-offset-2"
          >
            сбросить
          </button>
        ) : null}
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto rounded-card border border-line-input p-2">
        {options.map((o) => (
          <Checkbox
            key={o.id}
            checked={value.includes(o.id)}
            onChange={(on) =>
              onChange(on ? [...value, o.id] : value.filter((x) => x !== o.id))
            }
            label={o.label}
            hint={o.hint}
          />
        ))}
      </div>
    </div>
  )
}
