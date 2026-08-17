import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RoleId } from '../data/types'
import seed from '../data/seed.json'

const ANCHOR = (seed as { anchorDate: string }).anchorDate

export const SESSION_STORAGE_KEY = 'asmr-schedule-prototype:session'

export interface RoleOption {
  id: RoleId
  /** Sidebar heading, mirrors "Операции" / "Куратор" in the real system. */
  brand: string
  /** Top bar heading, mirrors "Админ" / "Портал куратора". */
  portal: string
  label: string
  /** Whether the role is bound to a specific person from the staff list. */
  needsActor: boolean
}

export const ROLES: RoleOption[] = [
  {
    id: 'academ_head',
    brand: 'Операции',
    portal: 'Академ Хэд',
    label: 'Академический директор',
    needsActor: false,
  },
  {
    id: 'teacher',
    brand: 'Преподаватель',
    portal: 'Портал преподавателя',
    label: 'Преподаватель',
    needsActor: true,
  },
  {
    id: 'curator',
    brand: 'Куратор',
    portal: 'Портал куратора',
    label: 'Куратор',
    needsActor: true,
  },
  {
    id: 'student',
    brand: 'Студент',
    portal: 'Портал студента',
    label: 'Студент',
    needsActor: true,
  },
]

export const roleOption = (id: RoleId): RoleOption =>
  ROLES.find((r) => r.id === id) ?? ROLES[0]

/**
 * Session state: who we are pretending to be, and what the prototype treats as
 * "now". Every screen MUST read the clock from here and never call `new Date()`
 * directly — otherwise the time machine stops working, and part 4 needs it to
 * demonstrate attendance windows.
 */
export interface SessionState {
  role: RoleId
  /** Staff or student id for roles that need a concrete person. */
  actorId: string | null
  /** Prototype "today", ISO date. */
  today: string
  /** Prototype "now", HH:MM. */
  time: string

  setRole: (role: RoleId, actorId: string | null) => void
  setActor: (actorId: string | null) => void
  setToday: (iso: string) => void
  setTime: (hhmm: string) => void
  resetClock: () => void
}

const DEFAULTS = {
  role: 'academ_head' as RoleId,
  actorId: null,
  today: ANCHOR,
  time: '09:00',
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setRole: (role, actorId) => set({ role, actorId }),
      setActor: (actorId) => set({ actorId }),
      setToday: (today) => set({ today }),
      setTime: (time) => set({ time }),
      resetClock: () => set({ today: DEFAULTS.today, time: DEFAULTS.time }),
    }),
    { name: SESSION_STORAGE_KEY, version: 1 },
  ),
)

/** Prototype "now" as a Date — for anything that needs real time arithmetic. */
export function sessionNow(state: SessionState): Date {
  return new Date(`${state.today}T${state.time}:00`)
}
