import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { usePlan, useSettings, useToday } from '../lib/hooks'
import { fmtShort } from '../lib/dates'
import { PHASE_LABELS, type Phase } from '../lib/planner'
import { addMonthsYM, daySummary, monthGrid, MONTHS, PHASE_TINT } from '../lib/month'
import { Card, PageHeader } from '../components/ui'
import { CalendarTabs } from '../components/CalendarTabs'
import { NoteField } from '../components/NoteField'

const LEGEND: Phase[] = ['pre', 'xmas', 'academy', 'nieBlock', 'final', 'exam']

/** Calendario del mes: lo principal de cada día; toca un día para verlo entero. */
export function Month() {
  const today = useToday()
  const s = useSettings()
  const plan = usePlan()
  const [ym, setYm] = useState(today.slice(0, 7))
  const grid = monthGrid(ym)
  const logs = useLiveQuery(() => db.dayLog.where('date').between(grid[0], grid[grid.length - 1], true, true).toArray(), [ym])
  const [y, m] = ym.split('-').map(Number)
  const inMonth = (d: string) => d.startsWith(ym)
  const milestones = grid
    .filter(inMonth)
    .flatMap((d) => (plan.days.get(d)?.events ?? []).filter((e) => ['cumulativeTest', 'mock', 'exam', 'finalGroup'].includes(e.type)).map((e) => ({ d, e })))
  const keyDates: [string, string][] = (
    [
      [s.studyStart, 'Empiezas la pre-academia'],
      [s.xmasStart, 'Navidad (ligero)'],
      [s.academyStart, '¡Empieza la academia!'],
      [s.nieStart, 'Empieza el NIE (1ª vuelta)'],
      [s.nieBlockStart, 'Bloque NIE'],
      [s.finalReviewStart, 'Repaso final'],
    ] as [string, string][]
  ).filter(([d]) => inMonth(d))

  return (
    <div>
      <CalendarTabs />
      <PageHeader
        title={`${MONTHS[m - 1]} ${y}`}
        right={
          <div className="flex gap-1">
            <button className="rounded-full px-3 py-1 hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => setYm(addMonthsYM(ym, -1))} aria-label="Mes anterior">‹</button>
            {ym !== today.slice(0, 7) && <button className="rounded-full px-2 py-1 text-xs hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => setYm(today.slice(0, 7))}>hoy</button>}
            <button className="rounded-full px-3 py-1 hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => setYm(addMonthsYM(ym, 1))} aria-label="Mes siguiente">›</button>
          </div>
        }
      />

      <Card className="mb-3">
        <NoteField id={`m:${ym}`} field="goal" label="🎯 Objetivo del mes" />
      </Card>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-semibold text-slate-500">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {grid.map((d) => {
          const p = plan.days.get(d)
          const log = logs?.find((l) => l.date === d)
          const ok = log?.total ? log.done / log.total >= s.streakThreshold : false
          const lines = daySummary(p)
          return (
            <Link
              key={d}
              to={d === today ? '/' : `/dia/${d}`}
              className={`min-h-20 overflow-hidden rounded-lg p-1 text-left ${p ? PHASE_TINT[p.phase] : 'bg-slate-50 dark:bg-slate-900'} ${inMonth(d) ? '' : 'opacity-40'} ${d === today ? 'ring-2 ring-indigo-500' : ''}`}
            >
              <div className="flex items-center justify-between text-xs font-bold">
                <span>{Number(d.slice(8))}</span>
                {ok && <span className="text-emerald-600">✓</span>}
              </div>
              {lines.map((l, i) => (
                <div key={i} className="truncate text-[10px] leading-snug text-slate-700 dark:text-slate-300">{l}</div>
              ))}
            </Link>
          )
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
        {LEGEND.map((ph) => (
          <span key={ph} className={`rounded-full px-2 py-0.5 ${PHASE_TINT[ph]}`}>{PHASE_LABELS[ph]}</span>
        ))}
        <span className="rounded-full px-2 py-0.5 text-emerald-600">✓ día cumplido</span>
      </div>

      {(keyDates.length > 0 || milestones.length > 0) && (
        <Card className="mt-4">
          <h2 className="mb-2 font-semibold">📌 Este mes</h2>
          <ul className="space-y-1 text-sm">
            {keyDates.map(([d, label]) => <li key={d + label}><b>{fmtShort(d)}</b> · {label}</li>)}
            {milestones.map(({ d, e }, i) => (
              <li key={i} className={e.type === 'exam' || e.type === 'mock' ? 'text-rose-600 dark:text-rose-400' : ''}><b>{fmtShort(d)}</b> · {e.label}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-4">
        <NoteField id={`m:${ym}`} field="review" label="📝 Balance del mes (escríbelo el último día)" rows={3} />
      </Card>
    </div>
  )
}
