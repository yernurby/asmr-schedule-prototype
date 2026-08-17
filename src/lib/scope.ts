import type { Group, RoleId } from '../data/types'
import { groupTeacherIds } from './subjects'

/**
 * Which groups a role is allowed to see.
 * Academ head sees everything; teacher and curator see only their own groups;
 * a student sees the groups they are enrolled in.
 *
 * Since part 1 a teacher's groups come from the schedule rows they are assigned
 * to, not from a hand-picked list on the group (§12).
 */
export function scopeGroups(
  groups: Group[],
  role: RoleId,
  actorId: string | null,
  studentGroupIds: string[],
): Group[] {
  if (role === 'academ_head') return groups
  if (role === 'teacher') {
    return actorId ? groups.filter((g) => groupTeacherIds(g).includes(actorId)) : []
  }
  if (role === 'curator') {
    return actorId ? groups.filter((g) => g.curatorIds.includes(actorId)) : []
  }
  const ids = new Set(studentGroupIds)
  return groups.filter((g) => ids.has(g.id))
}
