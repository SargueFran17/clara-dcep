import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { allLessons } from '../lib/content'
import { Empty, PageHeader, RowLink } from '../components/ui'

const ITEMS = [
  { to: '/ajustes', label: '⚙️ Ajustes', desc: 'Fechas clave, tema, copia de seguridad' },
  { to: '/buscar', label: '🔍 Buscador', desc: 'Lecciones (y glosario en la Fase 3)' },
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

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

export function Search() {
  const [q, setQ] = useState('')
  const results = useMemo(() => {
    const n = norm(q.trim())
    if (n.length < 2) return []
    return allLessons().filter((r) => norm(`${r.lesson.code} ${r.lesson.title} ${r.subject.name}`).includes(n)).slice(0, 50)
  }, [q])
  return (
    <div>
      <PageHeader title="Buscar" back />
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="p. ej. caution, 1.7, custody, rotondas…"
        className="mb-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
      />
      <div className="space-y-2">
        {results.map((r) => (
          <Link key={r.lesson.id} to={`/leccion/${r.lesson.id}`} className="block rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-medium">{r.lesson.code} · {r.lesson.title}</div>
            <div className="text-xs text-slate-500">{r.folder.emoji} {r.subject.name}</div>
          </Link>
        ))}
        {q.trim().length >= 2 && !results.length && <Empty>Sin resultados.</Empty>}
      </div>
    </div>
  )
}

export function ComingSoon({ title, phase }: { title: string; phase: number }) {
  return (
    <div>
      <PageHeader title={title} back />
      <Empty>Esta sección llega en la Fase {phase}.</Empty>
    </div>
  )
}
