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
const SEED_VERSION = 8

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

// ------------------------------------------------------------------ subjects
//
// Part 1, §17: every existing course gets one subject named after the course.
// §18: for NUET and SAT the academ director then adds the rest by hand — the
// seed represents the state *after* that has been done, so the prototype can
// actually demonstrate a split schedule. IELTS and both Pre-IELTS courses stay
// single-subject on purpose: they prove §11 and §14 (nothing changed for them).

const subjects = [
  { id: 'sub-ielts', courseId: 'c-ielts', title: 'IELTS', isArchived: false },

  { id: 'sub-sat-math', courseId: 'c-sat', title: 'Math', isArchived: false },
  { id: 'sub-sat-verbal', courseId: 'c-sat', title: 'Verbal', isArchived: false },

  { id: 'sub-nuet-math', courseId: 'c-nuet', title: 'Математика', isArchived: false },
  {
    id: 'sub-nuet-crit',
    courseId: 'c-nuet',
    title: 'Критическое мышление',
    isArchived: false,
  },

  { id: 'sub-pre-rtn', courseId: 'c-pre-rtn', title: 'Pre-IELTS (RTN)', isArchived: false },
  { id: 'sub-pre-vip', courseId: 'c-pre-vip', title: 'Pre-IELTS (VIP)', isArchived: false },
]

// --------------------------------------------------------------------- staff
//
// `subjectIds` is filled by hand in the real system (§19); here it is part of
// the fixture so that the "teachers who can take this subject" filter in the
// group form has something to filter.

const TEACHERS = [
  { name: 'Назерке Абдрахманова', rate: 7000, subjects: ['sub-ielts'] },
  { name: 'Венера Шаншарбаева', rate: 6500, subjects: ['sub-ielts', 'sub-pre-rtn'] },
  { name: 'Сымбат Аккулова', rate: 7000, subjects: ['sub-ielts', 'sub-sat-verbal'] },
  { name: 'Айгерим Жаркешова', rate: 8000, subjects: ['sub-sat-math', 'sub-sat-verbal'] },
  { name: 'Данияр Жексенов', rate: 6000, subjects: ['sub-nuet-math', 'sub-sat-math'] },
  { name: 'Нурали Рахимжанов', rate: 6000, subjects: ['sub-nuet-math'] },
  { name: 'Асылжан Дауренкызы', rate: 6000, subjects: ['sub-nuet-crit', 'sub-ielts'] },
]

const CURATORS = [
  'Адия Бекет',
  'Аскар Жігер',
  'Санжар Бахыт',
  'Алдияр Байбазаров',
]

const staff = []

TEACHERS.forEach((t, i) => {
  const [first, last] = t.name.split(' ')
  staff.push({
    id: `t-${i + 1}`,
    fullName: t.name,
    roles: ['teacher'],
    jobTitle: null,
    email: `${translit(last)}.${translit(first).slice(0, 2)}@weglobal.kz`,
    phone: phone(100 + i),
    status: 'active',
    defaultRate: t.rate,
    subjectIds: t.subjects,
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
    subjectIds: [],
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
  subjectIds: [],
})

const personId = (name) => staff.find((s) => s.fullName === name).id

// -------------------------------------------------------------------- groups
//
// Layout relative to ANCHOR (2026-08-17):
//   - finished      : ended before the anchor
//   - running       : started before, ends after
//   - starting soon : starts 2026-08-31, i.e. two weeks after the anchor

const D = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 7 }

/** A schedule row: subject, weekday, times, teacher (name or null), Meet link. */
const row = (subjectId, weekday, startTime, endTime, teacher, meetUrl = null) => ({
  subjectId,
  weekday,
  startTime,
  endTime,
  teacher,
  meetUrl,
})

const MEET = (slug) => `https://meet.google.com/${slug}`

const groupSpecs = [
  // ---- NUET 1.1 .. 1.5, 30 seats each, two subjects with different teachers
  {
    id: 'g-nuet-11', courseId: 'c-nuet', title: 'NUET 1.1',
    startDate: '2026-08-03', weeks: 30, capacity: 30, students: 30,
    curators: ['Адия Бекет'],
    schedule: [
      row('sub-nuet-math', D.MON, '17:00', '18:30', 'Данияр Жексенов', MEET('nue-math-11')),
      row('sub-nuet-math', D.WED, '17:00', '18:30', 'Данияр Жексенов', MEET('nue-math-11')),
      row('sub-nuet-crit', D.FRI, '17:00', '18:30', 'Асылжан Дауренкызы', MEET('nue-crit-11')),
    ],
    enrollmentOpen: false, starred: true,
    notes: 'Основной поток ЕНТ. Догоняющие — в 1.3.',
  },
  {
    id: 'g-nuet-12', courseId: 'c-nuet', title: 'NUET 1.2',
    startDate: '2026-08-03', weeks: 30, capacity: 30, students: 28,
    curators: ['Аскар Жігер'],
    schedule: [
      row('sub-nuet-math', D.TUE, '17:00', '18:30', 'Нурали Рахимжанов'),
      row('sub-nuet-math', D.THU, '17:00', '18:30', 'Нурали Рахимжанов'),
      row('sub-nuet-crit', D.SAT, '11:00', '12:30', 'Асылжан Дауренкызы'),
    ],
    enrollmentOpen: true, starred: false, notes: null,
  },
  {
    id: 'g-nuet-13', courseId: 'c-nuet', title: 'NUET 1.3',
    startDate: '2026-08-10', weeks: 30, capacity: 30, students: 30,
    curators: ['Санжар Бахыт'],
    schedule: [
      row('sub-nuet-math', D.MON, '19:00', '20:30', 'Нурали Рахимжанов'),
      row('sub-nuet-math', D.WED, '19:00', '20:30', 'Нурали Рахимжанов'),
      row('sub-nuet-crit', D.FRI, '19:00', '20:30', 'Асылжан Дауренкызы'),
    ],
    enrollmentOpen: false, starred: false, notes: null,
  },
  {
    id: 'g-nuet-14', courseId: 'c-nuet', title: 'NUET 1.4',
    startDate: '2026-08-31', weeks: 30, capacity: 30, students: 24,
    curators: ['Алдияр Байбазаров'],
    schedule: [
      row('sub-nuet-math', D.TUE, '19:00', '20:30', 'Данияр Жексенов'),
      row('sub-nuet-math', D.THU, '19:00', '20:30', 'Данияр Жексенов'),
      row('sub-nuet-crit', D.SAT, '13:00', '14:30', 'Асылжан Дауренкызы'),
    ],
    enrollmentOpen: true, starred: true, notes: 'Стартует через две недели.',
  },
  {
    // Critical thinking has no teacher yet — shows the "не назначен" state and
    // that the derived teacher list in the header simply omits the empty slot.
    id: 'g-nuet-15', courseId: 'c-nuet', title: 'NUET 1.5',
    startDate: '2026-08-31', weeks: 30, capacity: 30, students: 12,
    curators: ['Адия Бекет'],
    schedule: [
      row('sub-nuet-math', D.MON, '11:00', '12:30', 'Данияр Жексенов'),
      row('sub-nuet-math', D.WED, '11:00', '12:30', 'Данияр Жексенов'),
      row('sub-nuet-crit', D.FRI, '11:00', '12:30', null),
    ],
    enrollmentOpen: true, starred: false, notes: 'Дневная группа, набор идёт.',
  },

  // ---- IELTS: single subject, so nothing on screen changes for these
  {
    id: 'g-ielts-int7', courseId: 'c-ielts', title: 'IELTS INTENSIVE 7',
    startDate: '2026-07-27', weeks: 8, capacity: 15, students: 14,
    curators: ['Аскар Жігер'],
    schedule: [
      row('sub-ielts', D.MON, '19:30', '21:00', 'Назерке Абдрахманова', MEET('iel-int-7')),
      row('sub-ielts', D.WED, '19:30', '21:00', 'Назерке Абдрахманова', MEET('iel-int-7')),
      row('sub-ielts', D.FRI, '19:30', '21:00', 'Назерке Абдрахманова', MEET('iel-int-7')),
      row('sub-ielts', D.SAT, '19:30', '21:00', 'Назерке Абдрахманова', MEET('iel-int-7')),
    ],
    enrollmentOpen: false, starred: true, notes: null,
  },
  {
    id: 'g-ielts-64', courseId: 'c-ielts', title: 'IELTS 64',
    startDate: '2026-08-31', weeks: 13, capacity: 15, students: 13,
    curators: ['Санжар Бахыт'],
    schedule: [
      row('sub-ielts', D.THU, '17:00', '18:30', 'Сымбат Аккулова'),
      row('sub-ielts', D.SAT, '12:00', '13:30', 'Сымбат Аккулова'),
      row('sub-ielts', D.SUN, '14:00', '15:30', 'Сымбат Аккулова'),
    ],
    enrollmentOpen: true, starred: false, notes: null,
  },
  {
    id: 'g-ielts-may', courseId: 'c-ielts', title: 'IELTS MAY',
    startDate: '2026-04-06', weeks: 13, capacity: 15, students: 15,
    curators: ['Алдияр Байбазаров'],
    schedule: [
      row('sub-ielts', D.MON, '19:00', '20:30', 'Венера Шаншарбаева'),
      row('sub-ielts', D.WED, '19:00', '20:30', 'Венера Шаншарбаева'),
    ],
    enrollmentOpen: false, starred: false, status: 'archived',
    notes: 'Группа завершена.',
  },

  // ---- SAT: Math and Verbal run on different days with different teachers
  {
    id: 'g-sat-7', courseId: 'c-sat', title: 'SAT 7',
    startDate: '2026-08-10', weeks: 13, capacity: 15, students: 11,
    curators: ['Адия Бекет'],
    schedule: [
      row('sub-sat-math', D.TUE, '17:00', '18:30', 'Айгерим Жаркешова', MEET('sat-math-7')),
      row('sub-sat-verbal', D.THU, '17:00', '18:30', 'Сымбат Аккулова', MEET('sat-verb-7')),
    ],
    enrollmentOpen: true, starred: false, notes: null,
  },

  // ---- Pre-IELTS: rows that migration has to sort out (part 2, §33).
  // RTN 19 has nobody assigned at all; VIP 12 has two teachers plus an empty
  // row, so the "one teacher fills everything" rule cannot decide for it.
  {
    id: 'g-rtn-19', courseId: 'c-pre-rtn', title: 'RTN 19 (Pre-IELTS)',
    startDate: '2026-08-24', weeks: 13, capacity: 15, students: 9,
    curators: ['Аскар Жігер'],
    schedule: [
      row('sub-pre-rtn', D.MON, '09:00', '10:00', null),
      row('sub-pre-rtn', D.WED, '09:00', '10:00', null),
      row('sub-pre-rtn', D.FRI, '09:00', '10:00', null),
    ],
    enrollmentOpen: true, starred: false,
    notes: 'Преподаватели ещё не назначены.',
  },
  {
    id: 'g-vip-12', courseId: 'c-pre-vip', title: 'VIP 12 (Pre-IELTS)',
    startDate: '2026-08-24', weeks: 13, capacity: 15, students: 7,
    curators: ['Адия Бекет'],
    schedule: [
      row('sub-pre-vip', D.TUE, '15:00', '16:30', 'Венера Шаншарбаева'),
      row('sub-pre-vip', D.THU, '15:00', '16:30', 'Назерке Абдрахманова'),
      row('sub-pre-vip', D.SAT, '15:00', '16:30', null),
    ],
    enrollmentOpen: true, starred: false, notes: null,
  },
]

const groups = groupSpecs.map((g, gi) => ({
  id: g.id,
  courseId: g.courseId,
  title: g.title,
  startDate: g.startDate,
  endDate: endAfterWeeks(g.startDate, g.weeks),
  weeks: g.weeks,
  capacity: g.capacity,
  curatorIds: g.curators.map(personId),
  enrollmentOpen: g.enrollmentOpen,
  status: g.status ?? 'active',
  schedule: g.schedule.map((r, ri) => ({
    id: `sr-${g.id}-${ri + 1}`,
    subjectId: r.subjectId,
    weekday: r.weekday,
    startTime: r.startTime,
    endTime: r.endTime,
    teacherId: r.teacher ? personId(r.teacher) : null,
    meetUrl: r.meetUrl,
  })),
  notes: g.notes,
  telegramUrl: `https://t.me/+asmr${translit(g.title).replace(/[^a-z0-9]/g, '')}${gi}`,
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
// One draft row per teacher for the anchor month. Which groups a teacher is paid
// for is now derived from the schedule rows (part 1, §12) — no hand-picked list.
// Lesson counts stay 0: today they are typed in by hand (screen-22). Part 6
// replaces these zeros with the real lesson count.

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
  .map((s) => ({
    id: `p-${payrollMonth}-${s.id}`,
    staffId: s.id,
    month: payrollMonth,
    status: 'draft',
    lines: groups
      .filter(
        (g) =>
          g.status === 'active' && g.schedule.some((r) => r.teacherId === s.id),
      )
      .map((g) => ({
        groupId: g.id,
        ratePerHour: RATE_BY_COURSE[g.courseId] ?? 6000,
        lessons1h: 0,
        lessons15h: 0,
      })),
    // §20 — rates the director already typed survive every re-sync.
    rates: {},
    knownKeys: [],
  }))

// ------------------------------------------------------------------ lessons
//
// Part 2, §1: the schedule turns into concrete lessons for the whole period of
// the group. §34: only active groups get them, history is not rebuilt.
// Every lesson starts as "Запланировано" — §5 leaves "Проведено" and
// "Не отмечено" to part 4, so nothing here flips a state by date.

function weekdayOf(iso) {
  const js = new Date(iso + 'T00:00:00Z').getUTCDay()
  return js === 0 ? 7 : js
}

function datesOnWeekday(from, to, weekday) {
  const out = []
  let cursor = from
  let guard = 0
  while (weekdayOf(cursor) !== weekday && cursor <= to && guard++ < 7) {
    cursor = addDays(cursor, 1)
  }
  while (cursor <= to) {
    out.push(cursor)
    cursor = addDays(cursor, 7)
  }
  return out
}

const lessons = []
let lessonNo = 0
const lessonId = () => `l-${String(++lessonNo).padStart(4, '0')}`

for (const group of groups) {
  if (group.status !== 'active') continue
  for (const r of group.schedule) {
    if (!r.subjectId) continue
    for (const date of datesOnWeekday(group.startDate, group.endDate, r.weekday)) {
      lessons.push({
        id: lessonId(),
        date,
        startTime: r.startTime,
        endTime: r.endTime,
        subjectId: r.subjectId,
        teacherId: r.teacherId,
        originalTeacherId: r.teacherId,
        groupIds: [group.id],
        type: 'lesson',
        meetUrl: r.meetUrl,
        state: 'planned',
        title: null,
        cancelReason: null,
        sourceRowId: r.id,
        seriesId: null,
      })
    }
  }
}


// §6, §10 — lessons that belong to several groups at once, created outside any
// single group's schedule. These are what the group card shows as "общие" (§14).

const NUET_GROUPS = ['g-nuet-11', 'g-nuet-12', 'g-nuet-13', 'g-nuet-14', 'g-nuet-15']

function addSeries({ seriesId, title, type, subjectId, teacherId, groupIds, weekday, startTime, endTime, from, until, recurrence, meetUrl }) {
  const step = recurrence === 'biweekly' ? 14 : 7
  let cursor = from
  let guard = 0
  while (weekdayOf(cursor) !== weekday && guard++ < 7) cursor = addDays(cursor, 1)
  while (cursor <= until) {
    lessons.push({
      id: lessonId(),
      date: cursor,
      startTime,
      endTime,
      subjectId,
      teacherId,
      originalTeacherId: teacherId,
      groupIds,
      type,
      meetUrl: meetUrl ?? null,
      state: 'planned',
      title,
      cancelReason: null,
      sourceRowId: null,
      seriesId,
    })
    if (recurrence === 'once') break
    cursor = addDays(cursor, step)
  }
}

// One maths lecture for all five NUET groups — 150 people in one room.
addSeries({
  seriesId: 'ser-nuet-lecture',
  title: 'Лекция по математике (все потоки NUET)',
  type: 'lecture',
  subjectId: 'sub-nuet-math',
  teacherId: personId('Данияр Жексенов'),
  groupIds: NUET_GROUPS,
  weekday: 6,
  startTime: '10:00',
  endTime: '11:30',
  from: '2026-08-08',
  until: '2027-02-28',
  recurrence: 'weekly',
  meetUrl: 'https://meet.google.com/nuet-lecture',
})

// §12 — an office hour deliberately mixes courses: IELTS and SAT together.
addSeries({
  seriesId: 'ser-office-hours',
  title: 'Офис-аурс: разбор вопросов',
  type: 'office_hours',
  subjectId: 'sub-ielts',
  teacherId: personId('Назерке Абдрахманова'),
  groupIds: ['g-ielts-int7', 'g-sat-7'],
  weekday: 7,
  startTime: '12:00',
  endTime: '13:00',
  from: '2026-08-09',
  until: '2026-11-08',
  recurrence: 'biweekly',
})


// §3 — two future lessons already run by a stand-in. They are what makes the
// "занятия с заменой" warnings in §19 and §25 demonstrable before part 5 exists.
const SUBSTITUTIONS = [
  // One in the past so the payroll month has a substitution line to show,
  // two in the future so a schedule change has something to warn about.
  { groupId: 'g-nuet-13', date: '2026-08-12', teacher: 'Данияр Жексенов' },
  { groupId: 'g-nuet-11', date: '2026-09-07', teacher: 'Нурали Рахимжанов' },
  { groupId: 'g-nuet-11', date: '2026-09-09', teacher: 'Нурали Рахимжанов' },
]
for (const sub of SUBSTITUTIONS) {
  const target = lessons.find(
    (l) => l.groupIds.includes(sub.groupId) && l.date === sub.date && l.sourceRowId,
  )
  if (target) target.teacherId = personId(sub.teacher)
}

// §24 — July is closed by payroll, so a schedule change may not reach into it.
const frozenMonths = ['2026-07']

// §29 — the journal starts with the migration that created all of the above.
const auditLog = [
  {
    id: 'a-0001',
    at: `${ANCHOR} 08:00`,
    actorName: 'Система',
    action: 'Перенос данных',
    details: `Расписание превращено в занятия: создано ${lessons.length} занятий по ${
      groups.filter((g) => g.status === 'active').length
    } активным группам`,
    effectiveFrom: null,
    groupId: null,
  },
]


// ------------------------------------------------------------- availability
//
// Part 3, §1–§3: a weekly template in 30-minute cells, no dates.
// Templates are deliberately imperfect: four slots end up outside availability
// so that §5–§7 have something to show — Sunday office hours for Назерке, the
// Sunday IELTS 64 slot for Сымбат, the Saturday morning for Асылжан and the
// Tuesday VIP 12 slot for Венера.

const SLOT = 30

function expand(ranges) {
  const cells = []
  for (const [weekday, from, to] of ranges) {
    const [fh, fm] = from.split(':').map(Number)
    const [th, tm] = to.split(':').map(Number)
    for (let m = fh * 60 + fm; m < th * 60 + tm; m += SLOT) {
      const h = String(Math.floor(m / 60)).padStart(2, '0')
      const mm = String(m % 60).padStart(2, '0')
      cells.push(`${weekday}-${h}:${mm}`)
    }
  }
  return cells
}

const AVAILABILITY = {
  'Назерке Абдрахманова': [[1, '15:00', '21:30'], [3, '15:00', '21:30'], [5, '15:00', '21:30'], [6, '15:00', '21:30']],
  'Венера Шаншарбаева': [[1, '18:00', '21:00'], [3, '18:00', '21:00']],
  'Сымбат Аккулова': [[4, '11:00', '19:00'], [6, '11:00', '19:00']],
  'Айгерим Жаркешова': [[2, '16:00', '20:00'], [4, '16:00', '20:00']],
  'Данияр Жексенов': [
    [1, '10:00', '21:00'], [3, '10:00', '21:00'], [5, '10:00', '21:00'],
    [2, '18:00', '21:00'], [4, '18:00', '21:00'], [6, '09:00', '12:00'],
  ],
  'Нурали Рахимжанов': [
    [1, '18:00', '21:00'], [3, '18:00', '21:00'], [5, '18:00', '21:00'],
    [2, '16:00', '19:00'], [4, '16:00', '19:00'],
  ],
  'Асылжан Дауренкызы': [
    [1, '10:00', '21:00'], [3, '10:00', '21:00'], [5, '10:00', '21:00'],
    [6, '13:00', '16:00'],
  ],
}

const availability = Object.entries(AVAILABILITY).map(([name, ranges]) => ({
  teacherId: personId(name),
  cells: expand(ranges),
}))

// §6 — one request already filed, so the director's list is not empty on arrival.
const satMorning = lessons.find(
  (l) =>
    l.teacherId === personId('Асылжан Дауренкызы') &&
    l.startTime === '11:00' &&
    l.date >= ANCHOR,
)

const reshuffleRequests = satMorning
  ? [
      {
        id: 'rr-0001',
        teacherId: personId('Асылжан Дауренкызы'),
        lessonId: satMorning.id,
        at: `${ANCHOR} 08:30`,
        note: 'Субботнее утро не получается — прошу снять или перенести на вечер.',
      },
    ]
  : []


// ----------------------------------------------------------- attendance
//
// Part 4: past lessons are mostly marked, but five of the most recent are left
// untouched on purpose — with the prototype clock at the anchor they show up as
// «Не отмечено» and give §31–§35 something to work on.

const attendance = []
const attendanceSessions = []
const attendanceClaims = []

const pastLessons = lessons
  .filter((l) => l.date < ANCHOR && l.state === 'planned')
  .sort((a, b) => a.date.localeCompare(b.date))

// The five newest stay unmarked; everything older counts as held.
const leaveUnmarked = new Set(pastLessons.slice(-5).map((l) => l.id))
// Every held lesson gets real marks. Marking only the recent ones made the
// group report read as if nobody came to the first week, because a missing mark
// is an absence by design.
const withMarks = new Set(pastLessons.slice(0, -5).map((l) => l.id))

const enrolledBy = new Map()
for (const e of enrollments) {
  if (e.status !== 'active') continue
  enrolledBy.set(e.groupId, [...(enrolledBy.get(e.groupId) ?? []), e.studentId])
}

let markNo = 0
for (const lesson of pastLessons) {
  if (leaveUnmarked.has(lesson.id)) continue
  lesson.state = 'held'

  attendanceSessions.push({
    lessonId: lesson.id,
    openedAt: `${lesson.date} ${lesson.startTime}`,
    openedBy: lesson.teacherId ?? 'unknown',
    code: '000000',
    previousCode: null,
    tick: 0,
  })

  if (!withMarks.has(lesson.id)) continue

  const audience = [
    ...new Set(lesson.groupIds.flatMap((id) => enrolledBy.get(id) ?? [])),
  ]
  audience.forEach((studentId, i) => {
    markNo++
    const roll = rng(markNo * 104729)
    // Roughly four out of five scan in time, one in ten is late, the rest are
    // simply absent — no record at all, which is the §12 default.
    if (roll < 0.78) {
      attendance.push({
        lessonId: lesson.id,
        studentId,
        status: 'present',
        source: 'qr',
        at: `${lesson.date} ${lesson.startTime}`,
      })
    } else if (roll < 0.88) {
      attendance.push({
        lessonId: lesson.id,
        studentId,
        status: 'late',
        source: 'qr',
        at: `${lesson.date} ${lesson.endTime}`,
      })
    } else if (roll < 0.93) {
      // §18 — a manual mark by the teacher, so the share of manual marks is visible.
      attendance.push({
        lessonId: lesson.id,
        studentId,
        status: 'present',
        source: i % 2 === 0 ? 'teacher' : 'curator',
        at: `${lesson.date} ${lesson.endTime}`,
      })
    }
  })
}

// §28 — one claim already waiting, so the tab is not empty on arrival.
const claimLesson = pastLessons.slice(-6)[0]
if (claimLesson) {
  const audience = [
    ...new Set(claimLesson.groupIds.flatMap((id) => enrolledBy.get(id) ?? [])),
  ]
  const claimant = audience.find(
    (id) => !attendance.some((m) => m.lessonId === claimLesson.id && m.studentId === id),
  )
  if (claimant) {
    attendanceClaims.push({
      id: 'ac-0001',
      lessonId: claimLesson.id,
      studentId: claimant,
      comment: 'Был на уроке, QR не успел отсканировать — интернет отвалился.',
      at: `${claimLesson.date} ${claimLesson.endTime}`,
      status: 'pending',
    })
  }
}


// -------------------------------------------------------- schedule events
//
// Part 5: the registry starts with a realistic mix — marked and unmarked,
// explained and silent, one already past its 48-hour deadline, one pending
// request and one shift that must never reach a counter.

const limits = { substitutionsPerMonth: 2, transfersPerMonth: 2 }

function due(at) {
  const d = new Date(at.replace(' ', 'T') + ':00')
  d.setHours(d.getHours() + 48)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function evt(o) {
  const createdAt = o.createdAt
  return {
    id: o.id,
    type: o.type,
    lessonId: o.lessonId,
    initiatorId: o.initiatorId,
    createdAt,
    substituteId: o.substituteId ?? null,
    requestStatus: o.requestStatus ?? null,
    respondedAt: o.respondedAt ?? null,
    overLimit: o.overLimit ?? false,
    fromDate: o.fromDate ?? null,
    fromStartTime: o.fromStartTime ?? null,
    fromEndTime: o.fromEndTime ?? null,
    toDate: o.toDate ?? null,
    toStartTime: o.toStartTime ?? null,
    toEndTime: o.toEndTime ?? null,
    needsApproval: o.needsApproval ?? false,
    approvalStatus: o.approvalStatus ?? undefined,
    reason: o.reason ?? null,
    reasonCategory: o.reasonCategory ?? null,
    reasonFileName: o.reasonFileName ?? null,
    reasonDueAt: due(createdAt),
    verdict: o.verdict ?? null,
    verdictComment: o.verdictComment ?? null,
    verdictBy: o.verdict ? 'Академ Хэд' : null,
    verdictAt: o.verdict ? o.createdAt : null,
  }
}

const scheduleEvents = []

// The two substitutions that already changed a teacher back in part 2.
const swapped = lessons.filter((l) => l.teacherId && l.originalTeacherId && l.teacherId !== l.originalTeacherId)
swapped.forEach((l, i) => {
  scheduleEvents.push(
    evt({
      id: `se-00${i + 1}`,
      type: 'substitution',
      lessonId: l.id,
      initiatorId: l.originalTeacherId,
      substituteId: l.teacherId,
      requestStatus: 'accepted',
      createdAt: '2026-08-14 09:10',
      respondedAt: '2026-08-14 09:40',
      reason: i === 0 ? 'Болею, есть справка.' : null,
      reasonCategory: i === 0 ? 'Болезнь' : null,
      reasonFileName: i === 0 ? 'spravka-14-08.pdf' : null,
      verdict: i === 0 ? 'valid' : null,
      verdictComment: i === 0 ? 'Справка приложена, вопросов нет.' : null,
    }),
  )
})

const lessonOf = (teacherId, from) =>
  lessons.find((l) => l.teacherId === teacherId && l.date >= from && l.sourceRowId)

// Explained but not yet ruled on — hangs as a debt (§25).
const l1 = lessonOf(personId('Сымбат Аккулова'), '2026-08-20')
if (l1) {
  scheduleEvents.push(
    evt({
      id: 'se-010',
      type: 'transfer',
      lessonId: l1.id,
      initiatorId: l1.teacherId,
      createdAt: '2026-08-16 11:00',
      fromDate: l1.date,
      fromStartTime: l1.startTime,
      fromEndTime: l1.endTime,
      toDate: l1.date,
      toStartTime: '18:00',
      toEndTime: '19:30',
      reason: 'Накладка с другим потоком.',
      reasonCategory: 'Накладка по расписанию',
    }),
  )
}

// Silent past the deadline — turns invalid on its own (§12).
const l2 = lessonOf(personId('Венера Шаншарбаева'), '2026-08-25')
if (l2) {
  scheduleEvents.push(
    evt({
      id: 'se-011',
      type: 'substitution',
      lessonId: l2.id,
      initiatorId: l2.teacherId,
      substituteId: personId('Назерке Абдрахманова'),
      requestStatus: 'accepted',
      createdAt: '2026-08-13 20:00',
      respondedAt: '2026-08-13 20:20',
    }),
  )
}

// A request nobody has answered yet (§4, §8).
const l3 = lessonOf(personId('Айгерим Жаркешова'), '2026-08-18')
if (l3) {
  scheduleEvents.push(
    evt({
      id: 'se-012',
      type: 'substitution',
      lessonId: l3.id,
      initiatorId: l3.teacherId,
      substituteId: personId('Данияр Жексенов'),
      requestStatus: 'pending',
      createdAt: '2026-08-17 08:15',
      reason: 'Уезжаю на конференцию.',
      reasonCategory: 'Другое',
    }),
  )
}

// §19–§21 — a shift inside the same day: visible, but never counted.
const l4 = lessonOf(personId('Нурали Рахимжанов'), '2026-08-19')
if (l4) {
  scheduleEvents.push(
    evt({
      id: 'se-013',
      type: 'shift',
      lessonId: l4.id,
      initiatorId: l4.teacherId,
      createdAt: '2026-08-16 18:00',
      fromDate: l4.date,
      fromStartTime: l4.startTime,
      fromEndTime: l4.endTime,
      toDate: l4.date,
      toStartTime: '19:30',
      toEndTime: '21:00',
      reason: 'Начали на полчаса позже.',
      reasonCategory: 'Другое',
    }),
  )
}

// ------------------------------------------------------------ sanity checks

for (const g of groups) {
  for (const r of g.schedule) {
    const sub = subjects.find((s) => s.id === r.subjectId)
    if (!sub) throw new Error(`${g.title}: unknown subject ${r.subjectId}`)
    if (sub.courseId !== g.courseId) {
      throw new Error(`${g.title}: subject ${sub.title} belongs to another course`)
    }
    if (r.teacherId && !staff.some((p) => p.id === r.teacherId)) {
      throw new Error(`${g.title}: unknown teacher ${r.teacherId}`)
    }
  }
}

for (const c of courses) {
  const live = subjects.filter((s) => s.courseId === c.id && !s.isArchived)
  if (live.length === 0) throw new Error(`${c.title}: course has no live subject`)
  if (live.length > 10) throw new Error(`${c.title}: more than 10 subjects`)
}

// --------------------------------------------------------------------- write

const seed = {
  seedVersion: SEED_VERSION,
  anchorDate: ANCHOR,
  courses,
  subjects,
  staff,
  students,
  groups,
  enrollments,
  payroll,
  lessons,
  attendance,
  attendanceSessions,
  attendanceClaims,
  availability,
  reshuffleRequests,
  scheduleEvents,
  limits,
  auditLog,
  frozenMonths,
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, JSON.stringify(seed, null, 2) + '\n', 'utf8')

console.log(
  `seed.json written: ${courses.length} courses, ${subjects.length} subjects, ` +
    `${staff.length} staff, ${groups.length} groups, ${students.length} students, ` +
    `${payroll.length} payroll rows, ${lessons.length} lessons, ${attendance.length} marks`,
)
