import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { acronyms, glossary } from '../lib/glossary'
import { norm } from '../lib/text'
import { Card, PageHeader } from '../components/ui'

const TOPICS: Record<string, string> = {
  arrest: 'Detención', custody: 'Custodia', evidence: 'Pruebas', court: 'Tribunales', offences: 'Delitos',
  investigation: 'Investigación', thresholds: 'Umbrales', people: 'Personas', procedure: 'Procedimiento',
}

/** Glosario (EN → inglés sencillo → ES) y acrónimos, con buscador, flashcards y tests. */
export function Glossary() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'acronimos' ? 'acronimos' : 'glosario'
  const [q, setQ] = useState('')
  const [topic, setTopic] = useState<string | null>(null)

  const terms = useMemo(() => {
    const n = norm(q)
    return glossary.filter((t) => (!topic || t.topic === topic) && (!n || norm(`${t.term} ${t.plain} ${t.es}`).includes(n))).sort((a, b) => a.term.localeCompare(b.term))
  }, [q, topic])
  const acrs = useMemo(() => {
    const n = norm(q)
    return acronyms.filter((a) => !n || norm(`${a.acronym} ${a.full} ${a.plain} ${a.es}`).includes(n)).sort((a, b) => a.acronym.localeCompare(b.acronym))
  }, [q])

  return (
    <div>
      <PageHeader title="Glosario y acrónimos" subtitle={`${glossary.length} términos · ${acronyms.length} acrónimos`} back />
      <div className="mb-3 flex gap-1">
        {(['glosario', 'acronimos'] as const).map((t) => (
          <button key={t} onClick={() => setParams({ tab: t })} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${tab === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
            {t === 'glosario' ? 'Glosario' : 'Acrónimos'}
          </button>
        ))}
      </div>

      <Card className="mb-3">
        <div className="mb-2 text-sm font-semibold">Practicar</div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link to="/flashcards/ga" className="rounded-full bg-indigo-100 px-3 py-1 font-semibold text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200">🃏 Flashcards</Link>
          {tab === 'glosario'
            ? ['gl-1', 'gl-2', 'gl-3'].map((id, i) => <Link key={id} to={`/test?lesson=${id}&n=15`} className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">Test Glosario {['I', 'II', 'III'][i]}</Link>)
            : ['ac-1', 'ac-2'].map((id, i) => <Link key={id} to={`/test?lesson=${id}&n=15`} className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">Test Acrónimos {['I', 'II'][i]}</Link>)}
          <Link to="/test?subject=ga&n=30" className="rounded-full bg-rose-100 px-3 py-1 font-semibold text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">Test final (30)</Link>
        </div>
      </Card>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en inglés o en español…" className="mb-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900" />

      {tab === 'glosario' ? (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button onClick={() => setTopic(null)} className={`rounded-full px-3 py-1 text-xs font-medium ${!topic ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800'}`}>Todos</button>
            {Object.entries(TOPICS).map(([k, l]) => (
              <button key={k} onClick={() => setTopic(k)} className={`rounded-full px-3 py-1 text-xs font-medium ${topic === k ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800'}`}>{l}</button>
            ))}
          </div>
          <dl className="space-y-2">
            {terms.map((t) => (
              <div key={t.term} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <dt className="font-semibold">{t.term}</dt>
                <dd className="text-sm">{t.plain}</dd>
                <dd className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">🇪🇸 {t.es}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <dl className="space-y-2">
          {acrs.map((a) => (
            <div key={a.acronym} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <dt className="font-bold text-indigo-700 dark:text-indigo-300">{a.acronym}</dt>
              <dd className="text-sm font-medium">{a.full}</dd>
              <dd className="text-sm text-slate-600 dark:text-slate-300">{a.plain}</dd>
              <dd className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">🇪🇸 {a.es}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
