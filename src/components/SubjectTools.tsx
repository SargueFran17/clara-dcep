import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db'
import { useAllQuestions, useCardQueue } from '../lib/hooks'
import { findSubject } from '../lib/content'
import { Button, Card } from './ui'

const input = 'w-full rounded-xl border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900'
const LETTERS = ['A', 'B', 'C', 'D']

/** Flashcards y tests de una asignatura + formularios para añadir las tuyas. */
export function SubjectTools({ subjectId }: { subjectId: string }) {
  const queue = useCardQueue(subjectId)
  const questions = useAllQuestions()?.filter((q) => q.subjectId === subjectId)
  const [form, setForm] = useState<'card' | 'question' | null>(null)
  const pending = (queue?.due.length ?? 0) + (queue?.fresh.length ?? 0)

  return (
    <Card className="mb-4">
      <div className="grid grid-cols-2 gap-2">
        <Link to={`/flashcards/${subjectId}`} className="rounded-2xl bg-indigo-50 p-3 dark:bg-indigo-950/40">
          <div className="font-semibold">🃏 Flashcards</div>
          <div className="text-xs text-slate-500">{queue?.cards.length ?? 0} en total · {pending} para hoy</div>
        </Link>
        <Link to={`/test?subject=${subjectId}&n=10`} className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-950/40">
          <div className="font-semibold">📝 Test</div>
          <div className="text-xs text-slate-500">{questions?.length ?? 0} preguntas · 10 al azar</div>
        </Link>
      </div>
      <div className="mt-3 flex gap-2 text-sm">
        <button className="font-semibold text-indigo-600 dark:text-indigo-300" onClick={() => setForm(form === 'card' ? null : 'card')}>+ Mi flashcard</button>
        <span className="text-slate-300">·</span>
        <button className="font-semibold text-indigo-600 dark:text-indigo-300" onClick={() => setForm(form === 'question' ? null : 'question')}>+ Mi pregunta</button>
      </div>
      {form === 'card' && <CardForm subjectId={subjectId} onDone={() => setForm(null)} />}
      {form === 'question' && <QuestionForm subjectId={subjectId} onDone={() => setForm(null)} />}
    </Card>
  )
}

function CardForm({ subjectId, onDone }: { subjectId: string; onDone: () => void }) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  return (
    <div className="mt-3 space-y-2">
      <input className={input} placeholder="Anverso (pregunta / término)" value={front} onChange={(e) => setFront(e.target.value)} />
      <textarea className={input} rows={2} placeholder="Reverso (respuesta)" value={back} onChange={(e) => setBack(e.target.value)} />
      <Button
        disabled={!front.trim() || !back.trim()}
        onClick={async () => {
          await db.userCards.add({ subjectId, front: front.trim(), back: back.trim() })
          onDone()
        }}
      >
        Guardar flashcard
      </Button>
    </div>
  )
}

function QuestionForm({ subjectId, onDone }: { subjectId: string; onDone: () => void }) {
  const subject = findSubject(subjectId)?.subject
  const [chapter, setChapter] = useState(subject?.nie ? subject.lessons[0]?.code ?? '' : '')
  const [scenario, setScenario] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [explanations, setExplanations] = useState(['', '', '', ''])
  const [correct, setCorrect] = useState(0)
  const [manualRef, setManualRef] = useState('')
  const valid = scenario.trim() && options.every((o) => o.trim())
  return (
    <div className="mt-3 space-y-2">
      {subject?.nie && (
        <select className={input} value={chapter} onChange={(e) => setChapter(e.target.value)}>
          {subject.lessons.map((l) => <option key={l.code} value={l.code}>{l.title}</option>)}
        </select>
      )}
      <textarea className={input} rows={3} placeholder="Escenario / pregunta" value={scenario} onChange={(e) => setScenario(e.target.value)} />
      {options.map((o, i) => (
        <div key={i} className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={correct === i} onChange={() => setCorrect(i)} />
            <span className="font-bold">{LETTERS[i]}</span>
            <input className={input} placeholder={`Opción ${LETTERS[i]}`} value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} />
          </label>
          <input className={`${input} mt-1`} placeholder="Por qué es correcta / incorrecta" value={explanations[i]} onChange={(e) => setExplanations(explanations.map((x, j) => (j === i ? e.target.value : x)))} />
        </div>
      ))}
      <p className="text-xs text-slate-500">Marca con el círculo la opción correcta.</p>
      {subject?.nie && <input className={input} placeholder="Referencia del manual (p. ej. §1.3.5)" value={manualRef} onChange={(e) => setManualRef(e.target.value)} />}
      <Button
        disabled={!valid}
        onClick={async () => {
          await db.userQuestions.add({
            subjectId, chapter: chapter || undefined, scenario: scenario.trim(), options: options.map((o) => o.trim()), correct,
            explanations: explanations.map((e) => e.trim()), manualRef: manualRef.trim() || undefined,
          })
          onDone()
        }}
      >
        Guardar pregunta
      </Button>
    </div>
  )
}
