import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useToday } from '../lib/hooks'
import { saveAcademyDay } from '../lib/actions'
import { addDays, eachDay, fmtLong, fmtShort, fmtUK, startOfWeek } from '../lib/dates'
import { Button, Card, Empty, PageHeader, Pill } from '../components/ui'
import type { AcademyDay } from '../types'

const input = 'w-full rounded-xl border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900'
const TABS = [
  { id: 'diario', label: 'Diario' },
  { id: 'modulos', label: 'Módulos' },
  { id: 'evaluaciones', label: 'Evaluaciones' },
  { id: 'resumen', label: 'Resumen semanal' },
] as const

export function Academy() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'diario'
  return (
    <div>
      <PageHeader title="Academia" subtitle="Diario de cada día de curso, módulos y evaluaciones" back="/carpetas/academy" />
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setParams({ tab: t.id })} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${tab === t.id ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'diario' && <DiaryList />}
      {tab === 'modulos' && <Modules />}
      {tab === 'evaluaciones' && <Assessments />}
      {tab === 'resumen' && <WeeklySummary />}
    </div>
  )
}

function DiaryList() {
  const today = useToday()
  const days = useLiveQuery(() => db.academyDays.orderBy('date').reverse().toArray(), [])
  const modules = useLiveQuery(() => db.academyModules.toArray(), [])
  return (
    <div className="space-y-2">
      <Link to={`/academia/dia/${today}`} className="block rounded-2xl bg-amber-500 p-4 font-semibold text-white">📓 Diario de hoy ({fmtShort(today)}) →</Link>
      {days?.map((d) => (
        <Link key={d.date} to={`/academia/dia/${d.date}`} className="block rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm font-semibold first-letter:uppercase">{fmtLong(d.date)}</div>
          <div className="text-xs text-slate-500">
            {modules?.find((m) => m.id === d.moduleId)?.name ?? 'Sin módulo'}{d.topic ? ` · ${d.topic}` : ''} · {d.keyIdeas?.filter(Boolean).length ?? 0} ideas clave
          </div>
        </Link>
      ))}
      {!days?.length && <Empty>Todavía no hay días. Empieza el {fmtUK('2026-12-29')} 💪</Empty>}
    </div>
  )
}

/** Una entrada del diario: /academia/dia/aaaa-mm-dd */
export function AcademyDayView() {
  const { date = '' } = useParams()
  const modules = useLiveQuery(() => db.academyModules.orderBy('order').toArray(), [])
  const cards = useLiveQuery(() => db.userCards.where('academyDate').equals(date).toArray(), [date])
  const reviews = useLiveQuery(() => db.reviews.where('itemKey').equals(`academy:${date}`).toArray(), [date])
  const [day, setDay] = useState<AcademyDay | null>(null)
  const [saved, setSaved] = useState(false)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')

  // carga inicial: se envuelve en { v } porque useLiveQuery devuelve undefined mientras carga
  const loaded = useLiveQuery(async () => ({ v: await db.academyDays.get(date) }), [date])
  useEffect(() => {
    if (loaded && !day) setDay(loaded.v ?? { date, keyIdeas: ['', '', '', '', ''] })
  }, [loaded, day, date])

  if (!day) return <PageHeader title="Diario" back />
  const set = (patch: Partial<AcademyDay>) => {
    setDay({ ...day, ...patch })
    setSaved(false)
  }
  async function save() {
    await saveAcademyDay(day!)
    setSaved(true)
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`Diario · ${fmtUK(date)}`} subtitle={<span className="first-letter:uppercase">{fmtLong(date)}</span>} back="/academia" />
      {reviews?.length ? (
        <div className="flex flex-wrap gap-1">
          {reviews.map((r) => <Pill key={r.id} tone={r.doneAt ? 'green' : 'amber'}>Repaso {r.step === 1 ? '+1 día' : '+7 días'} {fmtShort(r.due)} {r.doneAt ? '✓' : ''}</Pill>)}
        </div>
      ) : null}
      <Card className="space-y-3">
        <label className="block text-sm">
          <span className="text-slate-500">Módulo</span>
          <select className={input} value={day.moduleId ?? ''} onChange={(e) => set({ moduleId: e.target.value ? +e.target.value : undefined })}>
            <option value="">— Sin módulo —</option>
            {modules?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {!modules?.length && <Link to="/academia?tab=modulos" className="text-xs text-indigo-600">Añade los módulos de tu curso →</Link>}
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">Tema del día</span>
          <input className={input} value={day.topic ?? ''} onChange={(e) => set({ topic: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">Mis apuntes</span>
          <textarea className={input} rows={8} value={day.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
        </label>
        <div className="text-sm">
          <span className="text-slate-500">5 ideas clave (con mis palabras)</span>
          {[0, 1, 2, 3, 4].map((k) => (
            <input key={k} className={`${input} mt-1`} placeholder={`${k + 1}.`} value={day.keyIdeas?.[k] ?? ''} onChange={(e) => set({ keyIdeas: [0, 1, 2, 3, 4].map((j) => (j === k ? e.target.value : day.keyIdeas?.[j] ?? '')) })} />
          ))}
        </div>
        <label className="block text-sm">
          <span className="text-slate-500">Dudas para preguntar</span>
          <textarea className={input} rows={3} value={day.questions ?? ''} onChange={(e) => set({ questions: e.target.value })} />
        </label>
        <Button onClick={save} className="w-full py-3">{saved ? 'Guardado ✓' : 'Guardar (programa repasos +1 día y +7 días)'}</Button>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Flashcards de hoy ({cards?.length ?? 0})</h2>
        <ul className="mb-3 space-y-1 text-sm">
          {cards?.map((c) => (
            <li key={c.id} className="flex justify-between gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/50">
              <span><b>{c.front}</b> — {c.back}</span>
              <button className="text-xs text-rose-600" onClick={() => db.userCards.delete(c.id!)}>✕</button>
            </li>
          ))}
        </ul>
        <input className={input} placeholder="Pregunta / término" value={front} onChange={(e) => setFront(e.target.value)} />
        <input className={`${input} mt-1`} placeholder="Respuesta" value={back} onChange={(e) => setBack(e.target.value)} />
        <Button
          variant="ghost"
          className="mt-2"
          disabled={!front.trim() || !back.trim()}
          onClick={async () => {
            await db.userCards.add({ subjectId: 'academy', academyDate: date, academyModuleId: day.moduleId, front: front.trim(), back: back.trim() })
            setFront('')
            setBack('')
          }}
        >
          + Añadir flashcard
        </Button>
      </Card>
    </div>
  )
}

function Modules() {
  const modules = useLiveQuery(() => db.academyModules.orderBy('order').toArray(), [])
  const days = useLiveQuery(() => db.academyDays.toArray(), [])
  const [name, setName] = useState('')
  const navigate = useNavigate()

  async function move(i: number, dir: -1 | 1) {
    const a = modules![i]
    const b = modules![i + dir]
    if (!b) return
    await db.transaction('rw', db.academyModules, async () => {
      await db.academyModules.update(a.id!, { order: b.order })
      await db.academyModules.update(b.id!, { order: a.order })
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Todavía no tienes el temario oficial: añade los módulos a medida que los conozcas.</p>
      <div className="flex gap-2">
        <input className={input} placeholder="Nombre del módulo (p. ej. Custody)" value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          disabled={!name.trim()}
          onClick={async () => {
            await db.academyModules.add({ name: name.trim(), order: (modules?.at(-1)?.order ?? 0) + 1 })
            setName('')
          }}
        >
          Añadir
        </Button>
      </div>
      {modules?.map((m, i) => (
        <Card key={m.id} className="flex items-center gap-2">
          <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/academia/modulo/${m.id}`)}>
            <div className="font-semibold">{m.name}</div>
            <div className="text-xs text-slate-500">{days?.filter((d) => d.moduleId === m.id).length ?? 0} días</div>
          </button>
          <button onClick={() => move(i, -1)} className="px-2 text-slate-500" aria-label="Subir">↑</button>
          <button onClick={() => move(i, 1)} className="px-2 text-slate-500" aria-label="Bajar">↓</button>
          <button
            onClick={() => {
              const n = prompt('Nuevo nombre', m.name)
              if (n?.trim()) db.academyModules.update(m.id!, { name: n.trim() })
            }}
            className="px-2 text-slate-500"
            aria-label="Renombrar"
          >
            ✎
          </button>
          <button onClick={() => confirm(`¿Borrar el módulo "${m.name}"? (los días se conservan)`) && db.academyModules.delete(m.id!)} className="px-2 text-rose-600" aria-label="Borrar">✕</button>
        </Card>
      ))}
    </div>
  )
}

/** Todo lo acumulado de un módulo: apuntes, ideas y flashcards. */
export function AcademyModuleView() {
  const id = Number(useParams().id)
  const mod = useLiveQuery(() => db.academyModules.get(id), [id])
  const days = useLiveQuery(() => db.academyDays.filter((d) => d.moduleId === id).sortBy('date'), [id])
  const cards = useLiveQuery(() => db.userCards.filter((c) => c.academyModuleId === id).toArray(), [id])
  return (
    <div className="space-y-3">
      <PageHeader title={mod?.name ?? 'Módulo'} subtitle={`${days?.length ?? 0} días · ${cards?.length ?? 0} flashcards`} back="/academia?tab=modulos" />
      {days?.map((d) => (
        <Card key={d.date}>
          <Link to={`/academia/dia/${d.date}`} className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">{fmtUK(d.date)}{d.topic ? ` · ${d.topic}` : ''}</Link>
          {d.keyIdeas?.some(Boolean) && <ul className="mt-2 list-disc pl-5 text-sm">{d.keyIdeas.filter(Boolean).map((k, i) => <li key={i}>{k}</li>)}</ul>}
          {d.notes && <p className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{d.notes}</p>}
        </Card>
      ))}
      {!days?.length && <Empty>Aún no hay días en este módulo.</Empty>}
    </div>
  )
}

function Assessments() {
  const today = useToday()
  const list = useLiveQuery(() => db.assessments.orderBy('date').reverse().toArray(), [])
  const [form, setForm] = useState({ date: today, type: '', score: '', improve: '' })
  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className={input} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input className={input} placeholder="Tipo (examen, role-play…)" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
        </div>
        <input className={input} placeholder="Nota / resultado" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
        <textarea className={input} rows={2} placeholder="Qué mejorar" value={form.improve} onChange={(e) => setForm({ ...form, improve: e.target.value })} />
        <Button
          disabled={!form.type.trim()}
          onClick={async () => {
            await db.assessments.add(form)
            setForm({ date: today, type: '', score: '', improve: '' })
          }}
        >
          Añadir evaluación
        </Button>
      </Card>
      {list?.map((a) => (
        <Card key={a.id}>
          <div className="flex items-baseline justify-between">
            <div className="font-semibold">{a.type}</div>
            <div className="text-xs text-slate-500">{fmtUK(a.date)}</div>
          </div>
          {a.score && <div className="text-sm">Resultado: <b>{a.score}</b></div>}
          {a.improve && <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Mejorar: {a.improve}</div>}
          <button className="mt-1 text-xs text-rose-600" onClick={() => confirm('¿Borrar?') && db.assessments.delete(a.id!)}>borrar</button>
        </Card>
      ))}
    </div>
  )
}

/** Resumen semanal (el domingo): ideas clave y dudas de la semana. */
export function WeeklySummary() {
  const today = useToday()
  const [offset, setOffset] = useState(0)
  const monday = addDays(startOfWeek(today), offset * 7)
  const days = useLiveQuery(() => db.academyDays.where('date').between(monday, addDays(monday, 6), true, true).toArray(), [monday])
  const byDate = new Map((days ?? []).map((d) => [d.date, d]))
  const doubts = (days ?? []).filter((d) => d.questions?.trim())
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button className="rounded-full px-3 py-1 hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => setOffset(offset - 1)}>‹</button>
        <span className="text-sm font-semibold">Semana del {fmtUK(monday)}</span>
        <button className="rounded-full px-3 py-1 hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => setOffset(offset + 1)}>›</button>
      </div>
      {eachDay(monday, addDays(monday, 4)).map((d) => {
        const day = byDate.get(d)
        return (
          <Card key={d}>
            <div className="text-sm font-semibold first-letter:uppercase">{fmtLong(d)}{day?.topic ? ` · ${day.topic}` : ''}</div>
            {day?.keyIdeas?.some(Boolean) ? (
              <ol className="mt-1 list-decimal pl-5 text-sm">{day.keyIdeas.filter(Boolean).map((k, i) => <li key={i}>{k}</li>)}</ol>
            ) : (
              <p className="text-xs text-slate-400">Sin ideas clave</p>
            )}
          </Card>
        )
      })}
      {doubts.length > 0 && (
        <Card>
          <h3 className="mb-1 font-semibold">❓ Dudas de la semana</h3>
          {doubts.map((d) => <p key={d.date} className="whitespace-pre-line text-sm"><b>{fmtShort(d.date)}:</b> {d.questions}</p>)}
        </Card>
      )}
      <Link to="/flashcards/academy" className="block rounded-2xl bg-amber-500 p-3 text-center font-semibold text-white">🃏 Repasar las flashcards de la academia</Link>
    </div>
  )
}
