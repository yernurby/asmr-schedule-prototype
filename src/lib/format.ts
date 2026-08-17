/** 699000 -> "699 000 ₸" (the real system writes "699 000 KZT"; we keep the symbol). */
export function formatMoney(value: number): string {
  return `${value.toLocaleString('ru-RU').replace(/ /g, ' ')} ₸`
}

/** Russian plural: plural(5, 'группа', 'группы', 'групп') -> "групп". */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function countLabel(n: number, one: string, few: string, many: string): string {
  return `${n} ${plural(n, one, few, many)}`
}
