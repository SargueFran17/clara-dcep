import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useDoneLessons, usePlan, useToday } from '../lib/hooks'
import { addDays, dayLetter, eachDay, fmtShort, fmtUK, startOfWeek } from '../lib/dates'
import { CIRCLED } from '../lib/today'
import { lessonRef } from '../lib/content'
import { PHASE_LABELS } from '../lib/planner'
import { Card, PageHeader, ProgressBar } from '../components/ui'

const hours = (min: number) => (min / 60).toLocaleString('es-ES', { maximumFractionDigits: 1 })

export function Week() {
  const today = useToday()
  const [offset, setOffset] = useState(0)
  const monday = addDays(startOfWeek(today), offset * 7)
  const sunday = addDays(monday, 6)
  const days = eachDay(monday, sunday)
  const plan = usePlan()
  const done = useDoneLessons()
  const sessions = useLiveQuery(() => db.studySessions.where('date').between(monday, sunday, true, true).toArray(), [monday])
  const checked = useLiveQuery(() => db.taskDone.where('date').between(monday, sunday, true, true).toArray(), [monday])

  const minutesOn = (d: string) => (sessions ?? []).filter((s) => s.date === d).reduce((a, s) => a + s.minutes, 0)
  const workoutsDoneOn = (d: string) => (checked ?? []).filter((c) => c.date === d && c.key.startsWith('workout:')).length

  const target = days.reduce((a, d) => a + (plan.days.get(d)?.targetMin ?? 0), 0)
  const real = days.reduce((a, d) => a + minutesOn(d), 0)
  const plannedWorkouts = days.reduce((a, d) => a + (plan.days.get(d)?.workouts.filter((w) => w.type !== 'rest').length ?? 0), 0)
  const doneWorkouts = (checked ?? []).filter((c) => c.key.startsWith('workout:') && !c.key.endsWith(':rest')).length

  return (
    <div>
      <PageHeader
        title="Semana"
        subtitle={`${fmtUK(monday)} – ${fmtUK(sunday)}`}
        right={
          <div className="flex gap-1">
            <button className="rounded-full px-3 py-1 hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => setOffset(offset - 1)} aria-label="Semana anterior">‹</button>
            {offset !== 0 && <button className="rounded-full px-2 py-1 text-xs hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => setOffset(0)}>hoy</button>}
            <button className="rounded-full px-3 py-1 hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => setOffset(offset + 1)} aria-label="Semana siguiente">›</button>
          </div>
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-slate-500">Horas de estudio</div>
            <div className="text-xl font-bold">{hours(real)} <span className="text-sm font-normal text-slate-500">/ {hours(target)} h</span></div>
            <ProgressBar pct={target ? (real / target) * 100 : 0} className="mt-1" />
          </div>
          <div>
            <div className="text-slate-500">Entrenos</div>
            <div className="text-xl font-bold">{doneWorkouts} <span className="text-sm font-normal text-slate-500">/ {plannedWorkouts}</span></div>
            <ProgressBar pct={plannedWorkouts ? (doneWorkouts / plannedWorkouts) * 100 : 0} color="sky" className="mt-1" />
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        {days.map((d) => {
          const p = plan.days.get(d)
          const isToday = d === today
          const min = minutesOn(d)
          return (
            <Card key={d} className={isToday ? 'ring-2 ring-indigo-400' : ''}>
              <div className="flex items-baseline justify-between">
                <div className="font-semibold">
                  <span className="mr-2 inline-block w-5 text-indigo-600 dark:text-indigo-300">{dayLetter(d)}</span>
                  {fmtShort(d)} {isToday && <span className="text-xs text-indigo-500">· hoy</span>}
                </div>
                <div className="text-xs text-slate-500">
                  {p ? PHASE_LABELS[p.phase] : ''} · {min}/{p?.targetMin ?? 0} min · 🏋️ {workoutsDoneOn(d)}/{p?.workouts.filter((w) => w.type !== 'rest').length ?? 0}
                </div>
              </div>
              {p && (
                <ul className="mt-2 space-y-1 text-sm">
                  {p.lessons.map((id) => {
                    const ref = lessonRef(id)
                    return (
                      <li key={id}>
                        <Link to={`/leccion/${id}`} className={`hover:underline ${done.has(id) ? 'text-slate-400 line-through' : ''}`}>
                          📖 {ref?.lesson.code} · {ref?.lesson.title}
                        </Link>
                      </li>
                    )
                  })}
                  {p.nie.map((n) => (
                    <li key={n.chapter}>
                      <Link to={`/nie/capitulo/${n.chapter}`} className={`hover:underline ${done.has(`nie-${n.chapter}`) ? 'text-slate-400 line-through' : ''}`}>
                        ⚖️ NIE {lessonRef(`nie-${n.chapter}`)?.lesson.title} {n.first && <span className="text-xs text-emerald-600">(empieza)</span>}
                      </Link>
                      <span className="ml-1 text-xs text-slate-500">
                        {n.steps.map((c) => CIRCLED[c.step - 1]).join('')} · {n.steps.reduce((a, c) => a + c.minutes, 0)}′
                      </span>
                    </li>
                  ))}
                  {p.events.map((e, i) => (
                    <li key={i} className={e.type === 'exam' || e.type === 'mock' || e.type === 'cumulativeTest' ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}>
                      • {e.label}
                    </li>
                  ))}
                  <li className="text-xs text-slate-500">{p.workouts.map((w) => w.label).join(' · ')}</li>
                </ul>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
