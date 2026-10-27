import type { Plan, PlanEvent } from './planner'
import type { ISODate } from './dates'
import { fmtShort } from './dates'
import type { Review } from '../types'
import { lessonLink, lessonRef } from './content'
import { stepLabel } from './srs'

// Junta en una sola lista las tareas de un día de TODAS las carpetas.

export type TaskSection = 'overdue' | 'plan' | 'reviews' | 'academy' | 'training' | 'habits'

export const SECTION_LABELS: Record<TaskSection, string> = {
  overdue: 'Atrasado',
  plan: 'Lo planificado',
  reviews: 'Repasos espaciados',
  academy: 'Academia',
  training: 'Entreno y tenis',
  habits: 'Hábitos',
}

export type Task =
  | { kind: 'lesson'; key: string; section: TaskSection; title: string; subtitle: string; lessonId: string; done: boolean }
  | { kind: 'review'; key: string; section: TaskSection; title: string; subtitle: string; review: Review; done: boolean; link?: string }
  | { kind: 'check'; key: string; section: TaskSection; title: string; subtitle?: string; done: boolean; link?: string }

export interface TodayData {
  doneLessons: Set<string>
  /** repasos pendientes con fecha ≤ hoy + los hechos hoy */
  reviews: Review[]
  /** claves de taskDone de hoy */
  checked: Set<string>
  /** flashcards pendientes hoy y vistas hoy */
  cards?: { pending: number; reviewedToday: number }
}

function lessonTitle(id: string): { title: string; subtitle: string; link?: string } {
  const ref = lessonRef(id)
  if (!ref) return { title: id, subtitle: '' }
  return { title: `${ref.lesson.code} · ${ref.lesson.title}`, subtitle: ref.subject.name, link: lessonLink(id) }
}

function reviewTitle(r: Review): { title: string; subtitle: string; link?: string } {
  const [type, id] = [r.itemKey.slice(0, r.itemKey.indexOf(':')), r.itemKey.slice(r.itemKey.indexOf(':') + 1)]
  if (type === 'lesson') {
    const t = lessonTitle(id)
    return { ...t, subtitle: `Repaso ${stepLabel(r.step)} · ${t.subtitle}` }
  }
  if (type === 'academy') return { title: `Diario de academia del ${fmtShort(id)}`, subtitle: `Repaso ${stepLabel(r.step)}`, link: `/academia/dia/${id}` }
  return { title: r.itemKey, subtitle: `Repaso ${stepLabel(r.step)}` }
}

const EVENT_SECTION: Partial<Record<PlanEvent['type'], TaskSection>> = {
  academyDiary: 'academy',
  academyWeekSummary: 'academy',
}

const EVENT_LINK: Partial<Record<PlanEvent['type'], string>> = {
  academyWeekSummary: '/academia?tab=resumen',
  cumulativeTest: '/nie/simulacros',
  mock: '/nie/simulacros',
}

export function buildTasks(date: ISODate, plan: Plan, data: TodayData): Task[] {
  const tasks: Task[] = []
  const day = plan.days.get(date)

  // 1. Atrasado: lecciones de días anteriores sin terminar + capítulos NIE cuya 1ª vuelta ya acabó
  for (const [id, planned] of plan.lessonDates) {
    if (planned >= date || data.doneLessons.has(id)) continue
    if (id.startsWith('nie-')) {
      const range = plan.nieRanges.get(id.slice(4))
      if (range && range[1] >= date) continue
    }
    tasks.push({ kind: 'lesson', key: `lesson:${id}`, section: 'overdue', ...lessonTitle(id), subtitle: `Planificada ${fmtShort(planned)} · ${lessonTitle(id).subtitle}`, lessonId: id, done: false })
  }
  for (const r of data.reviews)
    if (r.due < date && !r.doneAt)
      tasks.push({ kind: 'review', key: `review:${r.id}`, section: 'overdue', ...reviewTitle(r), subtitle: `${reviewTitle(r).subtitle} · tocaba el ${fmtShort(r.due)}`, review: r, done: false })

  if (day) {
    // 2. Plan del día
    for (const id of day.lessons)
      tasks.push({ kind: 'lesson', key: `lesson:${id}`, section: 'plan', ...lessonTitle(id), lessonId: id, done: data.doneLessons.has(id) })
    for (const n of day.nie) {
      const id = `nie-${n.chapter}`
      const t = lessonTitle(id)
      const when = n.first && n.last ? 'capítulo completo' : n.first ? 'empiezas hoy' : n.last ? 'último día' : 'continúa'
      tasks.push({ kind: 'check', key: `nie:${n.chapter}`, section: 'plan', title: `NIE ${t.title}`, subtitle: `Método de 10 pasos · ${when}`, done: data.checked.has(`nie:${n.chapter}`) || data.doneLessons.has(id), link: t.link })
    }
    for (const e of day.events) {
      const key = `event:${e.type}${e.group ? `:${e.group}` : ''}`
      tasks.push({ kind: 'check', key, section: EVENT_SECTION[e.type] ?? 'plan', title: e.label, done: data.checked.has(key), link: e.type === 'academyDiary' ? `/academia/dia/${date}` : EVENT_LINK[e.type] })
    }
    // 3. Entreno
    day.workouts.forEach((w, i) => {
      const key = `workout:${i}:${w.type}`
      tasks.push({ kind: 'check', key, section: 'training', title: w.label, done: data.checked.has(key) })
    })
  }

  // 4. Repasos de hoy (pendientes y ya hechos hoy)
  for (const r of data.reviews)
    if (r.due >= date || r.doneAt === date) {
      if (r.due < date) continue // ya listado arriba como atrasado
      tasks.push({ kind: 'review', key: `review:${r.id}`, section: 'reviews', ...reviewTitle(r), review: r, done: r.doneAt === date })
    }
  // repasos atrasados que hiciste hoy: se muestran como hechos
  for (const r of data.reviews)
    if (r.due < date && r.doneAt === date)
      tasks.push({ kind: 'review', key: `review:${r.id}`, section: 'reviews', ...reviewTitle(r), review: r, done: true })

  // 5. Flashcards (si hay algo que repasar hoy)
  if (data.cards && (data.cards.pending > 0 || data.cards.reviewedToday > 0))
    tasks.push({
      kind: 'check', key: 'cards', section: 'reviews', title: `Flashcards (${data.cards.pending} pendientes)`,
      subtitle: `${data.cards.reviewedToday} vistas hoy`, done: data.checked.has('cards') || data.cards.pending === 0, link: '/flashcards',
    })

  // 6. Hábitos (siempre)
  tasks.push({ kind: 'check', key: 'habits', section: 'habits', title: 'Hábitos: comidas del plan, agua y sueño', done: data.checked.has('habits'), link: '/fitness' })

  return tasks
}

/** Para la racha: las tareas atrasadas no cuentan (no penalizan dos veces). */
export function dayScore(tasks: Task[]): { done: number; total: number } {
  const counted = tasks.filter((t) => t.section !== 'overdue')
  return { done: counted.filter((t) => t.done).length, total: counted.length }
}
