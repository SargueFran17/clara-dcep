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

export function dueForStep(anchor: ISODate, step: number): ISODate {
  if (step === 1) return addDays(anchor, 1)
  if (step === 2) return addDays(anchor, 3)
  if (step === 3) return addDays(anchor, 7)
  return addMonths(anchor, step - 3)
}

export const STEP_LABELS: Record<number, string> = { 1: '+1 día', 2: '+3 días', 3: '+7 días', 4: '+1 mes' }

export function stepLabel(step: number): string {
  return STEP_LABELS[step] ?? `+${step - 3} meses`
}

/** Primer repaso tras terminar algo. `until` (exclusivo) corta la serie: devuelve null si cae después. */
export function firstReview(completedOn: ISODate, until?: ISODate): ReviewSchedule | null {
  const due = dueForStep(completedOn, 1)
  if (until && due >= until) return null
  return { anchor: completedOn, step: 1, due }
}

/** Siguiente repaso tras hacer uno el día `doneOn`. */
export function nextReview(current: ReviewSchedule, doneOn: ISODate, until?: ISODate): ReviewSchedule | null {
  const delay = Math.max(0, diffDays(doneOn, current.due))
  const anchor = addDays(current.anchor, delay)
  const step = current.step + 1
  const due = dueForStep(anchor, step)
  if (until && due >= until) return null
  return { anchor, step, due }
}

export type ReviewState = 'overdue' | 'today' | 'upcoming'

export function reviewState(due: ISODate, today: ISODate): ReviewState {
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  return 'upcoming'
}
