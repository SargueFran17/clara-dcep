import { useNieSchedule, useSettings } from '../lib/hooks'
import { nieMargin } from '../lib/scheduler'
import { fmtUK } from '../lib/dates'

/** "Al ritmo actual terminas la 1ª vuelta el … · N días de margen" (verde) o "Vas N días tarde" (rojo). */
export function NieMargin() {
  const s = useSettings()
  const schedule = useNieSchedule()
  if (!schedule) return null
  const m = nieMargin(schedule, s)
  if (!m.finish)
    return <div className="rounded-2xl bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">✓ 1ª vuelta del NIE terminada</div>
  const late = m.days < 0
  return (
    <div className={`rounded-2xl px-3 py-2 text-sm font-medium ${late ? 'bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200' : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'}`}>
      {late
        ? `Vas ${-m.days} día${m.days === -1 ? '' : 's'} tarde: al ritmo actual terminas la 1ª vuelta el ${fmtUK(m.finish)} (fin de la academia ${fmtUK(s.academyEnd)})`
        : `Al ritmo actual terminas la 1ª vuelta el ${fmtUK(m.finish)} · ${m.days} día${m.days === 1 ? '' : 's'} de margen`}
    </div>
  )
}
