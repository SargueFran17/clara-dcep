import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useDoneLessons, usePlan, useToday } from '../lib/hooks'
import { buildTasks, type Task, type TaskSection } from '../lib/today'
import { lessonLink } from '../lib/content'
import type { ISODate } from '../lib/dates'

// Todo lo que toca un día, ordenado por apartados (para Semana, Mes y la página de cada día).

const SECTIONS: { id: TaskSection; label: string; icon: string }[] = [
  { id: 'plan', label: 'Estudio', icon: '📚' },
  { id: 'training', label: 'Entreno y peso', icon: '🏋️' },
  { id: 'academy', label: 'Academia', icon: '🏫' },
  { id: 'reviews', label: 'Repasos', icon: '🔁' },
  { id: 'habits', label: 'Hábitos', icon: '✅' },
]

/** Tareas de un día cualquiera (sin "atrasado"; los pasos NIE pasados se dan por hechos si los marcaste). */
export function useDayTasks(date: ISODate): Task[] | undefined {
  const plan = usePlan()
  const doneLessons = useDoneLessons()
  const today = useToday()
  const reviews = useLiveQuery(
    () => db.reviews.filter((r) => r.doneAt === date || (!r.doneAt && (date === today ? r.due <= date : r.due === date))).toArray(),
    [date, today],
  )
  const checked = useLiveQuery(() => db.taskDone.where('date').equals(date).toArray(), [date])
  const states = useLiveQuery(() => db.nieChapter.toArray(), [])
  return useMemo(() => {
    if (!reviews || !checked || !states) return undefined
    const byId = new Map(states.map((x) => [x.chapterId, x]))
    return buildTasks(date, plan, { doneLessons, reviews, checked: new Set(checked.map((c) => c.key)) })
      .filter((t) => t.section !== 'overdue')
      .map((t) => (t.kind === 'nieStep' && !t.done && byId.get(t.chapter)?.steps[t.step - 1] ? { ...t, done: true } : t))
  }, [date, plan, doneLessons, reviews, checked, states])
}

export function DayTasks({ date, compact = false }: { date: ISODate; compact?: boolean }) {
  const tasks = useDayTasks(date)
  if (!tasks) return null
  const real = tasks.filter((t) => t.section !== 'habits')
  if (!real.length) return <p className="text-sm text-slate-500">Día libre: descansa 😊</p>
  return (
    <div className="space-y-2">
      {SECTIONS.map((sec) => {
        const list = tasks.filter((t) => t.section === sec.id)
        if (!list.length || (compact && sec.id === 'habits')) return null
        return (
          <div key={sec.id}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {sec.icon} {sec.label}
            </div>
            <ul className="mt-0.5 space-y-0.5">
              {list.map((t) => {
                const link = t.kind === 'lesson' ? lessonLink(t.lessonId) : t.link
                const body = (
                  <>
                    <span className={`mt-0.5 shrink-0 ${t.done ? 'text-emerald-600' : 'text-slate-300 dark:text-slate-600'}`}>{t.done ? '✓' : '○'}</span>
                    <span className="min-w-0">
                      <span className={`text-sm ${t.done ? 'text-slate-400 line-through' : ''}`}>{t.title}</span>
                      {!compact && 'subtitle' in t && t.subtitle && <span className="block text-xs text-slate-500">{t.subtitle}</span>}
                      {compact && t.kind === 'nieStep' && <span className="ml-1 text-xs text-slate-500">({t.minutes}′)</span>}
                    </span>
                  </>
                )
                return (
                  <li key={t.key}>
                    {link ? (
                      <Link to={link} className="flex gap-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">{body}</Link>
                    ) : (
                      <div className="flex gap-2">{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
