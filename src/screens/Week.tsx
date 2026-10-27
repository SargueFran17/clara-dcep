import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { usePlan, useSettings, useToday } from '../lib/hooks'
import { addDays, dayName, diffDays, eachDay, fmtShort, fmtUK, startOfWeek, weekday } from '../lib/dates'
import { PHASE_LABELS } from '../lib/planner'
import { Card, PageHeader, ProgressBar } from '../components/ui'
import { DayTasks } from '../components/DayTasks'
import { CalendarTabs } from '../components/CalendarTabs'
import { NoteField, Rating } from '../components/NoteField'
import { arranque } from '../lib/content'

const hours = (min: number) => (min / 60).toLocaleString('es-ES', { maximumFractionDigits: 1 })

/** Nº de semana del plan (S01 = la semana del arranque). */
export function weekNumber(monday: string, firstDay: string): number {
  return Math.floor(diffDays(monday, startOfWeek(firstDay)) / 7) + 1
}

export function Week() {
  const today = useToday()
  const s = useSettings()
  const [params] = useSearchParams()
  const from = params.get('d')
  const [offset, setOffset] = useState(from ? Math.round(diffDays(startOfWeek(from), startOfWeek(today)) / 7) : 0)
  const monday = addDays(startOfWeek(today), offset * 7)
  const sunday = addDays(monday, 6)
  const days = eachDay(monday, sunday)
  const plan = usePlan()
  const sessions = useLiveQuery(() => db.studySessions.where('date').between(monday, sunday, true, true).toArray(), [monday])
  const checked = useLiveQuery(() => db.taskDone.where('date').between(monday, sunday, true, true).toArray(), [monday])
  const logs = useLiveQuery(() => db.dayLog.where('date').between(monday, sunday, true, true).toArray(), [monday])

  const minutesOn = (d: string) => (sessions ?? []).filter((x) => x.date === d).reduce((a, x) => a + x.minutes, 0)
  const target = days.reduce((a, d) => a + (plan.days.get(d)?.targetMin ?? 0), 0)
  const real = days.reduce((a, d) => a + minutesOn(d), 0)
  const plannedWorkouts = days.reduce((a, d) => a + (plan.days.get(d)?.workouts.filter((w) => w.type !== 'rest').length ?? 0), 0)
  const doneWorkouts = (checked ?? []).filter((c) => c.key.startsWith('workout:') && !c.key.endsWith(':rest')).length
  const first = arranque.days[0]?.date ?? s.studyStart
  const n = weekNumber(monday, first < s.studyStart ? first : s.studyStart)
  const phase = plan.days.get(monday)?.phase ?? plan.days.get(sunday)?.phase
  const noteId = `w:${monday}`

  return (
    <div>
      <CalendarTabs />
      <PageHeader
        title={n > 0 ? `Semana ${String(n).padStart(2, '0')}` : 'Semana'}
        subtitle={`${fmtUK(monday)} – ${fmtUK(sunday)}${phase ? ` · ${PHASE_LABELS[phase]}` : ''}`}
        right={
          <div className="flex gap-1">
            <button className="rounded-full px-3 py-1 hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => setOffset(offset - 1)} aria-label="Semana anterior">‹</button>
            {offset !== 0 && <button className="rounded-full px-2 py-1 text-xs hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => setOffset(0)}>hoy</button>}
            <button className="rounded-full px-3 py-1 hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => setOffset(offset + 1)} aria-label="Semana siguiente">›</button>
          </div>
        }
      />

      <Card className="mb-4 space-y-3">
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
        <NoteField id={noteId} field="goal" label="🎯 Mi objetivo de la semana" placeholder="p. ej. terminar el módulo M2 y hacer 3 entrenos" />
      </Card>

      <div className="space-y-3">
        {days.map((d) => {
          const p = plan.days.get(d)
          const isToday = d === today
          const log = logs?.find((l) => l.date === d)
          const pct = log?.total ? Math.round((log.done / log.total) * 100) : undefined
          return (
            <Card key={d} className={isToday ? 'ring-2 ring-indigo-400' : ''}>
              <Link to={isToday ? '/' : `/dia/${d}`} className="mb-2 flex items-baseline justify-between gap-2">
                <div className="font-semibold first-letter:uppercase">
                  {dayName(d)} {fmtShort(d)} {isToday && <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">hoy</span>}
                </div>
                <div className="shrink-0 text-xs text-slate-500">
                  {p?.targetMin ? `${minutesOn(d)}/${p.targetMin}′` : ''}
                  {pct !== undefined && <span className={pct >= s.streakThreshold * 100 ? ' text-emerald-600' : ''}> · {pct} % hecho</span>} →
                </div>
              </Link>
              <DayTasks date={d} compact />
            </Card>
          )
        })}
      </div>

      <Card className="mt-4 space-y-3">
        <h2 className="font-semibold">📝 Revisión del domingo</h2>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-500">¿Cómo ha ido la semana? (1–5)</div>
          <Rating id={noteId} />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Estudio: {hours(real)} de {hours(target)} h · Entrenos: {doneWorkouts}/{plannedWorkouts}
          {weekday(today) === 6 && offset === 0 && ' · ¡hoy toca revisar y planificar la semana que viene!'}
        </p>
        <NoteField id={noteId} field="review" label="Qué ha ido bien / qué ajusto" rows={3} />
      </Card>
    </div>
  )
}
