// Generates src/data/seed.json.
//
// Fully deterministic — no Math.random, no Date.now. Re-running it must produce
// a byte-identical file, otherwise every run shows up as a diff.
//
// Run with:  npm run seed

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outFile = resolve(here, '../src/data/seed.json')

/** Bump when the shape or content of the seed changes — forces a re-seed in browsers. */
const SEED_VERSION = 1

/** The prototype's default "now". Seed dates are laid out around this date. */
const ANCHOR = '2026-08-17'

// ---------------------------------------------------------------- name pools

const MALE_FIRST = [
  'Арман', 'Дамир', 'Нурали', 'Ерасыл', 'Алихан', 'Санжар', 'Бекзат', 'Дастан',
  'Аслан', 'Темирлан', 'Ильяс', 'Мирас', 'Азамат', 'Диас', 'Рустем', 'Ерлан',
  'Максат', 'Данияр', 'Айдос', 'Жандос', 'Артём', 'Никита', 'Даниил', 'Матвей',
  'Кирилл', 'Роман', 'Егор', 'Тимур', 'Алишер', 'Бекарыс',
]

const FEMALE_FIRST = [
  'Аружан', 'Камила', 'Адия', 'Айгерим', 'Дана', 'Сымбат', 'Айдана', 'Инжу',
  'Ділназ', 'Аяна', 'Мөлдір', 'Назерке', 'Томирис', 'Алина', 'Асель', 'Жансая',
  'Амина', 'Диана', 'Анастасия', 'Виктория', 'Елизавета', 'Полина', 'София',
  'Дарья', 'Ксения', 'Милана', 'Аружан', 'Гульмира', 'Перизат', 'Салтанат',
]

// Surnames that take a feminine ending (-ов/-ев/-ин) are marked by the
// feminise() helper below; Kazakh surnames without a Russian suffix stay as is.
const SURNAMES = [
  'Жанабай', 'Ермекбаев', 'Сапарәлі', 'Рымбеков', 'Бакиров',
  'Айтпаев', 'Смаил', 'Хумарбек', 'Хаким', 'Куандык', 'Максудов', 'Мукан',
  'Турсынхан', 'Далайхан', 'Жаппасбаев', 'Абдрахманов', 'Шаншарбаев',
  'Аккулов', 'Жаркешов', 'Жексенов', 'Рахимжанов', 'Бекет',
  'Жігер', 'Бахыт', 'Байбазаров', 'Сеитқадыров', 'Токтасынов', 'Дельденков',
  'Потапов', 'Назаров', 'Емельянов', 'Камалов', 'Темиргазиев',
  'Гиззат', 'Бадей', 'Панаберген', 'Галихан', 'Баянов',
  'Егістай', 'Амантай', 'Калиев', 'Ахметаев', 'Сагинбаев',
  'Майрамжан', 'Іргебай', 'Кенжегали', 'Құрбанов', 'Медеубаев',
]

/** Bases for Russian-style patronymics used for parents. */
const PATRONYMIC_BASES = [
  'Арман', 'Тимур', 'Азамат', 'Ерлан', 'Максат', 'Руслан', 'Марат', 'Талгат',
  'Серик', 'Кайрат', 'Александр', 'Владимир', 'Сергей', 'Николай', 'Бауыржан',
  'Нуржан', 'Ержан', 'Алексей', 'Дмитрий', 'Мурат',
]

const CITIES = [
  'Астана', 'Алматы', 'Караганда', 'Шымкент', 'Актобе', 'Кокшетау',
  'Уральск', 'Павлодар', 'Темиртау', 'Костанай', 'Атырау', 'Семей',
]

// ------------------------------------------------------------------ helpers

/** Deterministic pseudo-random in [0,1) from an integer seed (mulberry32). */
function rng(seed) {
  let t = seed + 0x6d2b79f5
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const pick = (arr, seed) => arr[Math.floor(rng(seed) * arr.length)]

function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** ASMR groups run `weeks` weeks; end date is the last day of the last week. */
const endAfterWeeks = (start, weeks) => addDays(start, weeks * 7 - 1)

function phone(seed) {
  const codes = ['700', '701', '702', '705', '707', '708', '747', '771', '775', '777', '778']
  const code = codes[Math.floor(rng(seed) * codes.length)]
  const a = String(Math.floor(rng(seed + 11) * 900) + 100)
  const b = String(Math.floor(rng(seed + 22) * 9000) + 1000)
  return `+7 ${code} ${a} ${b}`
}

/** Only Russian-suffixed surnames take a feminine form. */
function feminise(surname) {
  return /(ов|ев|ёв|ин|ын)$/.test(surname) ? `${surname}а` : surname
}

/** "Сергей" -> "Сергеевна/Сергеевич", "Тимур" -> "Тимуровна/Тимурович". */
function patronymic(base, female) {
  const stem = base.endsWith('й') ? `${base.slice(0, -1)}е` : `${base}о`
  return female ? `${stem}вна` : `${stem}вич`
}

function translit(s) {
  const map = {
    а: 'a', б: 'b', в: 'v', г: 'g', ғ: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
    з: 'z', и: 'i', і: 'i', й: 'y', к: 'k', қ: 'k', л: 'l', м: 'm', н: 'n',
    ң: 'n', о: 'o', ө: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ұ: 'u',
    ү: 'u', ф: 'f', х: 'h', һ: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  }
  return s
    .toLowerCase()
    .split('')
    .map((ch) => (ch in map ? map[ch] : /[a-z0-9]/.test(ch) ? ch : ''))
    .join('')
}

// ------------------------------------------------------------------- courses

const courses = [
  { id: 'c-ielts', title: 'IELTS', isActive: true },
  { id: 'c-sat', title: 'SAT', isActive: true },
  { id: 'c-nuet', title: 'NUET', isActive: true },
  { id: 'c-pre-rtn', title: 'Pre-IELTS (RTN)', isActive: true },
  { id: 'c-pre-vip', title: 'Pre-IELTS (VIP)', isActive: true },
]

// --------------------------------------------------------------------- staff

const TEACHERS = [
  'Назерке Абдрахманова',
  'Венера Шаншарбаева',
  'Сымбат Аккулова',
  'Айгерим Жаркешова',
  'Данияр Жексенов',
  'Нурали Рахимжанов',
  'Асылжан Дауренкызы',
]

const CURATORS = [
  'Адия Бекет',
  'Аскар Жігер',
  'Санжар Бахыт',
  'Алдияр Байбазаров',
]

const staff = []

TEACHERS.forEach((fullName, i) => {
  const [first, last] = fullName.split(' ')
  staff.push({
    id: `t-${i + 1}`,
    fullName,
    roles: ['teacher'],
    jobTitle: null,
    email: `${translit(last)}.${translit(first).slice(0, 2)}@weglobal.kz`,
    phone: phone(100 + i),
    status: 'active',
  })
})

CURATORS.forEach((fullName, i) => {
  const [first, last] = fullName.split(' ')
  staff.push({
    id: `k-${i + 1}`,
    fullName,
    roles: ['curator'],
    jobTitle: null,
    email: `${translit(last)}.${translit(first).slice(0, 2)}@weglobal.kz`,
    phone: phone(200 + i),
    status: 'active',
  })
})

staff.push({
  id: 'a-1',
  fullName: 'Санжар Усумханов',
  roles: ['academ_head'],
  jobTitle: 'Академический директор',
  email: 'usumhanov.sa@weglobal.kz',
  phone: phone(300),
  status: 'active',
})

const teacherId = (name) => staff.find((s) => s.fullName === name).id
const curatorId = (name) => staff.find((s) => s.fullName === name).id

// -------------------------------------------------------------------- groups
//
// Layout relative to ANCHOR (2026-08-17):
//   - finished      : ended before the anchor
//   - running       : started before, ends after
//   - starting soon : starts 2026-08-31, i.e. two weeks after the anchor

const D = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 7 }
const slot = (weekday, startTime, endTime) => ({ weekday, startTime, endTime })

const groupSpecs = [
  // ---- NUET 1.1 .. 1.5, 30 seats each
  {
    id: 'g-nuet-11', courseId: 'c-nuet', title: 'NUET 1.1',
    startDate: '2026-08-03', weeks: 30, capacity: 30, students: 30,
    teachers: ['Данияр Жексенов'], curators: ['Адия Бекет'],
    schedule: [slot(D.MON, '17:00', '18:30'), slot(D.WED, '17:00', '18:30'), slot(D.FRI, '17:00', '18:30')],
    enrollmentOpen: false, starred: true,
    notes: 'Основной поток ЕНТ. Догоняющие — в 1.3.',
  },
  {
    id: 'g-nuet-12', courseId: 'c-nuet', title: 'NUET 1.2',
    startDate: '2026-08-03', weeks: 30, capacity: 30, students: 28,
    teachers: ['Асылжан Дауренкызы'], curators: ['Аскар Жігер'],
    schedule: [slot(D.TUE, '17:00', '18:30'), slot(D.THU, '17:00', '18:30'), slot(D.SAT, '11:00', '12:30')],
    enrollmentOpen: true, starred: false, notes: null,
  },
  {
    id: 'g-nuet-13', courseId: 'c-nuet', title: 'NUET 1.3',
    startDate: '2026-08-10', weeks: 30, capacity: 30, students: 30,
    teachers: ['Нурали Рахимжанов'], curators: ['Санжар Бахыт'],
    schedule: [slot(D.MON, '19:00', '20:30'), slot(D.WED, '19:00', '20:30'), slot(D.FRI, '19:00', '20:30')],
    enrollmentOpen: false, starred: false, notes: null,
  },
  {
    id: 'g-nuet-14', courseId: 'c-nuet', title: 'NUET 1.4',
    startDate: '2026-08-31', weeks: 30, capacity: 30, students: 24,
    teachers: ['Данияр Жексенов'], curators: ['Алдияр Байбазаров'],
    schedule: [slot(D.TUE, '19:00', '20:30'), slot(D.THU, '19:00', '20:30'), slot(D.SAT, '13:00', '14:30')],
    enrollmentOpen: true, starred: true, notes: 'Стартует через две недели.',
  },
  {
    id: 'g-nuet-15', courseId: 'c-nuet', title: 'NUET 1.5',
    startDate: '2026-08-31', weeks: 30, capacity: 30, students: 12,
    teachers: ['Асылжан Дауренкызы'], curators: ['Адия Бекет'],
    schedule: [slot(D.MON, '11:00', '12:30'), slot(D.WED, '11:00', '12:30'), slot(D.FRI, '11:00', '12:30')],
    enrollmentOpen: true, starred: false, notes: 'Дневная группа, набор идёт.',
  },

  // ---- IELTS
  {
    id: 'g-ielts-int7', courseId: 'c-ielts', title: 'IELTS INTENSIVE 7',
    startDate: '2026-07-27', weeks: 8, capacity: 15, students: 14,
    teachers: ['Назерке Абдрахманова'], curators: ['Аскар Жігер'],
    schedule: [
      slot(D.MON, '19:30', '21:00'), slot(D.WED, '19:30', '21:00'),
      slot(D.FRI, '19:30', '21:00'), slot(D.SAT, '19:30', '21:00'),
    ],
    enrollmentOpen: false, starred: true, notes: null,
  },
  {
    id: 'g-ielts-64', courseId: 'c-ielts', title: 'IELTS 64',
    startDate: '2026-08-31', weeks: 13, capacity: 15, students: 13,
    teachers: ['Сымбат Аккулова'], curators: ['Санжар Бахыт'],
    schedule: [slot(D.THU, '17:00', '18:30'), slot(D.SAT, '12:00', '13:30'), slot(D.SUN, '14:00', '15:30')],
    enrollmentOpen: true, starred: false, notes: null,
  },
  {
    id: 'g-ielts-may', courseId: 'c-ielts', title: 'IELTS MAY',
    startDate: '2026-04-06', weeks: 13, capacity: 15, students: 15,
    teachers: ['Венера Шаншарбаева'], curators: ['Алдияр Байбазаров'],
    schedule: [slot(D.MON, '19:00', '20:30'), slot(D.WED, '19:00', '20:30')],
    enrollmentOpen: false, starred: false, status: 'archived',
    notes: 'Группа завершена.',
  },

  // ---- SAT
  {
    id: 'g-sat-7', courseId: 'c-sat', title: 'SAT 7',
    startDate: '2026-08-10', weeks: 13, capacity: 15, students: 11,
    teachers: ['Айгерим Жаркешова'], curators: ['Адия Бекет'],
    schedule: [slot(D.TUE, '17:00', '18:30'), slot(D.THU, '17:00', '18:30')],
    enrollmentOpen: true, starred: false, notes: null,
  },
]

const groups = groupSpecs.map((g, i) => ({
  id: g.id,
  courseId: g.courseId,
  title: g.title,
  startDate: g.startDate,
  endDate: endAfterWeeks(g.startDate, g.weeks),
  weeks: g.weeks,
  capacity: g.capacity,
  teacherIds: g.teachers.map(teacherId),
  curatorIds: g.curators.map(curatorId),
  enrollmentOpen: g.enrollmentOpen,
  status: g.status ?? 'active',
  schedule: g.schedule,
  notes: g.notes,
  telegramUrl: `https://t.me/+asmr${translit(g.title).replace(/[^a-z0-9]/g, '')}${i}`,
  starred: g.starred,
}))

// ------------------------------------------------------ students + enrolments

const students = []
const enrollments = []
let studentNo = 0

for (const spec of groupSpecs) {
  for (let i = 0; i < spec.students; i++) {
    studentNo++
    const s = studentNo * 7919 // spread the seed
    const isFemale = rng(s) < 0.52
    const first = pick(isFemale ? FEMALE_FIRST : MALE_FIRST, s + 1)
    const baseSurname = pick(SURNAMES, s + 2)
    const surname = isFemale ? feminise(baseSurname) : baseSurname
    const fullName = `${surname} ${first}`
    const id = `s-${String(studentNo).padStart(3, '0')}`

    // The primary contact is the mother in ~70% of cases, otherwise the father.
    const parentIsMother = rng(s + 5) < 0.7
    const parentFirst = pick(parentIsMother ? FEMALE_FIRST : MALE_FIRST, s + 6)
    const parentName = [
      parentIsMother ? feminise(baseSurname) : baseSurname,
      parentFirst,
      patronymic(pick(PATRONYMIC_BASES, s + 7), parentIsMother),
    ].join(' ')

    students.push({
      id,
      fullName,
      email: `${translit(first)}.${translit(surname)}${studentNo}@gmail.com`,
      phone: phone(s + 3),
      city: pick(CITIES, s + 4),
      parentName,
      parentPhone: phone(s + 8),
    })

    enrollments.push({
      id: `e-${String(studentNo).padStart(3, '0')}`,
      studentId: id,
      groupId: spec.id,
      status: 'active',
    })
  }
}

// ------------------------------------------------------------------- payroll
//
// One draft row per teacher for the anchor month. Lesson counts are 0 — today
// they are typed in by hand (see docs/existing-screens.md, screen-22).
// Part 6 replaces these zeros with the real lesson count.

const RATE_BY_COURSE = {
  'c-ielts': 7000,
  'c-sat': 8000,
  'c-nuet': 6000,
  'c-pre-rtn': 5000,
  'c-pre-vip': 5500,
}

const payrollMonth = ANCHOR.slice(0, 7)
const payroll = staff
  .filter((s) => s.roles.includes('teacher'))
  .map((s, i) => ({
    id: `p-${payrollMonth}-${s.id}`,
    staffId: s.id,
    month: payrollMonth,
    status: 'draft',
    lines: groups
      .filter((g) => g.teacherIds.includes(s.id) && g.status === 'active')
      .map((g) => ({
        groupId: g.id,
        ratePerHour: RATE_BY_COURSE[g.courseId] ?? 6000,
        lessons1h: 0,
        lessons15h: 0,
      })),
    _order: i,
  }))
  .map(({ _order, ...row }) => row)

// --------------------------------------------------------------------- write

const seed = {
  seedVersion: SEED_VERSION,
  anchorDate: ANCHOR,
  courses,
  staff,
  students,
  groups,
  enrollments,
  payroll,
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, JSON.stringify(seed, null, 2) + '\n', 'utf8')

console.log(
  `seed.json written: ${courses.length} courses, ${staff.length} staff, ` +
    `${groups.length} groups, ${students.length} students, ${payroll.length} payroll rows`,
)
