import { addDays, addMonths, diffDays, type ISODate } from './dates'

// Repetición espaciada de lecciones, capítulos y días de academia.
// Desde la fecha REAL en que terminas algo (el "ancla"): +1 día, +3 días, +7 días,
// +1 mes y después cada mes. Si haces un repaso tarde, todo lo siguiente se desplaza
// esos días de retraso (el ancla se mueve), para no amontonar repasos.

export interface ReviewSchedule {
  anchor: ISODate
  /** nº de repaso: 1 = +1d, 2 = +3d, 3 = +7d, 4 = +1 mes, 5 = +2 meses… */
  step: number
  due: ISODate
}

export function dueForStep(anchor: ISODate, step: number, offsets?: number[]): ISODate {
  if (offsets) return addDays(anchor, offsets[step - 1])
  if (step === 1) return addDays(anchor, 1)
  if (step === 2) return addDays(anchor, 3)
  if (step === 3) return addDays(anchor, 7)
  return addMonths(anchor, step - 3)
}

export const STEP_LABELS: Record<number, string> = { 1: '+1 día', 2: '+3 días', 3: '+7 días', 4: '+1 mes' }

export function stepLabel(step: number, offsets?: number[]): string {
  if (offsets) {
    const d = offsets[step - 1]
    return d === 1 ? '+1 día' : d < 30 ? `+${d} días` : d === 30 ? '+1 mes' : `+${d / 30} meses`
  }
  return STEP_LABELS[step] ?? `+${step - 3} meses`
}

export interface SeriesOptions {
  /** fecha límite (exclusiva): no se programan repasos a partir de ella */
  until?: ISODate
  /** solo estos pasos (p. ej. diario de academia: [1, 3] = +1 día y +7 días) */
  steps?: number[]
  /** días desde el ancla de cada repaso (p. ej. NIE: [1, 3, 7, 30, 60, 90, 120]) */
  offsets?: number[]
}

function stepAfter(step: number, steps?: number[], offsets?: number[]): number | null {
  if (offsets) return step < offsets.length ? step + 1 : null
  if (!steps) return step + 1
  return steps.find((s) => s > step) ?? null
}

/** Primer repaso tras terminar algo. Devuelve null si cae después de `until`. */
export function firstReview(completedOn: ISODate, opts: SeriesOptions = {}): ReviewSchedule | null {
  const step = stepAfter(0, opts.steps, opts.offsets)
  if (step === null) return null
  const due = dueForStep(completedOn, step, opts.offsets)
  if (opts.until && due >= opts.until) return null
  return { anchor: completedOn, step, due }
}

/** Siguiente repaso tras hacer uno el día `doneOn`. */
export function nextReview(current: ReviewSchedule, doneOn: ISODate, opts: SeriesOptions = {}): ReviewSchedule | null {
  const delay = Math.max(0, diffDays(doneOn, current.due))
  const anchor = addDays(current.anchor, delay)
  const step = stepAfter(current.step, opts.steps, opts.offsets)
  if (step === null) return null
  const due = dueForStep(anchor, step, opts.offsets)
  if (opts.until && due >= opts.until) return null
  return { anchor, step, due }
}

export type ReviewState = 'overdue' | 'today' | 'upcoming'

export function reviewState(due: ISODate, today: ISODate): ReviewState {
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  return 'upcoming'
}
