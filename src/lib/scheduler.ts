import { addDays, diffDays, weekday, type ISODate } from './dates'
import type { NieChapterMeta, NiePartial, NieTemario, Settings, WeekKey } from '../types'

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
  /** true si con este trozo el paso queda terminado (false = es solo una parte) */
  final?: boolean
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
  /** capítulo → partes de pasos ya hechas (minutos que no se vuelven a planificar) */
  partial?: Map<string, NiePartial[]>
  /** días marcados "Hoy no puedo" */
  daysOff: Set<ISODate>
  /** hoy */
  today: ISODate
}

const WEEK_KEYS: WeekKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
/** límite de seguridad: no se planifica más allá de 2 años */
const HORIZON_DAYS = 730

/**
 * Minutos de estudio NIE nuevo que caben un día (Ajustes; por defecto L–V 75, sábado 180,
 * domingo 120). Festivos y días "Hoy no puedo": 0.
 */
export function dayCapacity(date: ISODate, s: Settings, c: Capacity, daysOff: Set<ISODate> = new Set()): number {
  const cap = c.newStudyCapacityMinutes
  if (date < s.nieStart || daysOff.has(date) || cap.bankHolidays2027.includes(date)) return 0
  const key = WEEK_KEYS[weekday(date)]
  return s.nieMinutes?.[key] ?? cap.academyWeeks[key]
}

const sumParts = (parts: NiePartial[], step: number, pred: (p: NiePartial) => boolean = () => true) =>
  parts.filter((p) => p.step === step && pred(p)).reduce((a, p) => a + p.minutes, 0)

export function scheduleNie(input: ScheduleInput): NieSchedule {
  const { settings: s, chapters, capacity, progress, daysOff, today } = input
  const partial = input.partial ?? new Map<string, NiePartial[]>()
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

  // lo que ya marcaste HOY (pasos enteros o partes) se queda hoy, hecho, y gasta capacidad de hoy
  let usedFrom = 0
  for (const ch of chapters) {
    const steps = progress.get(ch.code) ?? []
    const parts = partial.get(ch.code) ?? []
    ch.stepMinutes.forEach((m, i) => {
      const step = i + 1
      let minutes = 0
      let final = false
      if (steps[i] === from) {
        minutes = Math.max(0, m - sumParts(parts, step, (p) => p.date !== from))
        final = true
      } else if (!steps[i]) {
        minutes = sumParts(parts, step, (p) => p.date === from)
      }
      if (!minutes && !final) return
      slotFor(from, ch.code).steps.push({ step, minutes, stepMinutes: m, done: true, final })
      usedFrom += minutes
    })
  }

  // cola de pasos pendientes, en tu orden (sin los minutos que ya hiciste por partes)
  const queue: { chapter: string; step: number; minutes: number; stepMinutes: number }[] = []
  for (const ch of chapters) {
    const steps = progress.get(ch.code) ?? []
    const parts = partial.get(ch.code) ?? []
    ch.stepMinutes.forEach((m, i) => {
      if (steps[i]) return
      const left = m - sumParts(parts, i + 1)
      if (left > 0) queue.push({ chapter: ch.code, step: i + 1, minutes: left, stepMinutes: m })
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
    slotFor(date, item.chapter).steps.push({ step: item.step, minutes: take, stepMinutes: item.stepMinutes, final: take >= remaining })
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
    const dates: ISODate[] = [
      ...(progress.get(ch.code) ?? []).filter((d): d is ISODate => !!d),
      ...(partial.get(ch.code) ?? []).map((p) => p.date),
    ]
    for (const [d, list] of days) if (list.some((x) => x.chapter === ch.code)) dates.push(d)
    if (!dates.length) continue
    dates.sort()
    ranges.set(ch.code, [dates[0], dates[dates.length - 1]])
  }
  for (const [d, list] of days)
    for (const slot of list) {
      slot.first = slot.steps.some((x) => x.step === 1)
      slot.last = slot.steps.some((x) => x.step === 10 && x.final) && ranges.get(slot.chapter)?.[1] === d
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
