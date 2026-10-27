import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db'
import { structure } from '../lib/content'
import { useDoneLessons, useToday } from '../lib/hooks'
import { folderProgress, globalProgress, chapterStatus, CHAPTER_STATUS_LABEL } from '../lib/progress'
import { addDays, fmtShort, startOfWeek } from '../lib/dates'
import { PASS_MARK } from '../lib/defaults'
import { ERROR_TYPES } from '../lib/errors'
import { Card, Empty, PageHeader, ProgressBar } from '../components/ui'
import type { ChapterStatus } from '../types'

const AXIS = { fontSize: 11, fill: 'currentColor' }
const TOOLTIP = {
  contentStyle: { borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 12, color: '#0f172a' },
  cursor: { fill: 'rgba(99,102,241,0.08)' },
}

export function Progress() {
  const done = useDoneLessons()
  const today = useToday()
  const g = globalProgress(structure.folders, done)
  const sessions = useLiveQuery(() => db.studySessions.toArray(), [])
  const chapters = useLiveQuery(() => db.nieChapter.toArray(), [])
  const reviews = useLiveQuery(() => db.reviews.where('itemKey').startsWith('lesson:nie-').toArray(), [])
  const tests = useLiveQuery(() => db.testAttempts.orderBy('date').toArray(), [])
  const errors = useLiveQuery(() => db.errors.toArray(), [])

  // horas por semana (últimas 8)
  const thisMonday = startOfWeek(today)
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisMonday, (i - 7) * 7))
  const weekly = weeks.map((w) => ({
    week: fmtShort(w),
    horas: +((sessions ?? []).filter((s) => s.date >= w && s.date <= addDays(w, 6)).reduce((a, s) => a + s.minutes, 0) / 60).toFixed(1),
  }))
  const totalHours = ((sessions ?? []).reduce((a, s) => a + s.minutes, 0) / 60).toLocaleString('es-ES', { maximumFractionDigits: 1 })

  // capítulos NIE por estado
  const nieChapters = structure.folders.find((f) => f.id === 'nie')!.subjects.filter((s) => s.nie).flatMap((s) => s.lessons)
  const stateById = new Map((chapters ?? []).map((c) => [c.chapterId, c]))
  const counts: Record<ChapterStatus, number> = { pending: 0, inProgress: 0, studied: 0, reviewing: 0, final: 0 }
  for (const l of nieChapters) {
    const reviewsDone = (reviews ?? []).filter((r) => r.itemKey === `lesson:${l.id}` && r.doneAt).length
    counts[chapterStatus(stateById.get(l.code), reviewsDone, done.has(l.id)).status]++
  }

  const testData = (tests ?? []).map((t) => ({ date: fmtShort(t.date), pct: Math.round((t.correct / t.total) * 100), kind: t.kind }))
  const errorData = ERROR_TYPES.map((e) => ({ tipo: e.short, n: (errors ?? []).filter((x) => x.type === e.id).length }))

  return (
    <div className="space-y-4">
      <PageHeader title="Progreso" />

      <Card>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm text-slate-500">Progreso global</div>
            <div className="text-4xl font-bold">{g.pct}%</div>
          </div>
          <div className="text-right text-sm text-slate-500">
            {g.done}/{g.total} lecciones
            <br />
            {totalHours} h estudiadas
          </div>
        </div>
        <ProgressBar pct={g.pct} className="mt-3" />
        <div className="mt-4 space-y-3">
          {structure.folders.map((f) => {
            const p = folderProgress(f, done)
            return (
              <Link key={f.id} to={`/carpetas/${f.id}`} className="block">
                <div className="flex justify-between text-sm">
                  <span>{f.emoji} {f.name}</span>
                  <span className="font-semibold">{p.pct}%</span>
                </div>
                <ProgressBar pct={p.pct} color={f.color} className="mt-1" />
              </Link>
            )
          })}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Capítulos NIE por estado</h2>
        <div className="grid grid-cols-5 gap-2 text-center">
          {(Object.keys(counts) as ChapterStatus[]).map((k) => (
            <div key={k} className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
              <div className="text-xl font-bold">{counts[k]}</div>
              <div className="text-[10px] leading-tight text-slate-500">{CHAPTER_STATUS_LABEL[k]}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Horas por semana</h2>
        <p className="mb-2 text-xs text-slate-500">Últimas 8 semanas (lunes de cada semana)</p>
        <div className="h-48 text-slate-500">
          <ResponsiveContainer>
            <BarChart data={weekly} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.15} />
              <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip {...TOOLTIP} formatter={(v) => [`${v} h`, 'Horas']} />
              <Bar dataKey="horas" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Evolución de los tests</h2>
        <p className="mb-2 text-xs text-slate-500">% de aciertos · línea discontinua = aprobado NIE ({PASS_MARK.toLocaleString('es-ES')} %)</p>
        {testData.length ? (
          <div className="h-48 text-slate-500">
            <ResponsiveContainer>
              <LineChart data={testData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.15} />
                <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip {...TOOLTIP} formatter={(v) => [`${v} %`, 'Aciertos']} />
                <ReferenceLine y={PASS_MARK} stroke="#e11d48" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="pct" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty>Aún no hay tests. Los mini-tests y simulacros llegan en la Fase 2.</Empty>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Errores por tipo</h2>
        {(errors ?? []).length ? (
          <div className="h-56 text-slate-500">
            <ResponsiveContainer>
              <BarChart data={errorData} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="tipo" tick={AXIS} tickLine={false} axisLine={false} width={110} />
                <Tooltip {...TOOLTIP} formatter={(v) => [v, 'Errores']} />
                <Bar dataKey="n" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty>Sin errores registrados todavía.</Empty>
        )}
      </Card>
    </div>
  )
}
