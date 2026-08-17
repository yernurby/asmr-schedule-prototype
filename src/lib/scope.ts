import type { Group, RoleId } from '../data/types'

/**
 * Which groups a role is allowed to see.
 * Academ head sees everything; teacher and curator see only their own groups;
 * a student sees the groups they are enrolled in.
 */
export function scopeGroups(
  groups: Group[],
  role: RoleId,
  actorId: string | null,
  studentGroupIds: string[],
): Group[] {
  if (role === 'academ_head') return groups
  if (role === 'teacher') {
    return actorId ? groups.filter((g) => g.teacherIds.includes(actorId)) : []
  }
  if (role === 'curator') {
    return actorId ? groups.filter((g) => g.curatorIds.includes(actorId)) : []
  }
  const ids = new Set(studentGroupIds)
  return groups.filter((g) => ids.has(g.id))
}
