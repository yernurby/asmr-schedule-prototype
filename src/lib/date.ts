import type { Weekday } from '../data/types'

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  7: 'Вс',
}

export const WEEKDAY_LONG: Record<Weekday, string> = {
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
  7: 'Воскресенье',
}

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

const MONTHS_NOMINATIVE = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
]

/** "2026-08-03" -> "03.08.2026" — the format used across ASMR tables. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/** "2026-08-03" -> "3 августа 2026". */
export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS_GENITIVE[m - 1]} ${y}`
}

/** "2026-08" -> "август 2026". */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${MONTHS_NOMINATIVE[m - 1]} ${y}`
}

/** ISO weekday (1..7) of an ISO date string. */
export function weekdayOf(iso: string): Weekday {
  const d = new Date(`${iso}T00:00:00`)
  const js = d.getDay() // 0 = Sunday
  return (js === 0 ? 7 : js) as Weekday
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function toIsoTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Lifecycle of a group relative to a given "today". */
export type GroupPhase = 'finished' | 'running' | 'upcoming'

export function groupPhase(startDate: string, endDate: string, today: string): GroupPhase {
  if (today < startDate) return 'upcoming'
  if (today > endDate) return 'finished'
  return 'running'
}

export const GROUP_PHASE_LABEL: Record<GroupPhase, string> = {
  finished: 'Завершена',
  running: 'Идёт',
  upcoming: 'Стартует',
}

/** Duration of a "HH:MM"–"HH:MM" range, in hours. */
export function durationHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  return (eh * 60 + em - (sh * 60 + sm)) / 60
}
