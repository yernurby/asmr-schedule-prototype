import type { ReactNode } from 'react'
import type { RoleId } from '../data/types'
import * as Icon from '../ui/icons'

export interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

export interface NavSection {
  /** Optional small heading above the group, e.g. "Прототип". */
  title?: string
  items: NavItem[]
}

/**
 * Menus per role. Screens that belong to the schedule module get added here as
 * parts 1..6 land; existing ASMR screens are the simplified read-only ones.
 *
 * Teacher and student portals are intentionally empty for now — in the real
 * system they have nothing yet.
 */
const PROTOTYPE_SECTION: NavSection = {
  title: 'Прототип',
  items: [
    { to: '/module-map', label: 'Карта модуля', icon: <Icon.Map /> },
    { to: '/requirements', label: 'Требования', icon: <Icon.Doc /> },
  ],
}

const MENUS: Record<RoleId, NavSection[]> = {
  academ_head: [
    {
      items: [
        { to: '/courses', label: 'Курсы', icon: <Icon.Book /> },
        { to: '/groups', label: 'Группы', icon: <Icon.Calendar /> },
        { to: '/staff', label: 'Сотрудники', icon: <Icon.Users /> },
        { to: '/payroll', label: 'Зарплата Академа', icon: <Icon.Wallet /> },
      ],
    },
    PROTOTYPE_SECTION,
  ],
  curator: [
    {
      items: [
        { to: '/groups', label: 'Мои группы', icon: <Icon.Calendar /> },
        { to: '/students', label: 'Мои студенты', icon: <Icon.Users /> },
      ],
    },
    PROTOTYPE_SECTION,
  ],
  teacher: [
    {
      items: [{ to: '/groups', label: 'Мои группы', icon: <Icon.Calendar /> }],
    },
    PROTOTYPE_SECTION,
  ],
  student: [
    {
      items: [{ to: '/me', label: 'Мой профиль', icon: <Icon.Users /> }],
    },
    PROTOTYPE_SECTION,
  ],
}

export function menuFor(role: RoleId): NavSection[] {
  return MENUS[role]
}

/** Landing route for a role after switching. */
export function homeFor(role: RoleId): string {
  return menuFor(role)[0].items[0].to
}
