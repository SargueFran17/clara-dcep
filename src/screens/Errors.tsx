import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useAllQuestions, useToday } from '../lib/hooks'
import { ERROR_TYPES } from '../lib/errors'
import { saveError } from '../lib/actions'
import { findSubject, structure } from '../lib/content'
import { fmtShort } from '../lib/dates'
import { Button, Card, Empty, PageHeader, Pill } from '../components/ui'
import type { ErrorEntry, ErrorType } from '../types'

const input = 'w-full rounded-xl border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900'
const subjects = structure.folders.flatMap((f) => f.subjects.map((s) => ({ id: s.id, name: `${f.emoji} ${s.name}` })))

/** Registro global de errores: filtra por tipo/asignatura, edita la regla, añade errores a mano. */
export function Errors() {
  const errors = useLiveQuery(() => db.errors.orderBy('date').reverse().toArray(), [])
  const questions = useAllQuestions()
  const [type, setType] = useState<ErrorType | 'all'>('all')
  const [subject, setSubject] = useState('all')
  const [adding, setAdding] = useState(false)

  const list = (errors ?? []).filter((e) => (type === 'all' || e.type === type) && (subject === 'all' || e.subjectId === subject))
  const usedSubjects = subjects.filter((s) => (errors ?? []).some((e) => e.subjectId === s.id))

  return (
    <div>
      <PageHeader title="Registro de errores" subtitle={`${errors?.length ?? 0} errores`} back right={<Button onClick={() => setAdding(!adding)}>{adding ? 'Cerrar' : '+ Añadir'}</Button>} />
      {adding && <ManualError onDone={() => setAdding(false)} />}

      <div className="mb-2 flex flex-wrap gap-1.5">
        <button onClick={() => setType('all')} className={`rounded-full px-3 py-1 text-xs font-medium ${type === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
          Todos ({errors?.length ?? 0})
        </button>
        {ERROR_TYPES.map((t) => (
          <button key={t.id} onClick={() => setType(t.id)} className={`rounded-full px-3 py-1 text-xs font-medium ${type === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
            {t.label} ({(errors ?? []).filter((e) => e.type === t.id).length})
          </button>
        ))}
      </div>
      {usedSubjects.length > 1 && (
        <select value={subject} onChange={(e) => setSubject(e.target.value)} className={`${input} mb-3`}>
          <option value="all">Todas las asignaturas</option>
          {usedSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      <div className="space-y-2">
        {list.map((e) => (
          <ErrorCard key={e.id} e={e} question={questions?.find((q) => q.id === e.questionId)?.scenario} />
        ))}
        {!list.length && <Empty>Nada por aquí. Los fallos de los tests se apuntan desde la propia pregunta.</Empty>}
      </div>
    </div>
  )
}

function ErrorCard({ e, question }: { e: ErrorEntry; question?: string }) {
  const [editing, setEditing] = useState(false)
  const [rule, setRule] = useState(e.rule)
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-1">
        <Pill tone="red">{ERROR_TYPES.find((t) => t.id === e.type)?.label}</Pill>
        <Pill>{e.chapter ? `NIE ${e.chapter}` : findSubject(e.subjectId)?.subject.name}</Pill>
        <span className="ml-auto text-xs text-slate-500">{fmtShort(e.date)}</span>
      </div>
      {(question || e.note) && (
        <button onClick={() => setOpen(!open)} className={`mt-2 block text-left text-xs text-slate-500 ${open ? '' : 'line-clamp-2'}`}>
          {question ?? e.note}
        </button>
      )}
      {editing ? (
        <div className="mt-2">
          <textarea className={input} rows={3} value={rule} onChange={(ev) => setRule(ev.target.value)} />
          <div className="mt-2 flex gap-2">
            <Button onClick={async () => { await saveError({ ...e, rule }); setEditing(false) }}>Guardar</Button>
            <Button variant="danger" onClick={() => confirm('¿Borrar este error?') && db.errors.delete(e.id!)}>Borrar</Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="mt-2 block w-full text-left text-sm font-medium">
          ✅ {e.rule}
        </button>
      )}
    </Card>
  )
}

function ManualError({ onDone }: { onDone: () => void }) {
  const today = useToday()
  const [subjectId, setSubjectId] = useState('nie-p1')
  const [chapter, setChapter] = useState('')
  const [type, setType] = useState<ErrorType>('concept')
  const [note, setNote] = useState('')
  const [rule, setRule] = useState('')
  return (
    <Card className="mb-4 space-y-2">
      <p className="text-xs text-slate-500">Para fallos de libros de preguntas, de la academia o de cualquier sitio (escribe la idea con tus palabras, no copies el texto).</p>
      <select className={input} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
        {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {subjectId.startsWith('nie-p') && <input className={input} placeholder="Capítulo (p. ej. 1.7)" value={chapter} onChange={(e) => setChapter(e.target.value)} />}
      <select className={input} value={type} onChange={(e) => setType(e.target.value as ErrorType)}>
        {ERROR_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <textarea className={input} rows={2} placeholder="¿Qué pasó? (resumen de la pregunta)" value={note} onChange={(e) => setNote(e.target.value)} />
      <textarea className={input} rows={2} placeholder="La regla correcta" value={rule} onChange={(e) => setRule(e.target.value)} />
      <Button
        disabled={!rule.trim()}
        onClick={async () => {
          await saveError({ date: today, questionId: '', subjectId, chapter: chapter.trim() || undefined, type, note: note.trim(), rule: rule.trim() })
          onDone()
        }}
      >
        Guardar
      </Button>
    </Card>
  )
}
