import { addDays, type ISODate } from './dates'
import { nieTemario } from './content'
import { dueForStep, stepLabel, type SeriesOptions } from './srs'
import type { Review, Settings } from '../types'

// Reglas de los repasos espaciados y cómo se reparten en Atrasados · Hoy · Próximos 7 días.

/** NIE: +1, +3, +7, +30, +60, +90 y +120 días desde la fecha REAL del paso ⑩. */
export const NIE_OFFSETS: number[] = nieTemario.reviews.offsetsDays

export const isNieKey = (itemKey: string) => itemKey.startsWith('lesson:nie-')

/** Lecciones sin repasos espaciados. */
export const NO_REVIEW = ['lesson:ft-']
/** Lecciones con un solo repaso (+1 día). */
export const ONE_REVIEW = ['lesson:dr-']

/**
 * Serie de repasos de cada cosa:
 * - fitness: sin repasos; conducir: solo +1 día;
 * - capítulos NIE: offsets del temario; no se crean repasos en o después del inicio del repaso final;
 * - diario de academia: solo +1 día y +7 días;
 * - lo demás: +1d, +3d, +7d, +1 mes y luego cada mes.
 */
export function seriesForKey(itemKey: string, s: Settings): SeriesOptions {
  // fitness y peso: se aplica (comer, entrenar, dormir), no se memoriza → sin repasos
  if (NO_REVIEW.some((p) => itemKey.startsWith(p))) return { steps: [] }
  // conducir: un solo repaso, al día siguiente (todo repasado antes de que te den el coche)
  if (ONE_REVIEW.some((p) => itemKey.startsWith(p))) return { steps: [1] }
  if (isNieKey(itemKey)) return { offsets: NIE_OFFSETS, until: s.finalReviewStart }
  if (itemKey.startsWith('academy:')) return { steps: [1, 3] }
  return {}
}

/** Todas las fechas de repaso de un capítulo terminado el día `anchor` (sin retrasos). */
export function plannedDues(anchor: ISODate, s: Settings): ISODate[] {
  return NIE_OFFSETS.map((_, i) => dueForStep(anchor, i + 1, NIE_OFFSETS)).filter((d) => d < s.finalReviewStart)
}

export function reviewStepLabel(r: Pick<Review, 'itemKey' | 'step'>): string {
  return stepLabel(r.step, isNieKey(r.itemKey) ? NIE_OFFSETS : undefined)
}

/** Qué hacer en cada repaso de un capítulo NIE. */
export function reviewGuide(r: Pick<Review, 'itemKey' | 'step'>): string | undefined {
  if (!isNieKey(r.itemKey)) return undefined
  const d = NIE_OFFSETS[r.step - 1]
  if (d <= 1) return 'Lee tu tema escrito y explícalo en voz alta (15–20′)'
  if (d <= 3) return 'Flashcards del capítulo + 10 preguntas'
  if (d <= 7) return 'Recall en voz alta + 15 preguntas + tus errores del tema'
  return 'Relee tu tema + 20 preguntas'
}

export interface ReviewBuckets {
  /** pendientes de días anteriores, los más antiguos primero */
  overdue: Review[]
  /** los de hoy (pendientes y los ya hechos hoy) */
  today: Review[]
  /** pendientes de los próximos 7 días */
  next7: Review[]
}

export function bucketReviews(reviews: Review[], today: ISODate): ReviewBuckets {
  const byDue = [...reviews].sort((a, b) => a.due.localeCompare(b.due) || (a.id ?? 0) - (b.id ?? 0))
  const week = addDays(today, 7)
  return {
    overdue: byDue.filter((r) => !r.doneAt && r.due < today),
    today: byDue.filter((r) => (!r.doneAt && r.due === today) || r.doneAt === today),
    next7: byDue.filter((r) => !r.doneAt && r.due > today && r.due <= week),
  }
}

/** Máximo de repasos atrasados que se enseñan en "Hoy" para no agobiarte. */
export const MAX_OVERDUE_TODAY = 3

/** Los atrasados que caben hoy (los más antiguos) y cuántos quedan esperando. */
export function overdueForToday(overdue: Review[], max = MAX_OVERDUE_TODAY): { shown: Review[]; waiting: number } {
  return { shown: overdue.slice(0, max), waiting: Math.max(0, overdue.length - max) }
}
