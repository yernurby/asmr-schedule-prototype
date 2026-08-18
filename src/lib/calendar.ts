import type { Lesson } from '../data/types'
import { addDays, weekdayOf } from './date'

/** The seven ISO dates of the week containing `iso`, Monday first. */
export function weekDays(iso: string): string[] {
  const monday = addDays(iso, 1 - weekdayOf(iso))
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function shiftWeek(iso: string, weeks: number): string {
  return addDays(iso, weeks * 7)
}

/**
 * §14 — colour carries the state, with separate colours for a lecture that runs
 * on several groups and for any other lesson created outside a group schedule.
 * All values come from the stock Tailwind palette the rest of ASMR uses.
 */
export function lessonBlockClass(lesson: Lesson): string {
  if (lesson.state === 'cancelled') {
    return 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-line line-through'
  }
  if (lesson.state === 'held') {
    return 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200'
  }
  if (lesson.state === 'unmarked') {
    return 'bg-red-100 text-rose-800 ring-1 ring-inset ring-red-200'
  }
  const shared = lesson.sourceRowId === null
  if (shared && lesson.groupIds.length > 1) {
    return 'bg-violet-100 text-violet-800 ring-1 ring-inset ring-violet-200'
  }
  if (shared) {
    return 'bg-indigo-100 text-indigo-800 ring-1 ring-inset ring-indigo-200'
  }
  return 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200'
}

export const CALENDAR_LEGEND: { className: string; label: string }[] = [
  { className: 'bg-blue-100 ring-1 ring-inset ring-blue-200', label: 'Запланировано' },
  { className: 'bg-emerald-100 ring-1 ring-inset ring-emerald-200', label: 'Проведено' },
  { className: 'bg-red-100 ring-1 ring-inset ring-red-200', label: 'Не отмечено' },
  { className: 'bg-slate-100 ring-1 ring-inset ring-line', label: 'Отменено' },
  {
    className: 'bg-violet-100 ring-1 ring-inset ring-violet-200',
    label: 'Лекция на несколько групп',
  },
  {
    className: 'bg-indigo-100 ring-1 ring-inset ring-indigo-200',
    label: 'Общее занятие',
  },
  { className: 'bg-emerald-100/70', label: 'Доступность преподавателя' },
]

/** Lessons of a week, as calendar rows. */
export function lessonsOfWeek(lessons: Lesson[], days: string[]): Lesson[] {
  const set = new Set(days)
  return lessons.filter((l) => set.has(l.date))
}
