import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { findFolder, findSubject, lessonMarkdown, structure } from '../lib/content'
import { folderProgress, subjectProgress } from '../lib/progress'
import { useDoneLessons, usePlan, useToday } from '../lib/hooks'
import { fmtShort } from '../lib/dates'
import { Card, Empty, PageHeader, Pill, ProgressBar, RowLink } from '../components/ui'

export function Folders() {
  const done = useDoneLessons()
  return (
    <div>
      <PageHeader title="Carpetas" subtitle="Carpetas → asignaturas → lecciones" />
      <div className="space-y-3">
        {structure.folders.map((f) => {
          const p = folderProgress(f, done)
          return (
            <RowLink key={f.id} to={`/carpetas/${f.id}`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden>{f.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{f.name}</div>
                  <div className="text-xs text-slate-500">
                    {f.subjects.length} asignaturas · {p.done}/{p.total} lecciones
                  </div>
                  <ProgressBar pct={p.pct} color={f.color} className="mt-2" />
                </div>
                <div className="text-lg font-bold">{p.pct}%</div>
              </div>
            </RowLink>
          )
        })}
      </div>
    </div>
  )
}

/** Herramientas extra de cada carpeta (diario de academia, simulacros, registros de fitness…). */
const FOLDER_TOOLS: Record<string, { to: string; label: string; desc: string }[]> = {
  academy: [{ to: '/academia', label: '📓 Diario, módulos y assessments', desc: 'Registro de cada día de curso' }],
  nie: [
    { to: '/nie/capitulos', label: '🗂️ Estado de los 43 capítulos', desc: 'Pendiente → En curso → Estudiado → En repaso → Final' },
    { to: '/nie/simulacros', label: '⏱️ Tests acumulados y simulacros', desc: 'Modo examen de 120 min' },
  ],
  fitness: [{ to: '/fitness', label: '📊 Registros: peso, entrenos, bleep, hábitos', desc: 'Plan semanal y gráficas' }],
}

export function FolderView() {
  const { folderId = '' } = useParams()
  const folder = findFolder(folderId)
  const done = useDoneLessons()
  if (!folder) return <Empty>Carpeta no encontrada.</Empty>
  const p = folderProgress(folder, done)
  return (
    <div>
      <PageHeader title={`${folder.emoji} ${folder.name}`} subtitle={`${p.pct}% · ${p.done}/${p.total} lecciones`} back="/carpetas" />
      {FOLDER_TOOLS[folder.id] && (
        <div className="mb-4 space-y-2">
          {FOLDER_TOOLS[folder.id].map((t) => (
            <RowLink key={t.to} to={t.to}>
              <div className="font-semibold">{t.label}</div>
              <div className="text-xs text-slate-500">{t.desc}</div>
            </RowLink>
          ))}
        </div>
      )}
      <div className="space-y-3">
        {folder.subjects.map((s) => {
          const sp = subjectProgress(s, done)
          return (
            <RowLink key={s.id} to={`/asignatura/${s.id}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-slate-500">{sp.done}/{sp.total} lecciones</div>
                </div>
                <div className="font-bold">{sp.pct}%</div>
              </div>
              <ProgressBar pct={sp.pct} color={folder.color} className="mt-2" />
            </RowLink>
          )
        })}
      </div>
    </div>
  )
}

export function SubjectView() {
  const { subjectId = '' } = useParams()
  const found = findSubject(subjectId)
  const done = useDoneLessons()
  const plan = usePlan()
  const today = useToday()
  const progress = useLiveQuery(() => db.lessonProgress.toArray(), [])
  if (!found) return <Empty>Asignatura no encontrada.</Empty>
  const { subject, folder } = found
  const sp = subjectProgress(subject, done)
  const completedAt = new Map((progress ?? []).map((p) => [p.lessonId, p.completedAt]))

  return (
    <div>
      <PageHeader title={subject.name} subtitle={`${folder.emoji} ${folder.name} · ${sp.pct}%`} back={`/carpetas/${folder.id}`} />
      <Card className="mb-4">
        <ProgressBar pct={sp.pct} color={folder.color} />
        <p className="mt-2 text-xs text-slate-500">Flashcards y tests de la asignatura: llegan en la Fase 2.</p>
      </Card>
      <ol className="space-y-2">
        {subject.lessons.map((l, i) => {
          const planned = plan.lessonDates.get(l.id)
          const isDone = done.has(l.id)
          const late = !isDone && planned && planned < today
          const written = !!lessonMarkdown(l.id)
          return (
            <li key={l.id}>
              <Link
                to={`/leccion/${l.id}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  {isDone ? '✓' : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{l.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    <Pill>{l.code}</Pill>
                    {planned && <Pill tone={late ? 'red' : 'indigo'}>{late ? 'atrasada · ' : ''}{fmtShort(planned)}</Pill>}
                    {isDone && <Pill tone="green">hecha {fmtShort(completedAt.get(l.id)!)}</Pill>}
                    {!written && <Pill tone="amber">por escribir</Pill>}
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
