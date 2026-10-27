import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useAllQuestions, usePlan, useSettings, useToday } from '../lib/hooks'
import { saveAttempt, saveMockResult } from '../lib/actions'
import { mockRows, mockTone } from '../lib/mocks'
import { nieTemario } from '../lib/content'
import {
  CUMULATIVE_MINUTES, CUMULATIVE_QUESTIONS, MOCK_MINUTES, MOCK_QUESTIONS, MOCK_UNSCORED, PASS_CORRECT, attemptPct, chooseUnscored, expectedQuestion, fmtTimer,
  partOf, pickBalanced, pickMock, scoreAnswers,
} from '../lib/exam'
import { PASS_MARK } from '../lib/defaults'
import { fmtShort } from '../lib/dates'
import { QuestionView } from '../components/QuestionView'
import { ErrorForm } from '../components/ErrorForm'
import { Button, Card, Empty, PageHeader, Pill } from '../components/ui'
import type { Question, TestAttempt } from '../types'

// la gráfica (recharts) se carga solo si hay datos
const MockChart = lazy(() => import('../components/MockChart'))

const PARTS = ['1', '2', '3', '4']
const PART_NAMES: Record<string, string> = { '1': 'Parte 1', '2': 'Parte 2', '3': 'Parte 3', '4': 'Parte 4' }
const KIND_LABEL: Record<TestAttempt['kind'], string> = { mock: 'Simulacro', cumulative: 'Acumulado', practice: 'Práctica', mini: 'Mini-test' }

/** Pantalla de la carpeta NIE: calendario de tests/simulacros + historial. */
export function MockCenter() {
  const s = useSettings()
  const today = useToday()
  const attempts = useLiveQuery(() => db.testAttempts.where('kind').anyOf('mock', 'cumulative', 'practice').sortBy('date'), [])
  const all = useAllQuestions()
  const nieCount = all?.filter((q) => partOf(q)).length ?? 0
  const results = useLiveQuery(() => db.mockResults.toArray(), [])
  const rows = mockRows(s, nieTemario.mocks, results ?? [])
  const chart = [
    ...rows.filter((r) => r.pct !== undefined).map((r) => ({ date: r.date, pct: r.pct! })),
    ...(attempts ?? []).filter((a) => a.kind !== 'practice').map((a) => ({ date: a.date, pct: attemptPct(a) })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((x) => ({ label: fmtShort(x.date), pct: x.pct }))

  return (
    <div className="space-y-4">
      <PageHeader title="Tests y simulacros NIE" subtitle={`${nieCount} preguntas NIE en el banco`} back="/carpetas/nie" />

      <Card>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link to="/examen?kind=mock" className="rounded-2xl bg-rose-600 p-4 text-white">
            <div className="font-bold">⏱️ Simulacro completo</div>
            <div className="text-sm opacity-90">{MOCK_QUESTIONS} preguntas · {MOCK_MINUTES} min · como el real</div>
          </Link>
          <Link to="/examen?kind=cumulative" className="rounded-2xl bg-indigo-600 p-4 text-white">
            <div className="font-bold">📚 Test acumulado</div>
            <div className="text-sm opacity-90">{CUMULATIVE_QUESTIONS} preguntas de lo estudiado · {CUMULATIVE_MINUTES} min</div>
          </Link>
        </div>
        <div className="mt-3 text-sm text-slate-500">Práctica por partes (20 preguntas, 30 min):</div>
        <div className="mt-1 flex flex-wrap gap-2">
          {PARTS.map((p) => (
            <Link key={p} to={`/examen?kind=practice&parts=${p}`} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold dark:bg-slate-800">
              {PART_NAMES[p]}
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Tus simulacros</h2>
        <p className="mb-2 text-xs text-slate-500">Apunta tus aciertos de cada test (Q&A, Police Pass…). Verde = objetivo cumplido · ámbar = aprobado ({PASS_MARK.toLocaleString('es-ES')} %) · rojo = por debajo.</p>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr><th className="px-1 py-1">Fecha</th><th className="px-1">Tipo y material</th><th className="px-1">Aciertos</th><th className="px-1">%</th><th className="px-1">Obj.</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const app = attempts?.filter((a) => a.kind === r.kind && a.date === r.date).at(-1)
                return (
                  <tr key={r.kind + r.date} className="border-t border-slate-200 align-top dark:border-slate-800">
                    <td className={`px-1 py-2 whitespace-nowrap ${r.date < today && !r.result && !app ? 'text-rose-600' : ''}`}>{fmtShort(r.date)}{r.date === today && <div><Pill tone="amber">¡hoy!</Pill></div>}</td>
                    <td className="px-1 py-2">
                      <div className="font-medium">{r.type}</div>
                      <div className="text-xs text-slate-500">{r.material}</div>
                      <Link to={`/examen?kind=${r.kind}`} className="text-xs font-semibold text-indigo-600">⏱️ Hacerlo en la app ({r.questions} preg · {r.minutes} min){app && ` · ${attemptPct(app)} %`}</Link>
                    </td>
                    <td className="px-1 py-2">
                      <input
                        type="number" inputMode="numeric" min={0} max={r.questions}
                        key={r.result?.correct ?? 'x'}
                        defaultValue={r.result?.correct}
                        onBlur={(e) => saveMockResult(r.date, e.target.value === '' ? null : Math.min(r.questions, Math.max(0, +e.target.value)), r.questions)}
                        className="w-14 rounded-lg border border-slate-300 bg-white px-1 py-1 text-center dark:border-slate-700 dark:bg-slate-800"
                        aria-label={`Aciertos del ${fmtShort(r.date)}`}
                      />
                      <div className="text-[11px] text-slate-500">/ {r.questions}</div>
                    </td>
                    <td className="px-1 py-2">{r.pct !== undefined ? <Pill tone={mockTone(r.pct, r.targetPercent)}>{r.pct.toLocaleString('es-ES')} %</Pill> : '–'}</td>
                    <td className="whitespace-nowrap px-1 py-2 text-slate-500">{r.targetPercent} %</td>
                  </tr>
                )
              })}
              <tr className="border-t border-slate-200 dark:border-slate-800">
                <td className="px-1 py-2 font-semibold text-rose-600">{fmtShort(s.examDate)}</td>
                <td colSpan={4} className="px-1 py-2 font-semibold text-rose-600">EXAMEN NIE {s.examConfirmed ? '' : '(fecha estimada)'}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {chart.length > 1 && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-slate-500">Evolución (% · línea roja = aprobado)</div>
            <Suspense fallback={null}><MockChart data={chart} /></Suspense>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Historial</h2>
        {attempts?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr><th className="py-1">Fecha</th><th>Tipo</th><th>Total</th>{PARTS.map((p) => <th key={p}>P{p}</th>)}</tr>
              </thead>
              <tbody>
                {[...attempts].reverse().map((a) => (
                  <tr key={a.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="py-1">{fmtShort(a.date)}</td>
                    <td>{KIND_LABEL[a.kind]}</td>
                    <td className={`font-semibold ${attemptPct(a) >= PASS_MARK ? 'text-emerald-600' : 'text-rose-600'}`}>{attemptPct(a)}%</td>
                    {PARTS.map((p) => <td key={p} className="text-slate-500">{a.byPart?.[p] ? `${Math.round((a.byPart[p].correct / a.byPart[p].total) * 100)}%` : '–'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">Verde = por encima del aprobado ({PASS_MARK.toLocaleString('es-ES')} %).</p>
          </div>
        ) : (
          <Empty>Sin intentos todavía.</Empty>
        )}
      </Card>
    </div>
  )
}

/** Modo examen: /examen?kind=mock | cumulative | practice&parts=1,2 */
export function Exam() {
  const [params] = useSearchParams()
  const kind = (params.get('kind') ?? 'mock') as 'mock' | 'cumulative' | 'practice'
  const parts = params.get('parts')?.split(',')
  const chapter = params.get('chapter')
  const today = useToday()
  const plan = usePlan()
  const all = useAllQuestions()


  const pool = useMemo(() => {
    if (!all) return undefined
    let p = all.filter((q) => partOf(q))
    if (parts) p = p.filter((q) => parts.includes(partOf(q)!))
    if (chapter) p = p.filter((q) => q.chapter === chapter)
    if (kind === 'cumulative') {
      // solo capítulos cuya 1ª vuelta ya empezó
      const started = new Set([...plan.nieRanges].filter(([, [start]]) => start <= today).map(([c]) => c))
      const studied = p.filter((q) => q.chapter && started.has(q.chapter))
      if (studied.length) p = studied
    }
    return p
  }, [all, kind, parts?.join(), chapter, plan, today]) // eslint-disable-line react-hooks/exhaustive-deps

  const base = { mock: { n: MOCK_QUESTIONS, min: MOCK_MINUTES }, cumulative: { n: CUMULATIVE_QUESTIONS, min: CUMULATIVE_MINUTES }, practice: { n: 20, min: 30 } }[kind]
  // test cronometrado de un capítulo: hasta 20 preguntas a 90 s cada una
  const config = chapter && pool ? { n: Math.min(20, pool.length), min: Math.max(1, Math.ceil(Math.min(20, pool.length) * 1.5)) } : base

  const [qs, setQs] = useState<Question[] | null>(null)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [flags, setFlags] = useState<boolean[]>([])
  const [unscored, setUnscored] = useState<Set<number>>(new Set())
  const [i, setI] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [finished, setFinished] = useState<{ durationSec: number } | null>(null)
  const submitted = useRef(false)

  const remaining = startedAt ? config.min * 60 - (now - startedAt) / 1000 : config.min * 60

  useEffect(() => {
    if (!startedAt || finished) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    addEventListener('beforeunload', warn)
    return () => {
      clearInterval(t)
      removeEventListener('beforeunload', warn)
    }
  }, [startedAt, finished])

  function start() {
    const picked = kind === 'mock' ? pickMock(pool!, config.n) : pickBalanced(pool!, config.n)
    setQs(picked)
    setUnscored(kind === 'mock' ? chooseUnscored(picked.length) : new Set())
    setAnswers(picked.map(() => null))
    setFlags(picked.map(() => false))
    setStartedAt(Date.now())
  }

  async function submit() {
    if (submitted.current || !qs) return
    submitted.current = true
    const durationSec = Math.round((Date.now() - startedAt!) / 1000)
    const sc = scoreAnswers(qs, answers, unscored)
    await saveAttempt({
      date: today, kind, total: sc.total, correct: sc.correct, byPart: sc.byPart, durationSec,
      answers: qs.map((q, k) => ({ questionId: q.id, chosen: answers[k], correct: q.correct })),
      unscored: [...unscored],
    })
    setFinished({ durationSec })
  }

  useEffect(() => {
    if (startedAt && remaining <= 0 && !finished) submit()
  }, [remaining]) // eslint-disable-line react-hooks/exhaustive-deps

  const title = { mock: 'Simulacro NIE', cumulative: 'Test acumulado', practice: chapter ? `Cronometrado · cap. ${chapter}` : `Práctica · ${parts?.map((p) => PART_NAMES[p]).join(', ') ?? 'NIE'}` }[kind]

  if (!pool) return <PageHeader title={title} back />

  // --- inicio ---
  if (!qs)
    return (
      <div>
        <PageHeader title={title} back={chapter ? `/nie/capitulo/${chapter}` : '/nie/simulacros'} />
        <Card>
          <ul className="space-y-1 text-sm">
            <li>📝 {Math.min(config.n, pool.length)} preguntas {pool.length < config.n && <span className="text-amber-600">(el banco tiene {pool.length}; el examen real tiene {config.n})</span>}</li>
            <li>⏱️ {config.min} minutos · ≈ {((config.min * 60) / config.n).toFixed(0)} s por pregunta</li>
            <li>🚫 Sin corrección hasta el final, como en el examen real. Puedes marcar preguntas 🚩 para revisarlas.</li>
            {kind === 'mock' ? (
              <li>🎯 Como en el NIE real: {MOCK_UNSCORED} preguntas son "de prueba" y no puntúan (no sabes cuáles). Se corrige sobre {MOCK_QUESTIONS - MOCK_UNSCORED}: apruebas con {PASS_CORRECT}/{MOCK_QUESTIONS - MOCK_UNSCORED} ({PASS_MARK.toLocaleString('es-ES')} %).</li>
            ) : (
              <li>🎯 Aprobado NIE: {PASS_MARK.toLocaleString('es-ES')} %</li>
            )}
            <li>💡 Ritmo del real: 90 s por pregunta. Te indico por qué pregunta deberías ir.</li>
          </ul>
          <Button className="mt-4 w-full py-3" onClick={start} disabled={!pool.length}>
            {pool.length ? 'Empezar' : 'Aún no hay preguntas NIE en el banco'}
          </Button>
        </Card>
      </div>
    )

  // --- resultados ---
  if (finished) {
    const sc = scoreAnswers(qs, answers, unscored)
    const wrong = qs.map((q, k) => ({ q, k })).filter(({ q, k }) => answers[k] !== q.correct)
    return (
      <div className="space-y-4">
        <PageHeader title={`${title} · resultado`} back="/nie/simulacros" />
        <Card className="text-center">
          <div className={`text-5xl font-bold ${sc.pct >= PASS_MARK ? 'text-emerald-600' : 'text-rose-600'}`}>{sc.pct}%</div>
          <p className="mt-1 text-slate-500">{sc.correct}/{sc.total} · tiempo {fmtTimer(finished.durationSec)}</p>
          <p className="mt-1 text-sm">{sc.pct >= PASS_MARK ? '✅ Aprobado' : '❌ Por debajo'} del {PASS_MARK.toLocaleString('es-ES')} %</p>
          {unscored.size > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Corregido sobre {sc.total} ({unscored.size} preguntas de prueba no puntuaban). Necesitabas {PASS_CORRECT}: {sc.correct >= PASS_CORRECT ? `te sobran ${sc.correct - PASS_CORRECT}` : `te faltan ${PASS_CORRECT - sc.correct}`}.
            </p>
          )}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {PARTS.map((p) => {
              const b = sc.byPart[p]
              const pct = b ? Math.round((b.correct / b.total) * 100) : null
              return (
                <div key={p} className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
                  <div className="text-xs text-slate-500">{PART_NAMES[p]}</div>
                  <div className={`font-bold ${pct === null ? '' : pct >= PASS_MARK ? 'text-emerald-600' : 'text-rose-600'}`}>{pct === null ? '–' : `${pct}%`}</div>
                </div>
              )
            })}
          </div>
        </Card>
        <h2 className="font-semibold">Revisión de fallos ({wrong.length})</h2>
        {/* plegadas: con 80 preguntas la lista sería enorme; se abre una a una */}
        {wrong.map(({ q, k }) => (
          <details key={q.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <summary className="cursor-pointer text-sm">
              <span className="font-semibold">Pregunta {k + 1}</span>
              <span className="text-slate-500">{q.chapter ? ` · cap. ${q.chapter}` : ''}{answers[k] === null ? ' · en blanco' : ''}{unscored.has(k) ? ' · de prueba (no puntuaba)' : ''}</span>
              <span className="mt-0.5 line-clamp-1 block text-xs text-slate-500">{q.scenario}</span>
            </summary>
            <div className="mt-3">
              <QuestionView q={q} chosen={answers[k]} reveal />
              <ErrorForm question={q} chosen={answers[k]} />
            </div>
          </details>
        ))}
      </div>
    )
  }

  // --- examen en curso ---
  const q = qs[i]
  const answered = answers.filter((a) => a !== null).length
  const shouldBeAt = expectedQuestion((now - startedAt!) / 1000, config.min, qs.length)
  return (
    <div>
      <div className="sticky top-12 z-10 -mx-4 mb-3 flex items-center justify-between border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <span className="text-sm font-semibold">
          {i + 1}/{qs.length} · {answered} respondidas
          <span className={`block text-xs font-normal ${answered + 1 < shouldBeAt ? 'text-rose-600' : 'text-slate-500'}`}>ritmo: deberías ir por la {shouldBeAt}</span>
        </span>
        <span className={`font-mono text-lg font-bold ${remaining < 600 ? 'text-rose-600' : ''}`}>⏱ {fmtTimer(remaining)}</span>
      </div>
      <Card>
        <QuestionView q={q} chosen={answers[i]} reveal={false} onChoose={(c) => setAnswers(answers.map((a, k) => (k === i ? c : a)))} />
      </Card>
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>←</Button>
        <Button variant="ghost" onClick={() => setFlags(flags.map((f, k) => (k === i ? !f : f)))}>{flags[i] ? '🚩 Marcada' : '🏳️ Marcar'}</Button>
        <Button className="flex-1" disabled={i === qs.length - 1} onClick={() => setI(i + 1)}>Siguiente →</Button>
      </div>
      <div className="mt-4 grid grid-cols-10 gap-1">
        {qs.map((_, k) => (
          <button
            key={k}
            onClick={() => setI(k)}
            className={`relative rounded-md py-1 text-[11px] font-semibold ${k === i ? 'ring-2 ring-indigo-500' : ''} ${answers[k] !== null ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}
          >
            {k + 1}
            {flags[k] && <span className="absolute -right-0.5 -top-1 text-[9px]">🚩</span>}
          </button>
        ))}
      </div>
      <Button
        variant="danger"
        className="mt-6 w-full py-3"
        onClick={() => confirm(`¿Entregar el examen? ${qs.length - answered} sin responder${flags.some(Boolean) ? ', hay preguntas marcadas' : ''}.`) && submit()}
      >
        Entregar examen
      </Button>
    </div>
  )
}
