import { addDays, diffDays, weekday, type ISODate } from './dates'
import type { NieChapterMeta, NieTemario, Settings } from '../types'

// Plan NIE como COLA: los pasos que te quedan, en tu orden de capítulos, se reparten desde HOY
// según los minutos que caben cada día. Lo que no marcas hecho pasa solo al siguiente hueco;
// nunca se pone más tiempo del que cabe en un día. Función pura: no toca la base de datos.

export interface StepChunk {
  /** nº de paso del método (1–10) */
  step: number
  /** minutos de este paso que tocan este día */
  minutes: number
  /** minutos totales del paso (si minutes < stepMinutes, el paso está repartido entre días) */
  stepMinutes: number
  /** true si ya lo marcaste hecho ese día */
  done?: boolean
}

export interface NieSlot {
  chapter: string
  /** true el día en que empieza el capítulo (paso 1) */
  first: boolean
  /** true el día en que termina (paso 10) */
  last: boolean
  steps: StepChunk[]
}

export interface NieSchedule {
  /** primer día recalculado (hoy, o el inicio del NIE si aún no ha llegado) */
  from: ISODate
  days: Map<ISODate, NieSlot[]>
  /** capítulo → [inicio, fin] (real si ya lo empezaste, previsto para lo que falta) */
  ranges: Map<string, [ISODate, ISODate]>
  /** último día con estudio nuevo; null si no queda nada */
  finish: ISODate | null
  /** minutos pendientes en total */
  pendingMinutes: number
}

export type Capacity = Pick<NieTemario, 'newStudyCapacityMinutes'>

export interface ScheduleInput {
  settings: Settings
  chapters: NieChapterMeta[]
  capacity: Capacity
  /** capítulo → fecha en que marcaste cada paso (null = pendiente) */
  progress: Map<string, (ISODate | null)[]>
  /** días marcados "Hoy no puedo" */
  daysOff: Set<ISODate>
  /** hoy */
  today: ISODate
}

const WEEK_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
/** límite de seguridad: no se planifica más allá de 2 años */
const HORIZON_DAYS = 730

/** Minutos de estudio NIE nuevo que caben un día: L–V 75, sábado 180, domingo y festivos 0. */
export function dayCapacity(date: ISODate, s: Settings, c: Capacity, daysOff: Set<ISODate> = new Set()): number {
  const cap = c.newStudyCapacityMinutes
  if (date < s.nieStart || daysOff.has(date) || cap.bankHolidays2027.includes(date)) return 0
  const wd = weekday(date)
  if (date >= s.nieBlockStart && wd < 5) return cap.nieBlockWeekdays
  return cap.academyWeeks[WEEK_KEYS[wd]]
}

export function scheduleNie(input: ScheduleInput): NieSchedule {
  const { settings: s, chapters, capacity, progress, daysOff, today } = input
  const from = today > s.nieStart ? today : s.nieStart
  const days = new Map<ISODate, NieSlot[]>()
  const ranges = new Map<string, [ISODate, ISODate]>()

  const slotFor = (date: ISODate, chapter: string): NieSlot => {
    const list = days.get(date) ?? []
    if (!days.has(date)) days.set(date, list)
    let slot = list.find((x) => x.chapter === chapter)
    if (!slot) list.push((slot = { chapter, first: false, last: false, steps: [] }))
    return slot
  }

  // lo que ya marcaste HOY se queda hoy (hecho) y gasta capacidad de hoy
  let usedFrom = 0
  for (const ch of chapters) {
    const steps = progress.get(ch.code) ?? []
    steps.forEach((d, i) => {
      if (d !== from) return
      slotFor(from, ch.code).steps.push({ step: i + 1, minutes: ch.stepMinutes[i], stepMinutes: ch.stepMinutes[i], done: true })
      usedFrom += ch.stepMinutes[i]
    })
  }

  // cola de pasos pendientes, en tu orden
  const queue: { chapter: string; step: number; minutes: number }[] = []
  for (const ch of chapters) {
    const steps = progress.get(ch.code) ?? []
    ch.stepMinutes.forEach((m, i) => {
      if (!steps[i]) queue.push({ chapter: ch.code, step: i + 1, minutes: m })
    })
  }
  const pendingMinutes = queue.reduce((a, q) => a + q.minutes, 0)

  let finish: ISODate | null = null
  let date = from
  let left = Math.max(0, dayCapacity(date, s, capacity, daysOff) - usedFrom)
  let qi = 0
  let remaining = queue[0]?.minutes ?? 0
  const limit = addDays(from, HORIZON_DAYS)
  while (qi < queue.length && date <= limit) {
    if (left <= 0) {
      date = addDays(date, 1)
      left = dayCapacity(date, s, capacity, daysOff)
      continue
    }
    const item = queue[qi]
    const take = Math.min(left, remaining)
    slotFor(date, item.chapter).steps.push({ step: item.step, minutes: take, stepMinutes: item.minutes })
    left -= take
    remaining -= take
    finish = date
    if (remaining <= 0) {
      qi++
      remaining = queue[qi]?.minutes ?? 0
    }
  }

  // rangos de cada capítulo: días reales de los pasos hechos + días previstos para lo que falta
  for (const ch of chapters) {
    const dates: ISODate[] = (progress.get(ch.code) ?? []).filter((d): d is ISODate => !!d)
    for (const [d, list] of days) if (list.some((x) => x.chapter === ch.code)) dates.push(d)
    if (!dates.length) continue
    dates.sort()
    ranges.set(ch.code, [dates[0], dates[dates.length - 1]])
  }
  for (const [d, list] of days)
    for (const slot of list) {
      slot.first = slot.steps.some((x) => x.step === 1)
      slot.last = slot.steps.some((x) => x.step === 10) && ranges.get(slot.chapter)?.[1] === d
    }

  return { from, days, ranges, finish, pendingMinutes }
}

export interface Margin {
  /** fecha en que terminarías la 1ª vuelta al ritmo actual (null = ya está todo hecho) */
  finish: ISODate | null
  /** días de margen hasta el fin de la academia (negativo = vas tarde) */
  days: number
}

export function nieMargin(schedule: NieSchedule, s: Settings): Margin {
  if (!schedule.finish) return { finish: null, days: 0 }
  return { finish: schedule.finish, days: diffDays(s.academyEnd, schedule.finish) }
}
