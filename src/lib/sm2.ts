import { addDays, type ISODate } from './dates'
import type { CardState } from '../types'

// Flashcards tipo Anki: SM-2 simplificado con 3 botones.
//  - Lo sé    → el intervalo crece (1 → 4 → intervalo × facilidad) y la facilidad sube un poco.
//  - Dudo     → el intervalo crece poco (× 1,2) y la facilidad baja.
//  - No lo sé → vuelve mañana (y otra vez al final de la sesión), la facilidad baja.

export type Grade = 'know' | 'doubt' | 'forgot'

export const GRADE_LABELS: Record<Grade, string> = { know: 'Lo sé', doubt: 'Dudo', forgot: 'No lo sé' }

const MIN_EASE = 1.3
const START_EASE = 2.5

export function newCardState(cardId: string, today: ISODate): CardState {
  return { cardId, ease: START_EASE, interval: 0, reps: 0, lapses: 0, due: today, introduced: today, lastReviewed: today }
}

export function grade(state: CardState, g: Grade, today: ISODate): CardState {
  let { ease, interval, reps, lapses } = state
  if (g === 'forgot') {
    reps = 0
    lapses += 1
    interval = 1
    ease = Math.max(MIN_EASE, ease - 0.2)
  } else if (g === 'doubt') {
    reps += 1
    interval = reps === 1 ? 1 : Math.max(interval + 1, Math.round(interval * 1.2))
    ease = Math.max(MIN_EASE, ease - 0.15)
  } else {
    reps += 1
    interval = reps === 1 ? 1 : reps === 2 ? 4 : Math.round(interval * ease)
    ease = ease + 0.1
  }
  return { ...state, ease: +ease.toFixed(2), interval, reps, lapses, due: addDays(today, interval), lastReviewed: today }
}

export interface QueueInput {
  cardIds: string[]
  states: Map<string, CardState>
  today: ISODate
  newLimit: number
  reviewLimit: number
}

/** Cola del día: primero las que tocan (más atrasadas primero), luego nuevas hasta el límite diario. */
export function buildQueue({ cardIds, states, today, newLimit, reviewLimit }: QueueInput): { due: string[]; fresh: string[] } {
  const due = cardIds
    .filter((id) => states.has(id) && states.get(id)!.due <= today)
    .sort((a, b) => states.get(a)!.due.localeCompare(states.get(b)!.due))
    .slice(0, reviewLimit)
  const introducedToday = [...states.values()].filter((s) => s.introduced === today).length
  const fresh = cardIds.filter((id) => !states.has(id)).slice(0, Math.max(0, newLimit - introducedToday))
  return { due, fresh }
}
