import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { nieChapters, nieTemario } from '../lib/content'
import { useDoneLessons, useToday } from '../lib/hooks'
import { chapterStatus } from '../lib/progress'
import { Card, ProgressBar } from './ui'
import { NieMargin } from './NieMargin'

/** Progreso del temario NIE: total, por parte, pasos, repasos y margen. */
export function NieProgress({ compact = false }: { compact?: boolean }) {
  const done = useDoneLessons()
  const today = useToday()
  const states = useLiveQuery(() => db.nieChapter.toArray(), [])
  const reviews = useLiveQuery(() => db.reviews.where('itemKey').startsWith('lesson:nie-').toArray(), [])
  if (!states || !reviews) return null
  const byId = new Map(states.map((x) => [x.chapterId, x]))
  const status = (code: string) =>
    chapterStatus(byId.get(code), reviews.filter((r) => r.itemKey === `lesson:nie-${code}` && r.doneAt).length, done.has(`nie-${code}`)).status
  const studied = (code: string) => ['studied', 'reviewing', 'final'].includes(status(code))
  const total = nieChapters.length
  const nStudied = nieChapters.filter((c) => studied(c.code)).length
  const nFinal = nieChapters.filter((c) => status(c.code) === 'final').length
  const steps = states.reduce((a, x) => a + x.steps.filter(Boolean).length, 0)
  const doneMin = nieChapters.reduce((a, c) => {
    const st = byId.get(c.code)
    if (!st) return a
    const full = c.stepMinutes.reduce((x, m, i) => x + (st.steps[i] ? m : 0), 0)
    const part = (st.partial ?? []).filter((p) => !st.steps[p.step - 1]).reduce((x, p) => x + p.minutes, 0)
    return a + full + part
  }, 0)
  const totalMin = nieChapters.reduce((a, c) => a + c.stepMinutes.reduce((x, m) => x + m, 0), 0)
  const pending = reviews.filter((r) => !r.doneAt)
  const overdue = pending.filter((r) => r.due < today).length
  const reviewsDone = reviews.filter((r) => r.doneAt).length
  const pct = Math.round((doneMin / totalMin) * 100)

  return (
    <Card>
      <div className="mb-1 flex items-baseline justify-between">
        <Link to="/nie/capitulos" className="font-semibold hover:text-rose-600">⚖️ Temario NIE</Link>
        <span className="text-sm text-slate-500">{pct} % del estudio</span>
      </div>
      <ProgressBar pct={pct} color="rose" />
      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50"><div className="text-lg font-bold">{nStudied}/{total}</div>estudiados</div>
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50"><div className="text-lg font-bold">{steps}/{total * 10}</div>pasos</div>
        <Link to="/nie/repasos" className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50">
          <div className={`text-lg font-bold ${overdue ? 'text-rose-600' : ''}`}>{reviewsDone}</div>repasos hechos{overdue ? ` · ${overdue} atrasados` : ''}
        </Link>
      </div>
      {!compact && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {Object.entries(nieTemario.parts).map(([part, name]) => {
            const inPart = nieChapters.filter((c) => String(c.part) === part)
            const n = inPart.filter((c) => studied(c.code)).length
            return (
              <div key={part} title={name}>
                <div className="flex justify-between text-xs"><span className="font-semibold">Parte {part}</span><span className="text-slate-500">{n}/{inPart.length}</span></div>
                <ProgressBar pct={(n / inPart.length) * 100} color="indigo" className="mt-1" />
              </div>
            )
          })}
        </div>
      )}
      {!compact && <p className="mt-2 text-xs text-slate-500">Repaso final ✓: {nFinal}/{total} · {Math.round(doneMin / 60)} h de {Math.round(totalMin / 60)} h estimadas</p>}
      <div className="mt-3"><NieMargin /></div>
    </Card>
  )
}
