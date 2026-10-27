import { addDays, type ISODate } from './dates'
import type { DayLog } from '../types'

/**
 * Racha = días seguidos cumplidos (≥ umbral de tareas hechas).
 * Hoy cuenta si ya está cumplido; si aún no, la racha llega hasta ayer.
 * Los días sin tareas planificadas no rompen la racha.
 */
export function computeStreak(logs: DayLog[], today: ISODate, threshold: number): number {
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const met = (l?: DayLog) => !!l && l.total > 0 && l.done / l.total >= threshold
  const empty = (l?: DayLog) => !!l && l.total === 0

  let streak = 0
  let d = today
  if (!met(byDate.get(d))) d = addDays(d, -1)
  for (let guard = 0; guard < 1000; guard++) {
    const l = byDate.get(d)
    if (met(l)) streak++
    else if (!empty(l)) break
    d = addDays(d, -1)
  }
  return streak
}
