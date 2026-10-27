import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { lessonRef, nieChapterMeta, nieGroups } from '../lib/content'
import { useAllQuestions, useDoneLessons, usePlan, useSettings, useToday } from '../lib/hooks'
import { fixedSets } from '../lib/exam'
import { chapterLabel, chapterStatus, type ChapterInfo } from '../lib/progress'
import { getChapter, setFinishDate, toggleStep, updateChapter } from '../lib/actions'
import { CIRCLED, stepName } from '../lib/today'
import { reviewGuide, reviewStepLabel } from '../lib/reviews'
import { NieProgress } from '../components/NieProgress'
import { fmtShort, fmtUK } from '../lib/dates'
import { Recorder } from '../components/Recorder'
import { Markdown } from '../components/Markdown'
import { Button, Card, Check, Empty, PageHeader, Pill, ProgressBar } from '../components/ui'
import type { ChapterStatus, NieChapterState, NiePartial } from '../types'

const partSum = (state: NieChapterState, step: number) => (state.partial ?? []).filter((p) => p.step === step).reduce((a, p) => a + p.minutes, 0)

const STATUS_TONE: Record<ChapterStatus, 'slate' | 'amber' | 'indigo' | 'green'> = {
  pending: 'slate', inProgress: 'amber', studied: 'indigo', reviewing: 'indigo', final: 'green',
}

function useChapterInfos(): Map<string, ChapterInfo & { state?: NieChapterState }> | undefined {
  const done = useDoneLessons()
  const states = useLiveQuery(() => db.nieChapter.toArray(), [])
  const reviews = useLiveQuery(() => db.reviews.where('itemKey').startsWith('lesson:nie-').toArray(), [])
  if (!states || !reviews) return undefined
  const byId = new Map(states.map((s) => [s.chapterId, s]))
  const out = new Map<string, ChapterInfo & { state?: NieChapterState }>()
  for (const chapter of nieGroups.flat()) {
    const n = reviews.filter((r) => r.itemKey === `lesson:nie-${chapter}` && r.doneAt).length
    out.set(chapter, { ...chapterStatus(byId.get(chapter), n, done.has(`nie-${chapter}`)), state: byId.get(chapter) })
  }
  return out
}

/** Temario NIE: los 43 capítulos en TUS 12 grupos, con los 10 pasos, estado, fechas y margen. */
export function NieChapterList() {
  const infos = useChapterInfos()
  const plan = usePlan()
  const today = useToday()
  if (!infos) return <PageHeader title="Temario NIE" back />
  const list = [...infos.entries()]
  const isStudied = (st: ChapterStatus) => ['studied', 'reviewing', 'final'].includes(st)
  const studied = list.filter(([, i]) => isStudied(i.status)).length
  const finals = list.filter(([, i]) => i.status === 'final').length
  return (
    <div className="space-y-4">
      <PageHeader title="Temario NIE" subtitle={`${studied}/43 estudiados · ${finals}/43 repaso final ✓`} back="/carpetas/nie" right={<Link to="/nie/repasos" className="text-sm font-semibold text-indigo-600">Repasos →</Link>} />
      <NieProgress />
      {nieGroups.map((g, gi) => (
        <section key={gi}>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Grupo {gi + 1}</h2>
          <div className="space-y-2">
            {g.map((chapter) => (
              <ChapterRow key={chapter} chapter={chapter} info={infos.get(chapter)!} range={plan.nieRanges.get(chapter)} today={today} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function ChapterRow({ chapter, info, range, today }: { chapter: string; info: ChapterInfo & { state?: NieChapterState }; range?: [string, string]; today: string }) {
  const meta = nieChapterMeta(chapter)!
  const steps = info.state?.steps ?? []
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <Link to={`/nie/capitulo/${chapter}`} className="block hover:text-rose-600">
        <div className="text-sm font-medium">{chapter} · {meta.title}</div>
      </Link>
      <div className="mt-1 flex flex-wrap gap-1">
        <Pill tone={STATUS_TONE[info.status]}>{chapterLabel(info)}</Pill>
        <Pill>≈ {meta.totalHours.toLocaleString('es-ES')} h</Pill>
        {range && <Pill>{fmtShort(range[0])}–{fmtShort(range[1])}</Pill>}
        {info.state?.confidence && <Pill tone="amber">{'★'.repeat(info.state.confidence)}</Pill>}
        {info.state?.notes && <Pill>📝</Pill>}
      </div>
      {meta.note && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">🏅 {meta.note}</p>}
      <StepButtons chapter={chapter} steps={steps} partial={info.state?.partial ?? []} today={today} />
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-slate-500">Confianza, notas y fecha de fin</summary>
        <ChapterExtras chapter={chapter} state={info.state} compact />
      </details>
    </div>
  )
}

/** ① … ⑩: un toque marca/desmarca el paso (con la fecha de hoy). */
function StepButtons({ chapter, steps, partial, today }: { chapter: string; steps: (string | null)[]; partial: NiePartial[]; today: string }) {
  const meta = nieChapterMeta(chapter)!
  return (
    <div className="mt-2 grid grid-cols-10 gap-1">
      {CIRCLED.map((c, i) => {
        const part = partial.filter((p) => p.step === i + 1).reduce((a, p) => a + p.minutes, 0)
        const half = !steps[i] && part > 0
        return (
          <button
            key={i}
            onClick={() => toggleStep(chapter, i, today)}
            title={`${stepName(i + 1)} · ${meta.stepMinutes[i]}′${steps[i] ? ` · hecho ${fmtShort(steps[i]!)}` : half ? ` · llevas ${part}′` : ''}`}
            aria-label={`Paso ${i + 1}: ${stepName(i + 1)}${steps[i] ? ' (hecho)' : half ? ` (a medias: ${part} de ${meta.stepMinutes[i]} min)` : ''}`}
            className={`aspect-square w-full max-w-9 rounded-full text-base font-semibold ${
              steps[i] ? 'bg-rose-600 text-white' : half ? 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {c}
          </button>
        )
      })}
    </div>
  )
}

/** Confianza (1–5), notas libres, fecha real de fin (paso ⑩) y enlace a "Escribir el tema". */
function ChapterExtras({ chapter, state, compact = false }: { chapter: string; state?: NieChapterState; compact?: boolean }) {
  const end = state?.steps[9]
  return (
    <div className="mt-2 space-y-3">
      <div>
        <div className="mb-1 text-xs text-slate-500">¿Cuánta confianza tienes? (1–5)</div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => updateChapter(chapter, { confidence: n })}
              className={`${compact ? 'h-9' : 'h-11'} flex-1 rounded-xl text-lg font-bold ${state?.confidence === n ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="text-xs text-slate-500">Notas</span>
        <textarea className={input} rows={compact ? 2 : 3} key={state?.notes ?? ''} defaultValue={state?.notes ?? ''} onBlur={(e) => updateChapter(chapter, { notes: e.target.value })} placeholder="Dudas, trampas, cosas a repasar…" />
      </label>
      {end && (
        <label className="block">
          <span className="text-xs text-slate-500">Fecha real de fin (paso ⑩) – al cambiarla se recalculan los repasos</span>
          <input type="date" className={input} key={end} defaultValue={end} onBlur={(e) => e.target.value && e.target.value !== end && setFinishDate(chapter, e.target.value)} />
        </label>
      )}
      {compact && (
        <Link to={`/nie/capitulo/${chapter}?paso=10`} className="inline-block rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold dark:bg-slate-800">✍️ Escribir el tema (paso ⑩)</Link>
      )}
    </div>
  )
}

const input = 'w-full rounded-xl border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900'

/** Página de un capítulo: checklist de 10 pasos, grabadora, resumen, confianza y repasos. */
export function NieChapter() {
  const { chapter = '' } = useParams()
  const today = useToday()
  const settings = useSettings()
  const plan = usePlan()
  const infos = useChapterInfos()
  const state = useLiveQuery(() => getChapter(chapter), [chapter])
  const reviews = useLiveQuery(() => db.reviews.where('itemKey').equals(`lesson:nie-${chapter}`).sortBy('due'), [chapter])
  const [params] = useSearchParams()
  const loaded = !!state && !!infos
  // ?paso=10 → baja directamente al editor del tema
  useEffect(() => {
    if (loaded && params.get('paso')) document.getElementById(`paso-${params.get('paso')}`)?.scrollIntoView({ behavior: 'smooth' })
  }, [loaded, params])
  const ref = lessonRef(`nie-${chapter}`)
  const meta = nieChapterMeta(chapter)
  if (!ref || !meta) return <Empty>Capítulo no encontrado.</Empty>
  if (!state || !infos) return <PageHeader title={ref.lesson.title} back />

  const info = infos.get(chapter)!
  const range = plan.nieRanges.get(chapter)
  const next = reviews?.find((r) => !r.doneAt)

  return (
    <div className="space-y-4">
      <PageHeader title={ref.lesson.title} subtitle={ref.subject.name} back="/nie/capitulos" />
      <div className="flex flex-wrap gap-2">
        <Pill tone={STATUS_TONE[info.status]}>{chapterLabel(info)}</Pill>
        {range && <Pill>1ª vuelta {fmtUK(range[0])} – {fmtUK(range[1])}</Pill>}
        {next && <Pill tone={next.due < today ? 'red' : 'amber'}>Repaso {reviewStepLabel(next)}: {fmtUK(next.due)}</Pill>}
        {info.status === 'studied' && !next && <Pill>Sin más repasos: toca el repaso final</Pill>}
      </div>
      {meta.note && <p className="text-sm text-amber-700 dark:text-amber-300">🏅 {meta.note}</p>}
      {next && <p className="text-sm text-slate-600 dark:text-slate-300">Próximo repaso: {reviewGuide(next)}</p>}

      <Card className="border-rose-200 dark:border-rose-900">
        <p className="text-sm">⚠ Estudia siempre con el <b>Blackstone's Police Investigators' Manual 2027</b>: el examen sale solo de ahí. Mis explicaciones te ayudan a entenderlo; comprueba con tu edición 2027.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={`/leccion/nie-${chapter}`} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">📖 Mi explicación fácil</Link>
          <Link to={`/flashcards/${ref.subject.id}`} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold dark:bg-slate-800">🃏 Flashcards</Link>
        </div>
      </Card>

      <ChapterTests chapter={chapter} />

      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">Método de 10 pasos</h2>
          <span className="text-xs text-slate-500">{info.stepsDone}/10 · ≈ {meta.totalHours.toLocaleString('es-ES')} h en total</span>
        </div>
        <ProgressBar pct={info.stepsDone * 10} color="rose" className="mb-3" />
        <ol className="space-y-3">
          {meta.stepMinutes.map((minutes, i) => (
            <li key={i} id={`paso-${i + 1}`}>
              <div className="flex items-center gap-3">
                <Check checked={!!state.steps[i]} onChange={() => toggleStep(chapter, i, today)} label={stepName(i + 1)} />
                <div className="flex-1">
                  <div className={`text-sm font-medium ${state.steps[i] ? 'text-slate-400 line-through' : ''}`}>{CIRCLED[i]} {stepName(i + 1)}</div>
                  <div className="text-xs text-slate-500">
                    ≈ {minutes} min{state.steps[i] && ` · hecho ${fmtShort(state.steps[i]!)}`}
                    {!state.steps[i] && partSum(state, i + 1) > 0 && <span className="text-amber-600"> · llevas {partSum(state, i + 1)}′ (a medias)</span>}
                  </div>
                </div>
              </div>
              {(i === 0 || i === 5) && <InitialQuestions state={state} after={i === 5} />}
              {i === 8 && <div className="ml-10 mt-2"><Recorder chapterId={chapter} /></div>}
              {i === 9 && <SummaryEditor chapterId={chapter} initial={state.summary ?? ''} />}
            </li>
          ))}
        </ol>
        {state.steps[9] && <p className="mt-3 text-sm text-emerald-600">✓ Estudiado el {fmtUK(state.steps[9])}. Los repasos (+1, +3, +7, +30, +60, +90, +120 días) aparecen en Hoy y en Repasos hasta el {fmtUK(settings.finalReviewStart)}.</p>}
      </Card>

      <Card>
        <h2 className="font-semibold">Confianza, notas y fecha de fin</h2>
        <ChapterExtras chapter={chapter} state={state} />
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Repaso final ({fmtShort(settings.finalReviewStart)} – {fmtShort(settings.finalReviewEnd)})</h2>
        {state.finalDoneAt ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-emerald-600">✓ Hecho el {fmtUK(state.finalDoneAt)}</span>
            <Button variant="ghost" onClick={() => updateChapter(chapter, { finalDoneAt: undefined })}>Deshacer</Button>
          </div>
        ) : (
          <Button onClick={() => updateChapter(chapter, { finalDoneAt: today })} disabled={today < settings.finalReviewStart && !state.steps[9]}>
            Marcar repaso final ✓
          </Button>
        )}
      </Card>
    </div>
  )
}

/** Pasos 1 y 6: tus 3 preguntas, la respuesta antes de leer y después. */
function InitialQuestions({ state, after }: { state: NieChapterState; after: boolean }) {
  const qs = state.initialQuestions ?? ['', '', '']
  const field = after ? 'answersAfter' : 'answersBefore'
  const answers = state[field] ?? ['', '', '']
  const save = (patch: Partial<NieChapterState>) => updateChapter(state.chapterId, patch)
  return (
    <div className="ml-10 mt-2 space-y-2">
      {[0, 1, 2].map((k) => (
        <div key={k} className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50">
          {after ? (
            <div className="text-sm font-medium">{qs[k] || <span className="text-slate-400">Pregunta {k + 1} (escríbela en el paso 1)</span>}</div>
          ) : (
            <input className={input} placeholder={`Pregunta ${k + 1} que crees que saldrá`} defaultValue={qs[k]} onBlur={(e) => save({ initialQuestions: qs.map((q, j) => (j === k ? e.target.value : q)) })} />
          )}
          {after && state.answersBefore?.[k] && <div className="mt-1 text-xs text-slate-500">Antes: {state.answersBefore[k]}</div>}
          <textarea
            className={`${input} mt-1`}
            rows={2}
            placeholder={after ? 'Tu respuesta ahora' : 'Tu respuesta sin leer'}
            defaultValue={answers[k]}
            onBlur={(e) => save({ [field]: answers.map((a, j) => (j === k ? e.target.value : a)) })}
          />
        </div>
      ))}
    </div>
  )
}

/** Paso 10: editor del resumen (se guarda solo). */
function SummaryEditor({ chapterId, initial }: { chapterId: string; initial: string }) {
  const [text, setText] = useState(initial)
  const [preview, setPreview] = useState(false)
  const [status, setStatus] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  function change(v: string) {
    setText(v)
    setStatus('…')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      await updateChapter(chapterId, { summary: v })
      setStatus('guardado ✓')
    }, 700)
  }

  return (
    <div className="ml-10 mt-2">
      <div className="mb-1 flex items-center gap-2 text-xs">
        <button onClick={() => setPreview(false)} className={!preview ? 'font-bold text-indigo-600' : 'text-slate-500'}>Escribir</button>
        <button onClick={() => setPreview(true)} className={preview ? 'font-bold text-indigo-600' : 'text-slate-500'}>Vista previa</button>
        <span className="ml-auto text-slate-400">{status}</span>
      </div>
      {preview ? (
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">{text ? <Markdown text={text} /> : <span className="text-sm text-slate-400">Vacío</span>}</div>
      ) : (
        <textarea
          className={`${input} font-mono`}
          rows={12}
          value={text}
          onChange={(e) => change(e.target.value)}
          placeholder={'Escribe el tema con tus palabras (Markdown):\n## Definición\n- ...\n## Elementos\n- ...\n## Trampas de examen\n- ...'}
        />
      )}
    </div>
  )
}

/** Tests del capítulo: bloques fijos de 10 (Test 1, 2, 3…), uno al azar y uno cronometrado. */
function ChapterTests({ chapter }: { chapter: string }) {
  const questions = useAllQuestions()?.filter((q) => q.chapter === chapter)
  if (!questions) return null
  const sets = fixedSets(questions)
  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-semibold">Tests tipo NIE</h2>
        <span className="text-xs text-slate-500">{questions.length} preguntas</span>
      </div>
      {questions.length ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {sets.map((set, k) => (
              <Link key={k} to={`/test?chapter=${chapter}&set=${k + 1}`} className="rounded-xl bg-emerald-50 p-2 text-center text-sm font-semibold dark:bg-emerald-950/40">
                Test {k + 1}
                <span className="block text-[11px] font-normal text-slate-500">{set.length} preg.</span>
              </Link>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link to={`/test?chapter=${chapter}&n=10`} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold dark:bg-slate-800">🎲 10 al azar</Link>
            <Link to={`/examen?kind=practice&chapter=${chapter}`} className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white">⏱️ Cronometrado (90 s/preg.)</Link>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">Aún no hay preguntas de este capítulo. Puedes añadir las tuyas desde la asignatura.</p>
      )}
    </Card>
  )
}
