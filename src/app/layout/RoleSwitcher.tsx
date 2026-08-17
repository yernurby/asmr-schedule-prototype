import { useNavigate } from 'react-router-dom'
import { COMPACT_CONTROL } from '../../ui/Field'
import { ROLES, useSessionStore } from '../../store/useSessionStore'
import { useDataStore } from '../../store/useDataStore'
import { homeFor } from '../navigation'
import type { RoleId } from '../../data/types'

/**
 * Role switcher. For teacher / curator / student the second select picks the
 * concrete person, because menus and visible data depend on who you are.
 */
export function RoleSwitcher() {
  const navigate = useNavigate()
  const role = useSessionStore((s) => s.role)
  const actorId = useSessionStore((s) => s.actorId)
  const setRole = useSessionStore((s) => s.setRole)
  const setActor = useSessionStore((s) => s.setActor)

  const staff = useDataStore((s) => s.staff)
  const students = useDataStore((s) => s.students)

  const actors =
    role === 'teacher'
      ? staff.filter((p) => p.roles.includes('teacher')).map((p) => ({ id: p.id, name: p.fullName }))
      : role === 'curator'
        ? staff.filter((p) => p.roles.includes('curator')).map((p) => ({ id: p.id, name: p.fullName }))
        : role === 'student'
          ? students.slice(0, 40).map((p) => ({ id: p.id, name: p.fullName }))
          : []

  const onRoleChange = (next: RoleId) => {
    const nextActors =
      next === 'teacher'
        ? staff.filter((p) => p.roles.includes('teacher'))
        : next === 'curator'
          ? staff.filter((p) => p.roles.includes('curator'))
          : next === 'student'
            ? students
            : []
    const nextActorId = nextActors.length > 0 ? nextActors[0].id : null
    setRole(next, nextActorId)
    navigate(homeFor(next))
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-slate-500">Роль</span>
      <select
        value={role}
        onChange={(e) => onRoleChange(e.target.value as RoleId)}
        className={COMPACT_CONTROL}
        aria-label="Роль"
      >
        {ROLES.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>

      {actors.length > 0 ? (
        <select
          value={actorId ?? actors[0].id}
          onChange={(e) => setActor(e.target.value)}
          className={`${COMPACT_CONTROL} max-w-[200px]`}
          aria-label="Сотрудник"
        >
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  )
}
