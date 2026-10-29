import { Link, useParams } from 'react-router-dom'
import { usePlan, useToday } from '../lib/hooks'
import { fmtLong, fmtUK, startOfWeek } from '../lib/dates'
import { PHASE_LABELS } from '../lib/planner'
import { Card, PageHeader } from '../components/ui'
import { DayTasks } from '../components/DayTasks'

/** Un día cualquiera del plan, con todo lo que toca. */
export function Day() {
  const { date = '' } = useParams()
  const today = useToday()
  const plan = usePlan()
  const p = plan.days.get(date)
  return (
    <div className="space-y-4">
      <PageHeader title={fmtLong(date)} subtitle={`${fmtUK(date)}${p ? ` · ${PHASE_LABELS[p.phase]} · objetivo ${p.targetMin}′` : ''}`} back />
      {date === today && (
        <Link to="/" className="block rounded-2xl bg-indigo-600 p-3 text-center font-semibold text-white">Es hoy: ir a Hoy →</Link>
      )}
      {date > today && (
        <p className="text-sm text-slate-500">
          Plan previsto. Puedes <b>adelantar</b>: lo que marques de estudio cuenta como hecho hoy (y sus repasos salen desde hoy). Lo del NIE se recoloca solo.
        </p>
      )}
      <Card>
        <DayTasks date={date} />
      </Card>
      <Link to={`/semana?d=${date}`} className="block text-center text-sm font-semibold text-indigo-600">Ver la semana del {fmtUK(startOfWeek(date))} →</Link>
    </div>
  )
}
