import { addDays, eachDay, weekday, type ISODate } from './dates'
import type { NieGroupItem, Settings, WorkoutItem } from '../types'

// Planificador: función pura que convierte los Ajustes (fechas) + el orden de content/plan
// en un calendario día a día. Si cambias una fecha, se recalcula todo.

export type Phase = 'before' | 'pre' | 'xmas' | 'academy' | 'nieBlock' | 'final' | 'exam' | 'after'

export type EventType =
  | 'weeklyReview'
  | 'preReview'
  | 'xmasLight'
  | 'academyDiary'
  | 'academyStudy'
  | 'academyWeekSummary'
  | 'cumulativeTest'
  | 'mock'
  | 'exam'
  | 'nieRevision'
  | 'finalGroup'
  | 'finalErrors'

export interface PlanEvent {
  type: EventType
  label: string
  /** grupo NIE (1–12) para 'finalGroup' */
  group?: number
}

export interface NieSlot {
  chapter: string
  /** true el primer día del capítulo */
  first: boolean
  /** true el último día del capítulo */
  last: boolean
}

export interface PlanDay {
  date: ISODate
  phase: Phase
  targetMin: number
  lessons: string[]
  nie: NieSlot[]
  events: PlanEvent[]
  workouts: WorkoutItem[]
}

export interface PlanInputs {
  preOrder: string[]
  nieGroups: NieGroupItem[][]
  fitnessWeek: { day: number; items: WorkoutItem[] }[]
}

export interface Plan {
  days: Map<ISODate, PlanDay>
  /** lessonId → fecha planificada (pre-academia) o fecha de inicio (capítulos NIE) */
  lessonDates: Map<string, ISODate>
  /** capítulo → [inicio, fin] de la 1ª vuelta */
  nieRanges: Map<string, [ISODate, ISODate]>
  from: ISODate
  to: ISODate
}

export const PHASE_LABELS: Record<Phase, string> = {
  before: 'Antes de empezar',
  pre: 'Pre-academia',
  xmas: 'Navidad (ligero)',
  academy: 'Academia + NIE 1ª vuelta',
  nieBlock: 'Bloque NIE',
  final: 'Repaso final NIE',
  exam: 'Examen NIE',
  after: 'Después del examen',
}

export function phaseOf(date: ISODate, s: Settings): Phase {
  if (date < s.studyStart) return 'before'
  if (date <= s.preEnd) return 'pre'
  if (date < s.academyStart) return 'xmas'
  if (date <= s.academyEnd) return 'academy'
  if (date === s.examDate) return 'exam'
  if (date > s.examDate) return 'after'
  if (date >= s.finalReviewStart) return 'final'
  return 'nieBlock'
}

/** Minutos objetivo por fase y día de la semana (0 = lunes). */
export function targetMinutes(phase: Phase, wd: number): number {
  switch (phase) {
    case 'pre':
      return wd === 6 ? 90 : 120
    case 'xmas':
      return 30
    case 'academy':
      return wd === 5 ? 210 : 120
    case 'nieBlock':
    case 'final':
      return wd === 5 ? 240 : wd === 6 ? 120 : 150
    default:
      return 0
  }
}

/** Capacidad de lecciones de pre-academia por día: L–V 2, sábado 1, domingo 0. */
export function preCapacity(wd: number): number {
  return wd === 6 ? 0 : wd === 5 ? 1 : 2
}

/** Unidades de estudio NIE por día durante la academia: L–V 1, sábado 2, domingo 0 (repasos). */
export function nieUnits(wd: number): number {
  return wd === 6 ? 0 : wd === 5 ? 2 : 1
}

export function buildPlan(s: Settings, inputs: PlanInputs): Plan {
  const from = s.studyStart < s.academyStart ? s.studyStart : s.academyStart
  const to = s.examDate > s.finalReviewEnd ? s.examDate : s.finalReviewEnd
  const days = new Map<ISODate, PlanDay>()
  const lessonDates = new Map<string, ISODate>()
  const nieRanges = new Map<string, [ISODate, ISODate]>()

  for (const date of eachDay(from, to)) {
    const wd = weekday(date)
    const phase = phaseOf(date, s)
    days.set(date, {
      date,
      phase,
      targetMin: targetMinutes(phase, wd),
      lessons: [],
      nie: [],
      events: [],
      workouts: inputs.fitnessWeek.find((w) => w.day === wd)?.items ?? [],
    })
  }

  // --- Pre-academia: lecciones en orden ---
  const queue = [...inputs.preOrder]
  for (const date of eachDay(s.studyStart, s.preEnd)) {
    const day = days.get(date)!
    const wd = weekday(date)
    if (wd === 6) day.events.push({ type: 'weeklyReview', label: 'Repaso semanal (1,5 h): flashcards + mini-tests de la semana' })
    for (let i = 0; i < preCapacity(wd) && queue.length; i++) {
      const id = queue.shift()!
      day.lessons.push(id)
      lessonDates.set(id, date)
    }
    if (!day.lessons.length && wd !== 6)
      day.events.push({ type: 'preReview', label: 'Repaso general de pre-academia y test de cada carpeta' })
  }
  // si sobran lecciones (fechas acortadas), van al último día
  if (queue.length && days.has(s.preEnd)) {
    for (const id of queue) {
      days.get(s.preEnd)!.lessons.push(id)
      lessonDates.set(id, s.preEnd)
    }
  }

  for (const date of eachDay(s.xmasStart, addDays(s.academyStart, -1)))
    days.get(date)?.events.push({ type: 'xmasLight', label: 'Navidad: solo flashcards y repasos pendientes (ligero)' })

  // --- Academia: diario + NIE 1ª vuelta ponderada por tamaño ---
  const academyDays = eachDay(s.academyStart, s.academyEnd)
  for (const date of academyDays) {
    const day = days.get(date)!
    const wd = weekday(date)
    if (wd < 5) {
      // L–V: estudiar lo visto en la academia ese día, además del diario
      day.events.push({ type: 'academyStudy', label: 'Estudio de la academia: repasar y completar lo de hoy (40 min)' })
      day.events.push({ type: 'academyDiary', label: 'Diario de academia: 5 ideas clave, dudas y flashcards (20 min)' })
    }
    if (wd === 6) {
      day.events.push({ type: 'weeklyReview', label: 'Repasos de la semana (2 h)' })
      day.events.push({ type: 'academyWeekSummary', label: 'Resumen semanal de la academia' })
    }
  }
  allocateNie(s, inputs.nieGroups, days, lessonDates, nieRanges)

  // --- Bloque NIE y repaso final ---
  const special = new Set([...s.mocks, ...s.cumulativeTests, s.examDate])
  for (const date of eachDay(s.nieBlockStart, addDays(s.finalReviewStart, -1)))
    if (!special.has(date))
      days.get(date)?.events.push({ type: 'nieRevision', label: 'NIE: repasos espaciados + preguntas por partes + registro de errores' })

  const groupCount = inputs.nieGroups.length
  let g = 0
  for (const date of eachDay(s.finalReviewStart, s.finalReviewEnd)) {
    if (special.has(date)) continue
    const day = days.get(date)
    if (!day) continue
    if (g < groupCount) {
      const chapters = inputs.nieGroups[g].map((c) => c.chapter).join(', ')
      day.events.push({ type: 'finalGroup', label: `Repaso final · grupo ${g + 1} (${chapters})`, group: g + 1 })
      g++
    } else {
      day.events.push({ type: 'finalErrors', label: 'Repaso final: registro de errores + capítulos con confianza ≤ 3' })
    }
  }

  // --- Hitos ---
  for (const date of s.cumulativeTests)
    days.get(date)?.events.push({ type: 'cumulativeTest', label: 'Test acumulado NIE (30 preguntas)' })
  for (const date of s.mocks)
    days.get(date)?.events.push({ type: 'mock', label: 'Simulacro NIE completo (80 preguntas · 2 h)' })
  days.get(s.examDate)?.events.push({ type: 'exam', label: 'EXAMEN NIE · ¡mucha suerte!' })

  return { days, lessonDates, nieRanges, from, to }
}

function allocateNie(
  s: Settings,
  groups: NieGroupItem[][],
  days: Map<ISODate, PlanDay>,
  lessonDates: Map<string, ISODate>,
  nieRanges: Map<string, [ISODate, ISODate]>,
) {
  // la 1ª vuelta termina el día antes del último día de academia (ese día es el test acumulado)
  const slots: { date: ISODate; start: number; end: number }[] = []
  let cap = 0
  // la 1ª vuelta del NIE empieza en nieStart (por defecto 02/01), no el primer día de academia
  const nieFrom = s.nieStart && s.nieStart > s.academyStart ? s.nieStart : s.academyStart
  for (const date of eachDay(nieFrom, addDays(s.academyEnd, -1))) {
    const u = nieUnits(weekday(date))
    if (!u) continue
    slots.push({ date, start: cap, end: cap + u })
    cap += u
  }
  const chapters = groups.flat()
  const total = chapters.reduce((a, c) => a + c.weight, 0)
  if (!slots.length || !total) return
  const scale = cap / total
  const EPS = 1e-6

  let t = 0
  for (const c of chapters) {
    const start = t
    const end = t + c.weight * scale
    t = end
    const touched = slots.filter((sl) => sl.end - EPS > start && sl.start + EPS < end)
    touched.forEach((sl, i) => {
      days.get(sl.date)!.nie.push({ chapter: c.chapter, first: i === 0, last: i === touched.length - 1 })
    })
    if (touched.length) {
      lessonDates.set(`nie-${c.chapter}`, touched[0].date)
      nieRanges.set(c.chapter, [touched[0].date, touched[touched.length - 1].date])
    }
  }
}
