import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAllQuestions, useToday } from '../lib/hooks'
import { saveAttempt } from '../lib/actions'
import { findSubject, lessonRef } from '../lib/content'
import { pickBalanced, scoreAnswers } from '../lib/exam'
import { PASS_MARK } from '../lib/defaults'
import { QuestionView } from '../components/QuestionView'
import { ErrorForm } from '../components/ErrorForm'
import { Button, Card, Empty, PageHeader, ProgressBar } from '../components/ui'
import type { Question } from '../types'

/**
 * Mini-test con corrección inmediata.
 * /test?lesson=vo-1 · /test?subject=vo · /test?chapter=1.3 · &n=10
 */
export function Practice() {
  const [params] = useSearchParams()
  const lesson = params.get('lesson')
  const subject = params.get('subject')
  const chapter = params.get('chapter')
  const n = Number(params.get('n') ?? 5)
  const today = useToday()
  const all = useAllQuestions()
  const [qs, setQs] = useState<Question[] | null>(null)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [i, setI] = useState(0)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!all || qs) return
    const pool = all.filter((q) =>
      lesson ? q.lessonId === lesson || (lesson.startsWith('nie-') && q.chapter === lesson.slice(4)) : chapter ? q.chapter === chapter : subject ? q.subjectId === subject : true,
    )
    const picked = pickBalanced(pool, n)
    setQs(picked)
    setAnswers(picked.map(() => null))
  }, [all, qs, lesson, subject, chapter, n])

  const title = lesson ? `Mini-test · ${lessonRef(lesson)?.lesson.code}` : chapter ? `Test · capítulo ${chapter}` : subject ? `Test · ${findSubject(subject)?.subject.name}` : 'Test'
  const done = !!qs && i >= qs.length
  const score = qs && scoreAnswers(qs, answers)

  useEffect(() => {
    if (done && qs?.length && !saved) {
      setSaved(true)
      saveAttempt({
        date: today, kind: 'mini', subjectId: subject ?? lessonRef(lesson ?? '')?.subject.id, total: score!.total, correct: score!.correct, byPart: score!.byPart,
        answers: qs.map((q, k) => ({ questionId: q.id, chosen: answers[k], correct: q.correct })),
      })
    }
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!qs) return <PageHeader title={title} back />
  if (!qs.length)
    return (
      <div>
        <PageHeader title={title} back />
        <Empty>Aún no hay preguntas aquí. Las escribo en las Fases 3–4, y puedes añadir las tuyas desde la asignatura.</Empty>
      </div>
    )

  if (done)
    return (
      <div>
        <PageHeader title={title} back />
        <Card className="text-center">
          <div className="text-5xl font-bold">{score!.pct}%</div>
          <p className="mt-1 text-slate-500">{score!.correct} / {score!.total} correctas</p>
          <p className={`mt-2 text-sm font-semibold ${score!.pct >= PASS_MARK ? 'text-emerald-600' : 'text-rose-600'}`}>
            {score!.pct >= PASS_MARK ? 'Por encima' : 'Por debajo'} del aprobado NIE ({PASS_MARK.toLocaleString('es-ES')} %)
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="ghost" onClick={() => { setQs(null); setI(0); setSaved(false) }}>Otra vez</Button>
            <Link to="/errores" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Registro de errores</Link>
          </div>
        </Card>
      </div>
    )

  const q = qs[i]
  const chosen = answers[i]
  return (
    <div>
      <PageHeader title={title} subtitle={`Pregunta ${i + 1} de ${qs.length}`} back />
      <ProgressBar pct={(i / qs.length) * 100} className="mb-4" />
      <Card>
        <QuestionView q={q} chosen={chosen} reveal={chosen !== null} onChoose={(c) => setAnswers(answers.map((a, k) => (k === i ? c : a)))} />
        {chosen !== null && chosen !== q.correct && <ErrorForm key={q.id} question={q} chosen={chosen} />}
      </Card>
      {chosen !== null && (
        <Button className="mt-4 w-full py-3" onClick={() => setI(i + 1)}>
          {i + 1 < qs.length ? 'Siguiente →' : 'Ver resultado'}
        </Button>
      )}
    </div>
  )
}
