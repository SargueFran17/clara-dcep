import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { usePlan, useSettings } from '../lib/hooks'
import { addDays, dayName, eachDay, fmtShort, startOfWeek, weekday, type ISODate } from '../lib/dates'
import { PHASE_LABELS, finalReviewDays, type Phase, type PlanDay } from '../lib/planner'
import { arranque, fitnessStart, fitnessWeek, lessonRef, nieChapterMeta, nieGroups, nieTemario, preAcademyOrder, weighIn } from '../lib/content'
import { addMonthsYM, daySummary, monthGrid, MONTHS } from '../lib/month'
import { mockRows } from '../lib/mocks'
import { ERROR_TYPES } from '../lib/errors'
import { NIE_OFFSETS } from '../lib/reviews'
import { CIRCLED, stepName } from '../lib/today'
import { BLEEP_TARGET_LEVEL } from '../lib/fitness'
import { weekNumber } from './Week'

// Planner imprimible: se genera con el MISMO plan que la app (fechas de Ajustes, orden de
// lecciones, cola del NIE, entreno). Imprímelo o guárdalo como PDF desde el navegador.

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const d2 = (iso: ISODate) => `${Number(iso.slice(8))} ${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]}`
const h = (min: number) => `${(min / 60).toLocaleString('es-ES', { maximumFractionDigits: 1 })} h`

const PHASE_COLOR: Record<Phase, string> = {
  before: '#f1f5f9', pre: '#e0f2fe', xmas: '#dcfce7', academy: '#e0e7ff', nieBlock: '#fef3c7', final: '#ffe4e6', exam: '#fecdd3', after: '#f1f5f9',
}

function Page({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: ReactNode }) {
  return (
    <section className="print-page">
      {title && (
        <header className="mb-2 border-b-2 border-slate-800 pb-1">
          <h1 className="text-lg font-bold">{title}</h1>
          {subtitle && <div className="text-[10px] text-slate-600">{subtitle}</div>}
        </header>
      )}
      {children}
      <footer className="print-footer">Clara · Hampshire DCEP · planner generado desde la app</footer>
    </section>
  )
}

const Box = () => <span className="inline-block h-2.5 w-2.5 shrink-0 border border-slate-500 align-middle" />
const Line = ({ label }: { label?: string }) => (
  <div className="mt-1 flex items-end gap-1 text-[10px]">
    {label && <span className="font-semibold">{label}</span>}
    <span className="flex-1 border-b border-slate-400">&nbsp;</span>
  </div>
)

export function Printable() {
  const s = useSettings()
  const plan = usePlan()

  useEffect(() => {
    // el planner se imprime siempre en claro
    const html = document.documentElement
    const wasDark = html.classList.contains('dark')
    html.classList.remove('dark')
    document.title = 'Planner NIE · Clara'
    return () => {
      if (wasDark) html.classList.add('dark')
    }
  }, [])

  const firstDay = arranque.days[0]?.date && arranque.days[0].date < s.studyStart ? arranque.days[0].date : s.studyStart
  const lastDay = s.nieBlockEnd > s.examDate ? s.nieBlockEnd : s.examDate
  const mondays: ISODate[] = []
  for (let m = startOfWeek(firstDay); m <= lastDay; m = addDays(m, 7)) mondays.push(m)
  const months: string[] = []
  for (let ym = firstDay.slice(0, 7); ym <= s.examDate.slice(0, 7); ym = addMonthsYM(ym, 1)) months.push(ym)

  return (
    <div className="print-doc">
      <div className="no-print sticky top-0 z-10 mb-4 flex items-center gap-2 border-b border-slate-200 bg-white p-3">
        <Link to="/mas" className="rounded-full px-3 py-1 text-sm text-slate-600 hover:bg-slate-100">← Volver</Link>
        <button onClick={() => window.print()} className="ml-auto rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">🖨️ Imprimir / Guardar PDF</button>
      </div>

      <Cover firstDay={firstDay} />
      <YearMap mondays={mondays} firstDay={firstDay} />
      {months.map((ym) => <MonthPage key={ym} ym={ym} />)}
      {mondays.map((m) => <WeekPage key={m} monday={m} n={weekNumber(m, firstDay)} />)}
      <TemarioPages />
      <PreAcademyChecklist />
      <AcademySheet />
      <ErrorsPage />
      <MocksPage />
      <FitnessPage />
    </div>
  )

  // ---------------------------------------------------------------- portada
  function Cover({ firstDay }: { firstDay: ISODate }) {
    const dates: [string, string][] = [
      [d2(firstDay), 'Arranque'],
      [d2(s.studyStart), 'Pre-academia: conducir en UK + fitness y peso (hasta el 5 nov), luego preparación de la academia'],
      [`${d2(s.xmasStart)} – ${d2(s.xmasEnd)}`, 'Navidad ligera'],
      [d2(s.academyStart), 'Academia semana 1'],
      [d2(s.nieStart), 'Empieza el NIE (1ª vuelta)'],
      [d2(s.academyEnd), 'Fin de la academia (18 semanas)'],
      [d2(s.nieBlockStart), 'Bloque NIE: vuelta 2 + simulacros'],
      [`${d2(s.finalReviewStart)} – ${d2(s.finalReviewEnd)}`, 'Repaso final por grupos'],
      [d2(s.examDate), `EXAMEN NIE${s.examConfirmed ? '' : ' (fecha estimada: confírmala)'}`],
    ]
    return (
      <Page>
        <div className="mt-10 text-center">
          <div className="text-4xl font-black tracking-tight">Operación NIE</div>
          <div className="mt-1 text-sm text-slate-600">Planner imprimible · Clara · Hampshire DCEP · {d2(firstDay)} {firstDay.slice(0, 4)} – {d2(s.examDate)} {s.examDate.slice(0, 4)}</div>
        </div>
        <h2 className="mt-8 text-sm font-bold uppercase tracking-wider">Fechas clave</h2>
        <table className="mt-1 w-full text-[11px]">
          <tbody>
            {dates.map(([d, l]) => (
              <tr key={d + l} className="border-b border-slate-200"><td className="w-36 py-1 font-semibold">{d}</td><td>{l}</td></tr>
            ))}
          </tbody>
        </table>
        <h2 className="mt-6 text-sm font-bold uppercase tracking-wider">Cómo usarlo</h2>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-[11px]">
          <li>Imprime el mes y la semana en la que estás. Cada día: tacha lo hecho y apunta notas.</li>
          <li>Es el mismo plan que la app (Hoy, Semana, Mes). Si un día no puedes, en la app pulsa <b>😴 Hoy no puedo</b>: el estudio se recoloca solo; vuelve a imprimir la semana si quieres el plan nuevo.</li>
          <li>Cada domingo: valora la semana y escribe qué ajustas. Mira el Temario y los repasos.</li>
          <li>Temario NIE: rellena un círculo por cada paso del método (①–⑩) y marca cada repaso (+1, +3, +7, +30, +60, +90, +120 días desde que terminas el paso ⑩).</li>
          <li>Entreno: lunes tenis 19:00–21:00 · miércoles y jueves gym + tenis · viernes a domingo gym · cada día de gym 20′ de cinta. Pésate los sábados.</li>
          <li>Errores y simulacros: hojas para rellenar a mano. Imprime más copias cuando las llenes.</li>
        </ol>
        <h2 className="mt-6 text-sm font-bold uppercase tracking-wider">Contenido</h2>
        <ul className="mt-1 grid grid-cols-2 gap-x-6 text-[11px]">
          {['Mapa del año', 'Calendarios mensuales', 'Semanas (una página por semana)', 'Temario NIE: 10 pasos + repasos', 'Pre-academia: checklist', 'Hoja diaria de academia', 'Registro de errores', 'Tests y simulacros', 'Fitness: semana tipo, peso y bleep test'].map((x) => (
            <li key={x} className="border-b border-dotted border-slate-300 py-0.5">{x}</li>
          ))}
        </ul>
      </Page>
    )
  }

  // ---------------------------------------------------------------- mapa del año
  function YearMap({ mondays, firstDay }: { mondays: ISODate[]; firstDay: ISODate }) {
    const phases: [Phase, ISODate, ISODate][] = [
      ['pre', s.studyStart, s.preEnd],
      ['xmas', s.xmasStart, addDays(s.academyStart, -1)],
      ['academy', s.academyStart, s.academyEnd],
      ['nieBlock', s.nieBlockStart, addDays(s.finalReviewStart, -1)],
      ['final', s.finalReviewStart, s.finalReviewEnd],
      ['exam', s.examDate, s.examDate],
    ]
    return (
      <Page title="Mapa del año" subtitle="Tus fases. Colorea cada semana cuando la termines.">
        <div className="flex flex-wrap gap-1 text-[10px]">
          {phases.map(([p, a, b]) => (
            <span key={p} className="rounded px-2 py-0.5" style={{ background: PHASE_COLOR[p] }}><b>{PHASE_LABELS[p]}</b> · {d2(a)}{a !== b && ` – ${d2(b)}`}</span>
          ))}
        </div>
        <h2 className="mt-3 text-[11px] font-bold uppercase">Semanas (marca cada una al terminarla)</h2>
        <div className="mt-1 grid grid-cols-4 gap-1 text-[9.5px]">
          {mondays.map((m) => {
            const ph = plan.days.get(addDays(m, 3))?.phase ?? 'before'
            return (
              <div key={m} className="flex items-center gap-1 rounded px-1 py-0.5" style={{ background: PHASE_COLOR[ph] }}>
                <Box /> <b>S{String(weekNumber(m, firstDay)).padStart(2, '0')}</b> {d2(m)} – {d2(addDays(m, 6))}
              </div>
            )
          })}
        </div>
        <h2 className="mt-3 text-[11px] font-bold uppercase">Tu orden de temas NIE (12 grupos) · fechas previstas de la 1ª vuelta</h2>
        <div className="mt-1 space-y-0.5 text-[9.5px]">
          {nieGroups.map((g, i) => {
            const ranges = g.map((c) => plan.nieRanges.get(c)).filter(Boolean) as [ISODate, ISODate][]
            const from = ranges.map((r) => r[0]).sort()[0]
            const to = ranges.map((r) => r[1]).sort().at(-1)
            return (
              <div key={i}>
                <b>Grupo {i + 1}{from && to ? ` · ${d2(from)} – ${d2(to)}` : ''}:</b> {g.map((c) => `${c} ${nieChapterMeta(c)?.title ?? ''}`).join(' · ')}
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[9px] text-slate-500">La cola del NIE se recoloca sola si un día no estudias: estas fechas son el plan de hoy. Consulta la app para el plan al día.</p>
      </Page>
    )
  }

  // ---------------------------------------------------------------- mes
  function MonthPage({ ym }: { ym: string }) {
    const grid = monthGrid(ym)
    const [y, m] = ym.split('-').map(Number)
    const milestones = grid
      .filter((d) => d.startsWith(ym))
      .flatMap((d) => (plan.days.get(d)?.events ?? []).filter((e) => ['cumulativeTest', 'mock', 'exam', 'finalGroup'].includes(e.type)).map((e) => `${d2(d)}: ${e.label}`))
    return (
      <Page title={`${MONTHS[m - 1]} ${y}`} subtitle="Plan del mes. Tacha cada día cuando lo cumplas.">
        <div className="grid grid-cols-7 border-l border-t border-slate-400 text-[9px]">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <div key={d} className="border-b border-r border-slate-400 bg-slate-100 py-0.5 text-center font-bold">{d}</div>)}
          {grid.map((d) => {
            const p = plan.days.get(d)
            const inMonth = d.startsWith(ym)
            return (
              <div key={d} className="min-h-[84px] border-b border-r border-slate-400 p-0.5" style={{ background: inMonth && p ? PHASE_COLOR[p.phase] : undefined, opacity: inMonth ? 1 : 0.35 }}>
                <div className="font-bold">{Number(d.slice(8))}</div>
                {inMonth && daySummary(p).map((l, i) => <div key={i} className="leading-tight">{l}</div>)}
                {inMonth && p && p.workouts.some((w) => w.type !== 'rest') && <div className="leading-tight text-slate-600">{p.workouts.filter((w) => w.type !== 'rest').map((w) => (w.type === 'gym' ? '🏋️' : w.type === 'tennis' ? '🎾' : '🏃')).join('')}</div>}
              </div>
            )
          })}
        </div>
        {milestones.length > 0 && (
          <div className="mt-2 text-[10px]">
            <b>📌 Este mes:</b> {milestones.join(' · ')}
          </div>
        )}
        <div className="mt-3 text-[11px] font-bold uppercase">Objetivo del mes</div>
        <Line /><Line />
        <div className="mt-3 text-[11px] font-bold uppercase">Balance del mes (escríbelo el último día)</div>
        <Line /><Line /><Line />
      </Page>
    )
  }

  // ---------------------------------------------------------------- semana
  function WeekPage({ monday, n }: { monday: ISODate; n: number }) {
    const days = eachDay(monday, addDays(monday, 6))
    const phase = plan.days.get(addDays(monday, 3))?.phase ?? plan.days.get(monday)?.phase
    const target = days.reduce((a, d) => a + (plan.days.get(d)?.targetMin ?? 0), 0)
    const gyms = days.reduce((a, d) => a + (plan.days.get(d)?.workouts.filter((w) => w.type === 'gym').length ?? 0), 0)
    const tennis = days.reduce((a, d) => a + (plan.days.get(d)?.workouts.filter((w) => w.type === 'tennis').length ?? 0), 0)
    return (
      <Page title={`Semana ${String(n).padStart(2, '0')} · ${d2(monday)} – ${d2(addDays(monday, 6))}`} subtitle={<>{phase ? PHASE_LABELS[phase] : ''} · objetivo de estudio {h(target)}</>}>
        <Line label="Mi objetivo de la semana:" />
        <div className="mt-2 divide-y divide-slate-300 border-y border-slate-400">
          {days.map((d) => <DayRow key={d} date={d} p={plan.days.get(d)} />)}
        </div>
        <div className="mt-2 rounded border border-slate-400 p-1.5 text-[10px]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <b>REVISIÓN DEL DOMINGO</b>
            <span>Valoración: 1 2 3 4 5</span>
            <span>Horas ___ / {h(target)}</span>
            <span>Gym ___ / {gyms}</span>
            <span>Tenis ___ / {tennis}</span>
            <span>Dieta ___ / 7</span>
            <span>Peso ______ kg</span>
          </div>
          <Line label="Qué ha ido bien / qué ajusto:" />
          <Line />
        </div>
      </Page>
    )
  }

  function DayRow({ date, p }: { date: ISODate; p?: PlanDay }) {
    const items: ReactNode[] = []
    if (p) {
      for (const id of p.lessons) {
        const ref = lessonRef(id)
        items.push(<>📖 <b>{ref?.lesson.code}</b> · {ref?.lesson.title} <span className="text-slate-500">({ref?.subject.name})</span></>)
      }
      for (const n of p.nie) {
        const meta = nieChapterMeta(n.chapter)
        items.push(
          <>⚖️ <b>NIE {n.chapter}</b> {meta?.title}: {n.steps.map((c) => `${CIRCLED[c.step - 1]} ${stepName(c.step)}${c.minutes < c.stepMinutes ? ` (${c.minutes}′ de ${c.stepMinutes}′)` : ` ${c.minutes}′`}`).join(' · ')}</>,
        )
      }
      for (const e of p.events) if (e.type !== 'weighIn') items.push(<>{e.type === 'mock' || e.type === 'exam' || e.type === 'cumulativeTest' ? <b>• {e.label}</b> : `• ${e.label}`}</>)
    }
    const workouts = (p?.workouts ?? []).filter((w) => w.type !== 'rest')
    const rest = (p?.workouts ?? []).find((w) => w.type === 'rest')
    const weigh = p?.events.some((e) => e.type === 'weighIn')
    return (
      <div className="flex gap-2 py-1 text-[9.5px] leading-snug" style={{ breakInside: 'avoid' }}>
        <div className="w-12 shrink-0">
          <div className="text-[11px] font-bold uppercase">{dayName(date).slice(0, 3)}</div>
          <div>{d2(date)}</div>
        </div>
        <div className="min-w-0 flex-1">
          {items.length ? items.map((it, i) => <div key={i}>{it}</div>) : <div className="text-slate-500">Libre / descanso</div>}
          <div className="mt-0.5 text-slate-500">Notas: ______________________________________________</div>
        </div>
        <div className="w-36 shrink-0 space-y-0.5">
          <div className="flex items-center gap-1"><Box /> Estudio {p?.targetMin ? h(p.targetMin) : '—'}</div>
          {workouts.map((w, i) => <div key={i} className="flex items-center gap-1"><Box /> {w.label}</div>)}
          {rest && <div className="flex items-center gap-1 text-slate-500"><Box /> {rest.label}</div>}
          {weigh && <div className="flex items-center gap-1"><Box /> ⚖️ Peso ______ kg</div>}
          <div className="flex items-center gap-1"><Box /> Dieta <Box /> Agua · Sueño __ h</div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------- temario
  function TemarioPages() {
    const final = new Map(finalReviewDays(s, nieTemario).flatMap((f) => f.chapters.map((c) => [c, f.date] as const)))
    const halves = [nieGroups.slice(0, 6), nieGroups.slice(6)]
    return (
      <>
        {halves.map((groups, hi) => (
          <Page key={hi} title={`Temario NIE${hi ? ' (cont.)' : ''}: 10 pasos + repasos`} subtitle={hi ? undefined : <>Rellena un círculo por paso: {nieTemario.method.map((m) => `${CIRCLED[m.n - 1]} ${m.name}`).join(' · ')}. Repasos desde el día real del paso ⑩: {NIE_OFFSETS.map((o) => `+${o}`).join(' ')} días.</>}>
            <table className="w-full border-collapse text-[8.5px]">
              <thead>
                <tr className="border-b border-slate-500 text-left">
                  <th className="py-0.5">Capítulo</th><th>h</th><th>Previsto</th><th>Pasos ①–⑩</th><th>Fin ⑩</th><th>Repasos</th><th>Final</th><th>Conf.</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const gi = nieGroups.indexOf(g)
                  return [
                    <tr key={`g${gi}`}><td colSpan={8} className="bg-slate-100 pt-1 font-bold">Grupo {gi + 1}</td></tr>,
                    ...g.map((c) => {
                      const meta = nieChapterMeta(c)!
                      const r = plan.nieRanges.get(c)
                      return (
                        <tr key={c} className="border-b border-slate-200">
                          <td className="py-1 pr-1"><b>{c}</b> {meta.title}{meta.note && <span className="block text-[7.5px] text-amber-700">🏅 {meta.note}</span>}</td>
                          <td>{meta.totalHours}</td>
                          <td className="whitespace-nowrap">{r ? `${fmtShort(r[0])}–${fmtShort(r[1])}` : ''}</td>
                          <td className="whitespace-nowrap text-[13px] leading-none tracking-tighter">{"○".repeat(10)}</td>
                          <td>__/__</td>
                          <td className="whitespace-nowrap">{NIE_OFFSETS.map((o) => <span key={o} className="mr-0.5 inline-flex items-center gap-px"><Box />{o}</span>)}</td>
                          <td className="whitespace-nowrap"><Box /> {final.has(c) ? fmtShort(final.get(c)!) : ''}</td>
                          <td>1 2 3 4 5</td>
                        </tr>
                      )
                    }),
                  ]
                })}
              </tbody>
            </table>
          </Page>
        ))}
      </>
    )
  }

  // ---------------------------------------------------------------- pre-academia
  function PreAcademyChecklist() {
    const rows = preAcademyOrder.map((id) => ({ id, date: plan.lessonDates.get(id), ref: lessonRef(id) }))
    return (
      <Page title="Pre-academia: checklist" subtitle="En el orden del plan. Marca cada lección al terminarla (la app programa sus repasos).">
        <div className="columns-2 gap-4 text-[9px]">
          {rows.map((r) => (
            <div key={r.id} className="flex items-start gap-1 border-b border-dotted border-slate-300 py-0.5" style={{ breakInside: 'avoid' }}>
              <Box /> <span className="w-10 shrink-0 text-slate-500">{r.date ? fmtShort(r.date) : ''}</span>
              <span><b>{r.ref?.lesson.code}</b> {r.ref?.lesson.title}</span>
            </div>
          ))}
        </div>
      </Page>
    )
  }

  // ---------------------------------------------------------------- academia
  function AcademySheet() {
    return (
      <Page title="Hoja diaria de academia" subtitle="Imprime muchas. 1 h – 1 h 30 de estudio de la academia (L–V) con este diario.">
        <div className="grid grid-cols-2 gap-x-4">
          <Line label="Fecha:" />
          <Line label="Semana nº / módulo:" />
        </div>
        <div className="mt-3 text-[11px] font-bold uppercase">5 ideas clave de hoy</div>
        {[1, 2, 3, 4, 5].map((n) => <Line key={n} label={`${n}.`} />)}
        <div className="mt-3 text-[11px] font-bold uppercase">Dudas (pregúntalas mañana)</div>
        <Line /><Line /><Line />
        <div className="mt-3 text-[11px] font-bold uppercase">Términos nuevos → glosario / flashcards</div>
        <Line /><Line /><Line />
        <div className="mt-3 text-[11px] font-bold uppercase">Relación con el NIE (capítulos)</div>
        <Line /><Line />
        <div className="mt-3 flex flex-wrap gap-4 text-[10px]">
          <span className="flex items-center gap-1"><Box /> Flashcards creadas</span>
          <span className="flex items-center gap-1"><Box /> Repaso +1 día</span>
          <span className="flex items-center gap-1"><Box /> Repaso +7 días</span>
          <span className="flex items-center gap-1"><Box /> Pasado a la app</span>
        </div>
      </Page>
    )
  }

  // ---------------------------------------------------------------- errores
  function ErrorsPage() {
    return (
      <Page title="Registro de errores" subtitle={<>Tipos: {ERROR_TYPES.map((e, i) => `${i + 1} = ${e.label}`).join(' · ')}</>}>
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr className="border-b border-slate-500 text-left"><th className="w-12">Fecha</th><th className="w-12">Cap.</th><th className="w-10">Tipo</th><th>Lo que puse / por qué fallé</th><th>Regla correcta</th><th className="w-10">Repas.</th></tr>
          </thead>
          <tbody>
            {Array.from({ length: 24 }, (_, i) => (
              <tr key={i} className="h-7 border-b border-slate-300"><td /><td /><td /><td /><td /><td><Box /></td></tr>
            ))}
          </tbody>
        </table>
      </Page>
    )
  }

  // ---------------------------------------------------------------- simulacros
  function MocksPage() {
    const rows = mockRows(s, nieTemario.mocks, [])
    return (
      <Page title="Tests y simulacros" subtitle="Aprobado NIE: 55,7 % (39 de 70 puntuables). Apunta aciertos, calcula el % y compáralo con tu objetivo.">
        <table className="w-full border-collapse text-[9.5px]">
          <thead>
            <tr className="border-b border-slate-500 text-left"><th>Fecha</th><th>Tipo</th><th>Material</th><th>Preg.</th><th>Min</th><th>Aciertos</th><th>%</th><th>Obj.</th><th>≥ 55,7 %</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date} className="h-7 border-b border-slate-300">
                <td className="whitespace-nowrap font-semibold">{d2(r.date)}</td><td>{r.type}</td><td>{r.material}</td><td>{r.questions}</td><td>{r.minutes}</td><td>____</td><td>____</td><td>{r.targetPercent} %</td><td><Box /></td>
              </tr>
            ))}
            <tr className="h-7 border-b border-slate-300"><td className="font-semibold text-rose-700">{d2(s.examDate)}</td><td colSpan={8} className="font-semibold text-rose-700">EXAMEN NIE{s.examConfirmed ? '' : ' (estimado)'} · 80 preguntas · 120 min</td></tr>
          </tbody>
        </table>
        <div className="mt-4 text-[11px] font-bold uppercase">Tests por capítulo / extra</div>
        <table className="mt-1 w-full border-collapse text-[9.5px]">
          <thead><tr className="border-b border-slate-500 text-left"><th>Fecha</th><th>Capítulo / partes</th><th>Preg.</th><th>Aciertos</th><th>%</th><th>Notas</th></tr></thead>
          <tbody>{Array.from({ length: 14 }, (_, i) => <tr key={i} className="h-7 border-b border-slate-300"><td /><td /><td /><td /><td /><td /></tr>)}</tbody>
        </table>
      </Page>
    )
  }

  // ---------------------------------------------------------------- fitness
  function FitnessPage() {
    const saturdays: ISODate[] = []
    if (weighIn && fitnessStart)
      for (let d = fitnessStart; d <= s.examDate; d = addDays(d, 1)) if (weekday(d) === weighIn.weekday) saturdays.push(d)
    return (
      <Page title="Fitness: semana tipo, peso y bleep test" subtitle={`Desde el ${fitnessStart ? d2(fitnessStart) : ''}. Pérdida de peso sana (NHS): 0,5–1 kg por semana.`}>
        <table className="w-full border-collapse text-[10px]">
          <tbody>
            {fitnessWeek.map((w) => (
              <tr key={w.day} className="border-b border-slate-300">
                <td className="w-20 py-1 font-semibold">{['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][w.day]}</td>
                <td>{w.items.map((i) => i.label).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase">⚖️ Peso (sábados, en ayunas)</div>
            <table className="mt-1 w-full border-collapse text-[9px]">
              <thead><tr className="border-b border-slate-500 text-left"><th>Fecha</th><th>kg</th><th>Cambio</th></tr></thead>
              <tbody>{saturdays.map((d) => <tr key={d} className="h-[15px] border-b border-slate-200"><td>{d2(d)}</td><td /><td /></tr>)}</tbody>
            </table>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase">🏃 Bleep test (objetivo {BLEEP_TARGET_LEVEL.level}.{BLEEP_TARGET_LEVEL.shuttle})</div>
            <table className="mt-1 w-full border-collapse text-[9px]">
              <thead><tr className="border-b border-slate-500 text-left"><th>Fecha</th><th>Nivel</th><th>Notas</th></tr></thead>
              <tbody>{Array.from({ length: 14 }, (_, i) => <tr key={i} className="h-5 border-b border-slate-200"><td /><td /><td /></tr>)}</tbody>
            </table>
            <div className="mt-3 text-[11px] font-bold uppercase">Mi plan de gym (cuando lo tenga)</div>
            <Line /><Line /><Line /><Line /><Line />
          </div>
        </div>
      </Page>
    )
  }
}
