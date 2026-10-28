import { addDays, diffDays, eachDay, weekday, type ISODate } from './dates'
import type { NieTemario, Settings, WorkoutItem } from '../types'
import { scheduleNie, type NieSchedule, type NieSlot } from './scheduler'

export type { NieSlot } from './scheduler'

// Planificador: función pura que convierte los Ajustes (fechas) + el orden de content/plan
// en un calendario día a día. Si cambias una fecha, se recalcula todo.

export type Phase = 'before' | 'pre' | 'xmas' | 'academy' | 'nieBlock' | 'final' | 'exam' | 'after'

export type EventType =
  | 'kickoff'
  | 'weeklyReview'
  | 'weighIn'
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
  temario: Pick<NieTemario, 'chapters' | 'groups' | 'finalReview' | 'keyDates' | 'newStudyCapacityMinutes'>
  fitnessWeek: { day: number; items: WorkoutItem[] }[]
  /** el plan de entreno cuenta desde esta fecha */
  fitnessStart?: ISODate
  /** días con más (o menos) lecciones de pre-academia: fecha → nº de lecciones */
  preCapacity?: Record<ISODate, number>
  /** pesaje semanal (día de la semana 0–6) desde el inicio del entreno */
  weighIn?: { weekday: number; label: string }
  /** días "Hoy no puedo": sin estudio nuevo (las lecciones pasan a los días siguientes) */
  daysOff?: Set<ISODate>
  /** tareas de arranque antes del inicio (fecha → tarea) */
  kickoff?: { minutes: number; days: { date: ISODate; label: string }[] }
  /** cola NIE recalculada desde hoy (si falta: plan inicial sin progreso desde el inicio del NIE) */
  nie?: NieSchedule
  /** lo que el plan NIE ponía en días pasados (foto de cada día) */
  nieHistory?: Map<ISODate, NieSlot[]>
}

export interface Plan {
  days: Map<ISODate, PlanDay>
  /** lessonId → fecha planificada (pre-academia) o fecha de inicio (capítulos NIE) */
  lessonDates: Map<string, ISODate>
  /** capítulo → [inicio, fin] de la 1ª vuelta */
  nieRanges: Map<string, [ISODate, ISODate]>
  /** la cola NIE usada para este plan */
  nie: NieSchedule
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
      // L–V: 1–1,5 h de academia + 1–1,5 h de NIE; sábado más NIE; domingo NIE + repasos
      return wd === 5 ? 210 : 150
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

/** Plan NIE inicial (sin progreso), desde el inicio del NIE. */
export function initialNieSchedule(s: Settings, temario: PlanInputs['temario']): NieSchedule {
  const order = temario.groups.flat()
  const chapters = order.map((c) => temario.chapters.find((x) => x.code === c)!).filter(Boolean)
  return scheduleNie({ settings: s, chapters, capacity: temario, progress: new Map(), daysOff: new Set(), today: s.nieStart })
}

/**
 * Repaso final por grupos: las fechas fijas del temario, desplazadas si cambias el inicio
 * del repaso final en Ajustes.
 */
export function finalReviewDays(s: Settings, temario: PlanInputs['temario']): { date: ISODate; group: number; chapters: string[] }[] {
  const base = temario.keyDates.finalReviewStart
  const shift = base ? diffDays(s.finalReviewStart, base) : 0
  return temario.finalReview.map((f, i) => ({ date: addDays(f.date, shift), group: i + 1, chapters: f.chapters }))
}

export function buildPlan(s: Settings, inputs: PlanInputs): Plan {
  const firstKick = inputs.kickoff?.days[0]?.date
  const start = firstKick && firstKick < s.studyStart ? firstKick : s.studyStart
  const from = start < s.academyStart ? start : s.academyStart
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
      workouts: inputs.fitnessStart && date < inputs.fitnessStart ? [] : (inputs.fitnessWeek.find((w) => w.day === wd)?.items ?? []),
    })
  }

  // --- Pesaje semanal ---
  if (inputs.weighIn)
    for (const day of days.values())
      if (weekday(day.date) === inputs.weighIn.weekday && (!inputs.fitnessStart || day.date >= inputs.fitnessStart) && day.phase !== 'after')
        day.events.push({ type: 'weighIn', label: inputs.weighIn.label })

  // --- Arranque (antes de empezar en serio) ---
  for (const k of inputs.kickoff?.days ?? []) {
    const day = days.get(k.date)
    if (!day || k.date >= s.studyStart) continue
    day.events.push({ type: 'kickoff', label: k.label })
    day.targetMin = Math.max(day.targetMin, inputs.kickoff!.minutes)
  }

  // --- Pre-academia: lecciones en orden ---
  const queue = [...inputs.preOrder]
  for (const date of eachDay(s.studyStart, s.preEnd)) {
    const day = days.get(date)!
    const wd = weekday(date)
    const extra = inputs.preCapacity?.[date]
    if (wd === 6 && extra === undefined) day.events.push({ type: 'weeklyReview', label: 'Repaso semanal (1,5 h): flashcards + mini-tests de la semana' })
    const off = inputs.daysOff?.has(date)
    if (off) day.targetMin = 0
    if (extra !== undefined && !off) day.targetMin = Math.max(day.targetMin, extra * 60)
    for (let i = 0; i < (off ? 0 : (extra ?? preCapacity(wd))) && queue.length; i++) {
      const id = queue.shift()!
      day.lessons.push(id)
      lessonDates.set(id, date)
    }
    if (!day.lessons.length && wd !== 6 && !off)
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
      day.events.push({ type: 'academyStudy', label: 'Estudio de la academia: repasar y completar lo de hoy (1 h – 1 h 30 con el diario)' })
      day.events.push({ type: 'academyDiary', label: 'Diario de academia: 5 ideas clave, dudas y flashcards (15–20 min)' })
    }
    if (wd === 6) {
      day.events.push({ type: 'weeklyReview', label: 'Repasos de la semana (2 h)' })
      day.events.push({ type: 'academyWeekSummary', label: 'Resumen semanal de la academia' })
    }
  }
  // --- NIE 1ª vuelta: cola de pasos (días pasados = foto guardada; hoy y futuro = recalculado) ---
  const nie = inputs.nie ?? initialNieSchedule(s, inputs.temario)
  for (const [date, slots] of inputs.nieHistory ?? []) {
    const day = days.get(date)
    if (day && date < nie.from) day.nie = slots
  }
  for (const [date, slots] of nie.days) {
    const day = days.get(date)
    if (day) day.nie = slots
  }
  for (const [chapter, range] of nie.ranges) {
    nieRanges.set(chapter, range)
    lessonDates.set(`nie-${chapter}`, range[0])
  }

  // --- Bloque NIE y repaso final ---
  const special = new Set([...s.mocks, ...s.cumulativeTests, s.examDate])
  for (const date of eachDay(s.nieBlockStart, addDays(s.finalReviewStart, -1)))
    if (!special.has(date))
      days.get(date)?.events.push({ type: 'nieRevision', label: 'NIE: repasos espaciados + preguntas por partes + registro de errores' })

  const finals = finalReviewDays(s, inputs.temario)
  for (const f of finals)
    days.get(f.date)?.events.push({ type: 'finalGroup', label: `Repaso final · grupo ${f.group} (${f.chapters.join(', ')})`, group: f.group })
  const finalDates = new Set(finals.map((f) => f.date))
  for (const date of eachDay(s.finalReviewStart, s.finalReviewEnd)) {
    if (special.has(date) || finalDates.has(date)) continue
    days.get(date)?.events.push({ type: 'finalErrors', label: 'Repaso final: registro de errores + capítulos con confianza ≤ 3' })
  }

  // --- Hitos ---
  for (const date of s.cumulativeTests)
    days.get(date)?.events.push({ type: 'cumulativeTest', label: 'Test acumulado NIE (30 preguntas)' })
  for (const date of s.mocks)
    days.get(date)?.events.push({ type: 'mock', label: 'Simulacro NIE completo (80 preguntas · 2 h)' })
  days.get(s.examDate)?.events.push({ type: 'exam', label: 'EXAMEN NIE · ¡mucha suerte!' })

  return { days, lessonDates, nieRanges, nie, from, to }
}
