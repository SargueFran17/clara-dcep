import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { allLessons } from '../lib/content'
import { acronyms, glossary } from '../lib/glossary'
import { norm } from '../lib/text'
import { Empty, PageHeader, RowLink } from '../components/ui'

const ITEMS = [
  { to: '/ajustes', label: '⚙️ Ajustes', desc: 'Fechas clave, tema, copia de seguridad' },
  { to: '/buscar', label: '🔍 Buscador', desc: 'Lecciones, glosario y acrónimos' },
  { to: '/flashcards', label: '🃏 Flashcards de hoy', desc: 'Todas las asignaturas' },
  { to: '/academia', label: '📓 Academia', desc: 'Diario, módulos, assessments' },
  { to: '/nie/capitulos', label: '⚖️ NIE: capítulos', desc: 'Estado de los 43 capítulos' },
  { to: '/nie/simulacros', label: '⏱️ NIE: simulacros', desc: 'Tests acumulados y modo examen' },
  { to: '/errores', label: '❌ Registro de errores', desc: 'Fallos por tipo y regla correcta' },
  { to: '/glosario', label: '📖 Glosario y acrónimos', desc: 'EN → inglés sencillo → ES' },
  { to: '/fitness', label: '💪 Fitness', desc: 'Peso, entrenos, bleep, hábitos' },
]

export function More() {
  return (
    <div>
      <PageHeader title="Más" />
      <div className="space-y-2">
        {ITEMS.map((i) => (
          <RowLink key={i.to} to={i.to}>
            <div className="font-semibold">{i.label}</div>
            <div className="text-xs text-slate-500">{i.desc}</div>
          </RowLink>
        ))}
      </div>
    </div>
  )
}


export function Search() {
  const [q, setQ] = useState('')
  const n = norm(q)
  const results = useMemo(() => (n.length < 2 ? [] : allLessons().filter((r) => norm(`${r.lesson.code} ${r.lesson.title} ${r.subject.name}`).includes(n)).slice(0, 30)), [n])
  const terms = useMemo(() => (n.length < 2 ? [] : glossary.filter((t) => norm(`${t.term} ${t.plain} ${t.es}`).includes(n)).slice(0, 20)), [n])
  const acrs = useMemo(() => (n.length < 2 ? [] : acronyms.filter((a) => norm(`${a.acronym} ${a.full} ${a.es}`).includes(n)).slice(0, 10)), [n])
  return (
    <div>
      <PageHeader title="Buscar" back />
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Lecciones, glosario y acrónimos: caution, 1.7, custodia, PACE…"
        className="mb-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
      />
      <div className="space-y-2">
        {results.map((r) => (
          <Link key={r.lesson.id} to={`/leccion/${r.lesson.id}`} className="block rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-medium">{r.lesson.code} · {r.lesson.title}</div>
            <div className="text-xs text-slate-500">{r.folder.emoji} {r.subject.name}</div>
          </Link>
        ))}
        {acrs.map((a) => (
          <div key={a.acronym} className="rounded-2xl border border-indigo-200 bg-white p-3 dark:border-indigo-900 dark:bg-slate-900">
            <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{a.acronym} · <span className="font-medium">{a.full}</span></div>
            <div className="text-xs text-slate-500">{a.plain} · 🇪🇸 {a.es}</div>
          </div>
        ))}
        {terms.map((t) => (
          <div key={t.term} className="rounded-2xl border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-slate-900">
            <div className="text-sm font-semibold">📖 {t.term}</div>
            <div className="text-xs">{t.plain}</div>
            <div className="text-xs text-amber-700 dark:text-amber-400">🇪🇸 {t.es}</div>
          </div>
        ))}
        {n.length >= 2 && !results.length && !terms.length && !acrs.length && <Empty>Sin resultados.</Empty>}
      </div>
    </div>
  )
}
