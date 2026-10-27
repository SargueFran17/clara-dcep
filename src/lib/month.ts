import { addDays, startOfWeek, type ISODate } from './dates'
import type { Phase, PlanDay } from './planner'
import { lessonRef } from './content'

// Calendario mensual: celdas (con relleno de lunes a domingo) y resumen corto de cada día.

export const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** Días de la cuadrícula del mes `ym` ("aaaa-mm"): semanas completas de lunes a domingo. */
export function monthGrid(ym: string): ISODate[] {
  const first = `${ym}-01`
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const out: ISODate[] = []
  for (let d = startOfWeek(first); d <= last || out.length % 7; d = addDays(d, 1)) out.push(d)
  return out
}

export function addMonthsYM(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

const EVENT_SHORT: Record<string, string> = {
  kickoff: '🚀 Arranque',
  weeklyReview: '🔁 Repaso',
  preReview: '🔁 Repaso',
  xmasLight: '🎄 Ligero',
  academyStudy: '🏫 Academia',
  cumulativeTest: '📝 Test',
  mock: '⏱️ Simulacro',
  exam: '🎯 EXAMEN',
  nieRevision: '🔁 Repasos',
  finalErrors: '❌ Errores',
}

/** Hasta 4 líneas cortas con lo principal del día (una por cosa). */
export function daySummary(p: PlanDay | undefined): string[] {
  if (!p) return []
  const out: string[] = []
  const push = (x: string) => !out.includes(x) && out.push(x)
  for (const e of p.events) if (e.type === 'exam' || e.type === 'mock' || e.type === 'cumulativeTest') push(EVENT_SHORT[e.type])
  for (const e of p.events) if (e.type === 'finalGroup') push(`🏁 Final G${e.group}`)
  for (const id of p.lessons) push(lessonRef(id)?.lesson.code ?? id)
  for (const n of p.nie) push(`NIE ${n.chapter}`)
  for (const e of p.events) if (EVENT_SHORT[e.type]) push(EVENT_SHORT[e.type])
  return out.slice(0, 4)
}

export const PHASE_TINT: Record<Phase, string> = {
  before: 'bg-slate-50 dark:bg-slate-900',
  pre: 'bg-sky-50 dark:bg-sky-950/40',
  xmas: 'bg-emerald-50 dark:bg-emerald-950/40',
  academy: 'bg-indigo-50 dark:bg-indigo-950/40',
  nieBlock: 'bg-amber-50 dark:bg-amber-950/40',
  final: 'bg-rose-50 dark:bg-rose-950/40',
  exam: 'bg-rose-200 dark:bg-rose-900/60',
  after: 'bg-slate-50 dark:bg-slate-900',
}
