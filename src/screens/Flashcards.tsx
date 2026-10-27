import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCardQueue, useToday } from '../lib/hooks'
import { gradeCard } from '../lib/actions'
import { subjectName } from '../lib/content'
import { GRADE_LABELS, type Grade } from '../lib/sm2'
import { Button, Card, Empty, PageHeader, ProgressBar } from '../components/ui'

const GRADE_STYLE: Record<Grade, string> = {
  forgot: 'bg-rose-600 hover:bg-rose-500',
  doubt: 'bg-amber-500 hover:bg-amber-400',
  know: 'bg-emerald-600 hover:bg-emerald-500',
}

/** Sesión de flashcards: las que tocan hoy + nuevas (límite en Ajustes). */
export function Flashcards() {
  const { subjectId } = useParams()
  const today = useToday()
  const data = useCardQueue(subjectId)
  const [session, setSession] = useState<string[] | null>(null)
  const [i, setI] = useState(0)
  const [shown, setShown] = useState(false)
  const [showEs, setShowEs] = useState(false)
  const [stats, setStats] = useState({ know: 0, doubt: 0, forgot: 0 })

  // la sesión se fija al empezar (para que no cambie mientras respondes)
  useEffect(() => {
    if (data && !session) setSession([...data.due, ...data.fresh])
  }, [data, session])

  const title = subjectId ? subjectName(subjectId) : 'Flashcards de hoy'
  if (!data || !session) return <PageHeader title={title} back />

  const card = data.cards.find((c) => c.id === session[i])
  const finished = i >= session.length

  async function answer(g: Grade) {
    await gradeCard(session![i], g, today)
    setStats((s) => ({ ...s, [g]: s[g] + 1 }))
    // "No lo sé" → la vuelves a ver al final de esta sesión
    if (g === 'forgot') setSession((s) => [...s!, s![i]])
    setI(i + 1)
    setShown(false)
    setShowEs(false)
  }

  return (
    <div>
      <PageHeader title={title} subtitle={`${data.due.length} para repasar · ${data.fresh.length} nuevas · ${data.reviewedToday} vistas hoy`} back />
      {!session.length ? (
        <Empty>
          {data.cards.length ? '¡Nada pendiente hoy! 🎉 Vuelve mañana.' : 'Todavía no hay flashcards aquí. Las de las lecciones llegan en la Fase 3; puedes crear las tuyas en cada asignatura.'}
        </Empty>
      ) : finished ? (
        <Card className="text-center">
          <div className="text-4xl">🎉</div>
          <h2 className="mt-2 text-lg font-bold">Sesión terminada</h2>
          <p className="mt-1 text-sm text-slate-500">
            Lo sé: {stats.know} · Dudo: {stats.doubt} · No lo sé: {stats.forgot}
          </p>
          <Link to="/" className="mt-4 inline-block font-semibold text-indigo-600 dark:text-indigo-300">Volver a Hoy</Link>
        </Card>
      ) : (
        card && (
          <div>
            <ProgressBar pct={(i / session.length) * 100} className="mb-3" />
            <button
              onClick={() => setShown(true)}
              className="flex min-h-64 w-full flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="text-xs uppercase tracking-wider text-slate-400">{subjectName(card.subjectId)}</div>
              <div className="mt-3 whitespace-pre-line text-xl font-semibold">{card.front}</div>
              {shown ? (
                <div className="mt-6 w-full border-t border-slate-200 pt-4 dark:border-slate-700">
                  <div className="whitespace-pre-line text-lg text-indigo-700 dark:text-indigo-300">{card.back}</div>
                </div>
              ) : (
                <div className="mt-6 text-sm text-slate-400">Toca para ver la respuesta</div>
              )}
            </button>
            {shown && card.es && (
              <div className="mt-2 text-center">
                <button onClick={() => setShowEs(!showEs)} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                  🇪🇸 {showEs ? 'Ocultar' : 'Ver en español'}
                </button>
                {showEs && <p className="mt-2 text-sm">{card.es}</p>}
              </div>
            )}
            {shown ? (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(['forgot', 'doubt', 'know'] as Grade[]).map((g) => (
                  <button key={g} onClick={() => answer(g)} className={`rounded-2xl py-3 font-semibold text-white ${GRADE_STYLE[g]}`}>
                    {GRADE_LABELS[g]}
                  </button>
                ))}
              </div>
            ) : (
              <Button className="mt-4 w-full py-3" onClick={() => setShown(true)}>Mostrar respuesta</Button>
            )}
            <p className="mt-3 text-center text-xs text-slate-500">{i + 1} / {session.length}</p>
          </div>
        )
      )}
    </div>
  )
}
