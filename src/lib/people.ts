/**
 * Staff names are stored as "Имя Фамилия".
 *
 * `shortName` produces the compact form used in the schedule column of the
 * groups list — "Аскар Жігер" -> "Аскар Ж." (part 1, §13).
 */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) return fullName
  return `${parts[0]} ${parts[1][0]}.`
}
