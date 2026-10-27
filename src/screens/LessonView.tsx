import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { lessonMarkdown, lessonRef } from '../lib/content'
import { completeLesson, uncompleteLesson } from '../lib/actions'
import { useAllQuestions, usePlan, useToday } from '../lib/hooks'
import { fmtUK } from '../lib/dates'
import { stripFrontmatter } from '../lib/markdown'
import { stepLabel } from '../lib/srs'
import { Markdown } from '../components/Markdown'
import { Button, Card, Empty, PageHeader, Pill } from '../components/ui'

export function LessonView() {
  const { lessonId = '' } = useParams()
  const ref = lessonRef(lessonId)
  const today = useToday()
  const plan = usePlan()
  const progress = useLiveQuery(() => db.lessonProgress.get(lessonId), [lessonId])
  const reviews = useLiveQuery(() => db.reviews.where('itemKey').equals(`lesson:${lessonId}`).sortBy('due'), [lessonId])
  const questions = useAllQuestions()
  if (!ref) return <Empty>Lección no encontrada.</Empty>
  const nQuestions = questions?.filter((q) => q.lessonId === lessonId || (lessonId.startsWith('nie-') && q.chapter === lessonId.slice(4))).length ?? 0

  const { lesson, subject, folder } = ref
  const md = lessonMarkdown(lessonId)
  const { body, meta } = md ? stripFrontmatter(md) : { body: '', meta: {} as Record<string, string> }
  const planned = plan.lessonDates.get(lessonId)
  const range = lessonId.startsWith('nie-') ? plan.nieRanges.get(lessonId.slice(4)) : undefined
  const next = reviews?.find((r) => !r.doneAt)
  const doneReviews = reviews?.filter((r) => r.doneAt).length ?? 0

  return (
    <div>
      <PageHeader title={lesson.title} subtitle={`${folder.emoji} ${subject.name}`} back={`/asignatura/${subject.id}`} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Pill>{lesson.code}</Pill>
        {range ? (
          <Pill tone="indigo">1ª vuelta: {fmtUK(range[0])} – {fmtUK(range[1])}</Pill>
        ) : (
          planned && <Pill tone="indigo">Planificada: {fmtUK(planned)}</Pill>
        )}
        {progress && <Pill tone="green">Terminada el {fmtUK(progress.completedAt)}</Pill>}
        {next && <Pill tone={next.due < today ? 'red' : 'amber'}>Próximo repaso {stepLabel(next.step)}: {fmtUK(next.due)}</Pill>}
        {doneReviews > 0 && <Pill tone="green">{doneReviews} repasos hechos</Pill>}
        {meta.manualRef && <Pill tone="amber">📘 {meta.manualRef}</Pill>}
      </div>

      {subject.nie && (
        <Card className="mb-4 border-rose-200 dark:border-rose-900">
          <p className="text-sm">
            ⚠ Las explicaciones son mías y remiten al manual: <b>comprueba siempre con tu edición 2027 del Blackstone's</b>.
          </p>
          <Link to={`/nie/capitulo/${lesson.code}`} className="mt-2 inline-block rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white">
            ✅ Checklist de 10 pasos, grabadora y resumen →
          </Link>
        </Card>
      )}

      {lesson.links?.length ? (
        <Card className="mb-4">
          <div className="mb-1 text-xs font-bold uppercase text-slate-500">Relacionado</div>
          <ul className="space-y-1 text-sm">
            {lesson.links.map((id) => (
              <li key={id}>
                <Link className="text-indigo-600 hover:underline dark:text-indigo-300" to={`/leccion/${id}`}>
                  → {lessonRef(id)?.lesson.code} · {lessonRef(id)?.lesson.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {md ? (
        <Card>
          <Markdown text={body} />
        </Card>
      ) : (
        <Empty>
          Esta lección todavía no está escrita. Se añadirá en las Fases 3–4 en <code>content/lessons/{folder.id}/{subject.id}/{lesson.id}.md</code>.
        </Empty>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link to={`/test?lesson=${lessonId}&n=5`} className="rounded-2xl bg-emerald-600 p-3 text-center text-sm font-semibold text-white">
          📝 Mini-test ({Math.min(5, nQuestions)})
        </Link>
        <Link to={`/flashcards/${subject.id}`} className="rounded-2xl bg-indigo-600 p-3 text-center text-sm font-semibold text-white">
          🃏 Flashcards
        </Link>
      </div>

      <div className="mt-6 flex justify-center">
        {subject.nie ? null : progress ? (
          <Button variant="ghost" onClick={() => uncompleteLesson(lessonId)}>
            Marcar como no terminada
          </Button>
        ) : (
          <Button onClick={() => completeLesson(lessonId, today)}>✓ Terminé esta lección (empiezan los repasos)</Button>
        )}
      </div>
    </div>
  )
}
