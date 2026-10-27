import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useDoneLessons, usePlan, useSettings, useToday } from '../lib/hooks'
import { buildTasks, dayScore, SECTION_LABELS, type Task, type TaskSection } from '../lib/today'
import { completeLesson, completeReview, logMinutes, setTaskDone, uncompleteLesson, undoReview } from '../lib/actions'
import { computeStreak } from '../lib/streak'
import { diffDays, fmtLong, fmtUK } from '../lib/dates'
import { PHASE_LABELS } from '../lib/planner'
import { Card, Check, Pill, ProgressBar } from '../components/ui'

const ORDER: TaskSection[] = ['overdue', 'plan', 'academy', 'reviews', 'training', 'habits']

export function Today() {
  const today = useToday()
  const settings = useSettings()
  const plan = usePlan()
  const doneLessons = useDoneLessons()
  const reviews = useLiveQuery(
    () => db.reviews.where('due').belowOrEqual(today).filter((r) => !r.doneAt || r.doneAt === today).toArray(),
    [today],
  )
  const checkedRows = useLiveQuery(() => db.taskDone.where('date').equals(today).toArray(), [today])
  const logs = useLiveQuery(() => db.dayLog.toArray(), [])
  const minutes = useLiveQuery(() => db.studySessions.where('date').equals(today).toArray(), [today])

  const tasks = useMemo(
    () =>
      reviews && checkedRows
        ? buildTasks(today, plan, { doneLessons, reviews, checked: new Set(checkedRows.map((r) => r.key)) })
        : [],
    [today, plan, doneLessons, reviews, checkedRows],
  )
  const score = dayScore(tasks)

  // guarda la puntuación del día para la racha
  useEffect(() => {
    if (reviews && checkedRows) db.dayLog.put({ date: today, ...score })
  }, [today, score.done, score.total, reviews, checkedRows])

  const streak = computeStreak(logs ?? [], today, settings.streakThreshold)
  const day = plan.days.get(today)
  const phase = day?.phase ?? (today < plan.from ? 'before' : 'after')
  const studied = (minutes ?? []).reduce((a, s) => a + s.minutes, 0)
  const target = day?.targetMin ?? 0

  async function toggle(t: Task, value: boolean) {
    if (t.kind === 'lesson') return value ? completeLesson(t.lessonId, today) : uncompleteLesson(t.lessonId)
    if (t.kind === 'review') return value ? completeReview(t.review, today) : undoReview(t.review)
    return setTaskDone(today, t.key, value)
  }

  async function undoLastMinutes() {
    const last = (minutes ?? []).at(-1)
    if (last?.id) await db.studySessions.delete(last.id)
  }

  const toAcademy = diffDays(settings.academyStart, today)
  const toExam = diffDays(settings.examDate, today)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight first-letter:uppercase">{fmtLong(today)}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {fmtUK(today)} · {PHASE_LABELS[phase]}
          </p>
        </div>
        <div className="rounded-2xl bg-orange-100 px-3 py-2 text-center dark:bg-orange-900/40" title="Días seguidos cumpliendo el plan">
          <div className="text-xl font-bold leading-none">🔥 {streak}</div>
          <div className="mt-1 text-[10px] font-medium uppercase text-orange-800 dark:text-orange-300">racha</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {toAcademy > 0 && <Pill tone="amber">Academia en {toAcademy} días</Pill>}
        {toExam > 0 && <Pill tone="red">NIE en {toExam} días (estimado)</Pill>}
      </div>

      {phase === 'before' && (
        <Card className="border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40">
          <p className="text-sm">
            Empiezas en serio el <b>{fmtUK(settings.studyStart)}</b>. Mientras tanto puedes explorar las{' '}
            <Link className="font-semibold text-indigo-600 underline dark:text-indigo-300" to="/carpetas">carpetas</Link> y adelantar lecciones.
          </p>
        </Card>
      )}

      <Card>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold">Hoy: {score.done}/{score.total} tareas</span>
          <span className="text-slate-500">
            {studied} / {target} min
          </span>
        </div>
        <ProgressBar pct={score.total ? (score.done / score.total) * 100 : 0} color="emerald" />
        <ProgressBar pct={target ? (studied / target) * 100 : 0} className="mt-2" />
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Registrar estudio:</span>
          {[15, 30, 60].map((m) => (
            <button key={m} onClick={() => logMinutes(today, m)} className="rounded-full bg-indigo-100 px-3 py-1 font-semibold text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200">
              +{m}′
            </button>
          ))}
          {!!minutes?.length && (
            <button onClick={undoLastMinutes} className="rounded-full px-2 py-1 text-xs text-slate-500 underline">
              deshacer
            </button>
          )}
        </div>
      </Card>

      {ORDER.map((section) => {
        const list = tasks.filter((t) => t.section === section)
        if (!list.length) return null
        return (
          <section key={section}>
            <h2 className={`mb-2 text-xs font-bold uppercase tracking-wider ${section === 'overdue' ? 'text-rose-600' : 'text-slate-500'}`}>
              {SECTION_LABELS[section]} {section === 'overdue' && `(${list.length})`}
            </h2>
            <div className="space-y-2">
              {list.map((t) => (
                <TaskRow key={t.key} task={t} onToggle={(v) => toggle(t, v)} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (v: boolean) => void }) {
  const link = task.kind === 'lesson' ? `/leccion/${task.lessonId}` : task.link
  const overdue = task.section === 'overdue'
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm dark:bg-slate-900 ${
        overdue ? 'border-rose-200 dark:border-rose-900' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <Check checked={task.done} onChange={onToggle} label={task.title} />
      <div className={`min-w-0 flex-1 ${task.done ? 'opacity-50' : ''}`}>
        <div className={`text-sm font-medium ${task.done ? 'line-through' : ''}`}>{task.title}</div>
        {task.subtitle && <div className="truncate text-xs text-slate-500 dark:text-slate-400">{task.subtitle}</div>}
      </div>
      {link && (
        <Link to={link} className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800" aria-label="Abrir">
          →
        </Link>
      )}
    </div>
  )
}
