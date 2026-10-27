import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { usePlan, useToday } from '../lib/hooks'
import { setTaskDone } from '../lib/actions'
import { addDays, eachDay, fmtShort, fmtUK, startOfWeek, weekday } from '../lib/dates'
import { fitnessWeek } from '../lib/content'
import { BLEEP_TARGET_LEVEL, bleepReached, bleepScore, rateAdvice, weeklyLossRate } from '../lib/fitness'
import { Button, Card, Empty, PageHeader, Pill, ProgressBar } from '../components/ui'
import type { Habit } from '../types'

const input = 'w-full rounded-xl border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900'
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const AXIS = { fontSize: 11, fill: 'currentColor' }
const TOOLTIP = { contentStyle: { borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 12, color: '#0f172a' } }

const ADVICE = {
  tooFast: { tone: 'red' as const, text: 'Vas más rápido de lo recomendado (más de 1 kg/semana). Come algo más y consulta al GP.' },
  good: { tone: 'green' as const, text: 'Ritmo saludable (0,5–1 kg/semana, como recomienda el NHS).' },
  stable: { tone: 'slate' as const, text: 'Peso estable. Está bien: la constancia en el entreno es lo que cuenta para el test.' },
  gaining: { tone: 'amber' as const, text: 'Ligera subida. Revisa sueño y comidas de los días de academia, sin agobios.' },
  unknown: { tone: 'slate' as const, text: 'Registra el peso una vez por semana (mismo día y hora) para ver la tendencia.' },
}

export function Fitness() {
  const today = useToday()
  const plan = usePlan()
  const monday = startOfWeek(today)
  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray(), [])
  const bleeps = useLiveQuery(() => db.bleepLevels.orderBy('date').toArray(), [])
  const habit = useLiveQuery(async () => ({ v: await db.habits.get(today) }), [today])
  const habitWeek = useLiveQuery(() => db.habits.where('date').between(monday, addDays(monday, 6), true, true).toArray(), [monday])
  const checked = useLiveQuery(() => db.taskDone.where('date').between(addDays(monday, -21), addDays(monday, 6), true, true).toArray(), [monday])

  const [kg, setKg] = useState('')
  const [bl, setBl] = useState({ level: '', shuttle: '' })

  const slept = (habitWeek ?? []).filter((h) => h.sleepHours !== undefined)
  const avgSleep = slept.length ? slept.reduce((a, h) => a + h.sleepHours!, 0) / slept.length : null
  const rate = weeklyLossRate(weights ?? [], today)
  const advice = ADVICE[rateAdvice(rate)]
  const bestBleep = [...(bleeps ?? [])].sort((a, b) => bleepScore(b) - bleepScore(a))[0]

  // entrenos hechos vs planificados (últimas 4 semanas)
  const weeks = [-3, -2, -1, 0].map((w) => {
    const from = addDays(monday, w * 7)
    const days = eachDay(from, addDays(from, 6))
    const planned = days.reduce((a, d) => a + (plan.days.get(d)?.workouts ?? fitnessWeek.find((x) => x.day === weekday(d))?.items ?? []).filter((x) => x.type !== 'rest').length, 0)
    const done = (checked ?? []).filter((c) => c.date >= from && c.date <= addDays(from, 6) && c.key.startsWith('workout:') && !c.key.endsWith(':rest'))
    return { from, planned, done: done.length, tennis: done.filter((c) => c.key.endsWith(':tennis')).length }
  })

  async function saveHabit(patch: Partial<Habit>) {
    const h = { ...(habit?.v ?? { date: today }), ...patch, date: today }
    await db.habits.put(h)
    if (h.meals && h.waterLitres !== undefined && h.sleepHours !== undefined) await setTaskDone(today, 'habits', true)
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Fitness y peso" subtitle="Objetivo: bleep 5.4 y perder peso de forma saludable" back="/carpetas/fitness" />

      <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-sm">
          🩺 <b>Antes de cambios grandes en dieta o entreno, consulta a tu GP</b> (médico de cabecera del NHS). Aquí no hay dietas extremas ni contador de calorías:
          solo hábitos sostenibles y un ritmo moderado.
        </p>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Hábitos de hoy</h2>
        <div className="space-y-3 text-sm">
          <div>
            <div className="mb-1 text-slate-500">¿Plan de comidas cumplido?</div>
            <div className="flex gap-2">
              {([['yes', 'Sí'], ['partial', 'A medias'], ['no', 'No']] as const).map(([v, l]) => (
                <Button key={v} variant={habit?.v?.meals === v ? 'primary' : 'ghost'} onClick={() => saveHabit({ meals: v })}>{l}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="text-slate-500">Agua (litros)</span>
              <input type="number" step="0.25" min="0" className={input} defaultValue={habit?.v?.waterLitres} key={`w${habit?.v?.date}`} onBlur={(e) => e.target.value && saveHabit({ waterLitres: +e.target.value })} />
            </label>
            <label>
              <span className="text-slate-500">Sueño (horas)</span>
              <input type="number" step="0.5" min="0" className={input} defaultValue={habit?.v?.sleepHours} key={`s${habit?.v?.date}`} onBlur={(e) => e.target.value && saveHabit({ sleepHours: +e.target.value })} />
            </label>
          </div>
          <p className="text-xs text-slate-500">
            Esta semana: comidas cumplidas {habitWeek?.filter((h) => h.meals === 'yes').length ?? 0}/7 · sueño medio{' '}
            {avgSleep === null ? '–' : `${avgSleep.toLocaleString('es-ES', { maximumFractionDigits: 1 })} h`}
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Plan semanal</h2>
        <ul className="space-y-1 text-sm">
          {fitnessWeek.map((d) => (
            <li key={d.day} className={`flex justify-between gap-2 rounded-lg px-2 py-1 ${d.day === weekday(today) ? 'bg-sky-100 font-semibold dark:bg-sky-900/40' : ''}`}>
              <span className="w-20 shrink-0 text-slate-500">{DAYS[d.day]}</span>
              <span className="text-right">{d.items.map((i) => i.label).join(' + ')}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">Los entrenos se marcan como hechos desde Hoy.</p>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {weeks.map((w) => (
            <div key={w.from} className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
              <div className="text-[10px] text-slate-500">sem. {fmtShort(w.from)}</div>
              <div className="font-bold">{w.done}/{w.planned}</div>
              <div className="text-[10px] text-slate-500">🎾 {w.tennis}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Peso semanal</h2>
        <Pill tone={advice.tone}>{rate === null ? 'Sin tendencia aún' : `${rate > 0 ? '−' : '+'}${Math.abs(rate).toLocaleString('es-ES')} kg/semana (últimas 4 semanas)`}</Pill>
        <p className="mt-2 text-sm">{advice.text}</p>
        {(weights?.length ?? 0) > 1 && (
          <div className="mt-3 h-44 text-slate-500">
            <ResponsiveContainer>
              <LineChart data={weights!.map((w) => ({ date: fmtShort(w.date), kg: w.kg }))} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.15} />
                <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip {...TOOLTIP} formatter={(v) => [`${v} kg`, 'Peso']} />
                <Line type="monotone" dataKey="kg" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <input type="number" step="0.1" className={input} placeholder="kg (p. ej. 68.4)" value={kg} onChange={(e) => setKg(e.target.value)} />
          <Button disabled={!kg} onClick={async () => { await db.weights.add({ date: today, kg: +kg }); setKg('') }}>Guardar</Button>
        </div>
        {weights?.length ? (
          <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
            {[...weights].reverse().slice(0, 4).map((w) => (
              <li key={w.id} className="flex justify-between">
                <span>{fmtUK(w.date)} · {w.kg} kg</span>
                <button className="text-rose-600" onClick={() => db.weights.delete(w.id!)}>borrar</button>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Bleep test (15 m MSFT)</h2>
        <p className="text-sm text-slate-500">
          Objetivo: nivel {BLEEP_TARGET_LEVEL.level}.{BLEEP_TARGET_LEVEL.shuttle} (estándar nacional; ⚠ confírmalo con Hampshire).
        </p>
        {bestBleep && (
          <div className="mt-2">
            <div className="flex justify-between text-sm">
              <span>Mejor marca: <b>{bestBleep.level}.{bestBleep.shuttle}</b></span>
              {bleepReached(bestBleep) ? <Pill tone="green">¡Objetivo conseguido!</Pill> : <Pill tone="amber">En camino</Pill>}
            </div>
            <ProgressBar pct={Math.min(100, (bleepScore(bestBleep) / bleepScore(BLEEP_TARGET_LEVEL)) * 100)} color="sky" className="mt-1" />
          </div>
        )}
        {(bleeps?.length ?? 0) > 1 && (
          <div className="mt-3 h-40 text-slate-500">
            <ResponsiveContainer>
              <LineChart data={bleeps!.map((b) => ({ date: fmtShort(b.date), nivel: +bleepScore(b).toFixed(2), label: `${b.level}.${b.shuttle}` }))} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.15} />
                <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 'dataMax + 1']} tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip {...TOOLTIP} formatter={(_v, _n, item) => [item.payload.label, 'Nivel']} />
                <ReferenceLine y={bleepScore(BLEEP_TARGET_LEVEL)} stroke="#e11d48" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="nivel" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <input type="number" min="1" className={input} placeholder="Nivel" value={bl.level} onChange={(e) => setBl({ ...bl, level: e.target.value })} />
          <input type="number" min="0" className={input} placeholder="Shuttle" value={bl.shuttle} onChange={(e) => setBl({ ...bl, shuttle: e.target.value })} />
          <Button disabled={!bl.level || bl.shuttle === ''} onClick={async () => { await db.bleepLevels.add({ date: today, level: +bl.level, shuttle: +bl.shuttle }); setBl({ level: '', shuttle: '' }) }}>Guardar</Button>
        </div>
        {!bleeps?.length && <Empty>Haz un bleep test de prueba para tener tu punto de partida.</Empty>}
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Lecciones</h2>
        <div className="grid grid-cols-2 gap-2">
          <Link to="/asignatura/ft-nut" className="rounded-xl bg-slate-100 p-3 text-sm font-semibold dark:bg-slate-800">🥗 Nutrición y hábitos</Link>
          <Link to="/asignatura/ft-train" className="rounded-xl bg-slate-100 p-3 text-sm font-semibold dark:bg-slate-800">🏃 Entrenamiento</Link>
        </div>
      </Card>
    </div>
  )
}
