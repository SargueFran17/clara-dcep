import type { Plan, PlanEvent } from './planner'
import type { ISODate } from './dates'
import { fmtShort } from './dates'
import type { Review } from '../types'
import { lessonLink, lessonRef, nieTemario } from './content'
import { overdueForToday, reviewGuide, reviewStepLabel } from './reviews'

/** ① … ⑩ */
export const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']
export const stepName = (step: number) => nieTemario.method[step - 1]?.name ?? `Paso ${step}`

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
  | { kind: 'nieStep'; key: string; section: TaskSection; title: string; subtitle: string; chapter: string; step: number; done: boolean; link: string }
  /** aviso sin casilla: "X repasos más esperando" */
  | { kind: 'more'; key: string; section: TaskSection; title: string; done: false; link: string }

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

export function reviewTitle(r: Review): { title: string; subtitle: string; link?: string } {
  const [type, id] = [r.itemKey.slice(0, r.itemKey.indexOf(':')), r.itemKey.slice(r.itemKey.indexOf(':') + 1)]
  const label = reviewStepLabel(r)
  if (type === 'lesson') {
    const t = lessonTitle(id)
    const guide = reviewGuide(r)
    return { ...t, subtitle: `Repaso ${label} · ${guide ?? t.subtitle}` }
  }
  if (type === 'academy') return { title: `Diario de academia del ${fmtShort(id)}`, subtitle: `Repaso ${label}`, link: `/academia/dia/${id}` }
  return { title: r.itemKey, subtitle: `Repaso ${label}` }
}

const EVENT_SECTION: Partial<Record<PlanEvent['type'], TaskSection>> = {
  academyDiary: 'academy',
  academyStudy: 'academy',
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

  // 1. Atrasado: lecciones de días anteriores sin terminar (el NIE no se atrasa: es una cola que se
  //    recoloca sola) + como mucho 3 repasos atrasados, los más antiguos primero
  for (const [id, planned] of plan.lessonDates) {
    if (planned >= date || data.doneLessons.has(id) || id.startsWith('nie-')) continue
    tasks.push({ kind: 'lesson', key: `lesson:${id}`, section: 'overdue', ...lessonTitle(id), subtitle: `Planificada ${fmtShort(planned)} · ${lessonTitle(id).subtitle}`, lessonId: id, done: false })
  }
  const overdue = data.reviews.filter((r) => r.due < date && !r.doneAt).sort((a, b) => a.due.localeCompare(b.due) || (a.id ?? 0) - (b.id ?? 0))
  const { shown, waiting } = overdueForToday(overdue)
  for (const r of shown)
    tasks.push({ kind: 'review', key: `review:${r.id}`, section: 'overdue', ...reviewTitle(r), subtitle: `${reviewTitle(r).subtitle} · tocaba el ${fmtShort(r.due)}`, review: r, done: false })
  if (waiting)
    tasks.push({ kind: 'more', key: 'reviews:waiting', section: 'overdue', title: `${waiting} repaso${waiting === 1 ? '' : 's'} más esperando (mañana te saldrán los siguientes)`, done: false, link: '/nie/repasos' })

  if (day) {
    // 2. Plan del día
    for (const id of day.lessons)
      tasks.push({ kind: 'lesson', key: `lesson:${id}`, section: 'plan', ...lessonTitle(id), lessonId: id, done: data.doneLessons.has(id) })
    for (const n of day.nie)
      for (const c of n.steps) {
        const ref = lessonRef(`nie-${n.chapter}`)
        const part = c.minutes < c.stepMinutes ? `${c.minutes}′ de ${c.stepMinutes}′ (el paso sigue otro día)` : `${c.minutes}′`
        tasks.push({
          kind: 'nieStep', key: `nie:${n.chapter}:${c.step}`, section: 'plan', chapter: n.chapter, step: c.step,
          title: `NIE ${n.chapter} · ${CIRCLED[c.step - 1]} ${stepName(c.step)}`,
          subtitle: `${part} · ${ref?.lesson.title.replace(/^\S+\s/, '') ?? ''}`,
          done: !!c.done, link: `/nie/capitulo/${n.chapter}`,
        })
      }
    for (const e of day.events) {
      const key = `event:${e.type}${e.group ? `:${e.group}` : ''}`
      tasks.push({ kind: 'check', key, section: EVENT_SECTION[e.type] ?? 'plan', title: e.label, done: data.checked.has(key), link: e.type === 'academyDiary' || e.type === 'academyStudy' ? `/academia/dia/${date}` : EVENT_LINK[e.type] })
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
      if (r.due < date) continue // los atrasados hechos hoy van abajo
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
  const counted = tasks.filter((t) => t.section !== 'overdue' && t.kind !== 'more')
  return { done: counted.filter((t) => t.done).length, total: counted.length }
}
