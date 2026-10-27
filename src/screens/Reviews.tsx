import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useToday } from '../lib/hooks'
import { completeReview, undoReview } from '../lib/actions'
import { bucketReviews } from '../lib/reviews'
import { reviewTitle } from '../lib/today'
import { addDays, fmtShort } from '../lib/dates'
import { Check, Empty, PageHeader } from '../components/ui'
import type { Review } from '../types'

/** Repasos espaciados: Atrasados · Hoy · Próximos 7 días. Cada uno se marca con un toque. */
export function Reviews() {
  const today = useToday()
  const reviews = useLiveQuery(
    () => db.reviews.where('due').belowOrEqual(addDays(today, 7)).filter((r) => !r.doneAt || r.doneAt === today).toArray(),
    [today],
  )
  if (!reviews) return <PageHeader title="Repasos" back />
  const b = bucketReviews(reviews, today)
  const sections: { title: string; list: Review[]; tone?: string; empty: string }[] = [
    { title: `Atrasados (${b.overdue.length})`, list: b.overdue, tone: 'text-rose-600', empty: 'Nada atrasado 🎉' },
    { title: `Hoy (${b.today.length})`, list: b.today, empty: 'Hoy no toca ningún repaso.' },
    { title: `Próximos 7 días (${b.next7.length})`, list: b.next7, empty: 'Nada en los próximos 7 días.' },
  ]
  return (
    <div className="space-y-4">
      <PageHeader title="Repasos" subtitle="+1, +3, +7, +30, +60, +90 y +120 días desde que terminas cada capítulo" back="/carpetas/nie" />
      {b.overdue.length > 3 && (
        <p className="text-sm text-slate-500">En Hoy solo te salen los 3 atrasados más antiguos cada día, para no agobiarte. Si te da tiempo, haz más desde aquí.</p>
      )}
      {sections.map((sec) => (
        <section key={sec.title}>
          <h2 className={`mb-2 text-xs font-bold uppercase tracking-wider ${sec.tone ?? 'text-slate-500'}`}>{sec.title}</h2>
          {sec.list.length ? (
            <div className="space-y-2">
              {sec.list.map((r) => <ReviewRow key={r.id} review={r} today={today} />)}
            </div>
          ) : (
            <Empty>{sec.empty}</Empty>
          )}
        </section>
      ))}
    </div>
  )
}

function ReviewRow({ review, today }: { review: Review; today: string }) {
  const t = reviewTitle(review)
  const done = review.doneAt === today
  const future = review.due > today
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <Check checked={done} onChange={(v) => (v ? completeReview(review, today) : undoReview(review))} label={t.title} />
      <div className={`min-w-0 flex-1 ${done ? 'opacity-50' : ''}`}>
        <div className={`text-sm font-medium ${done ? 'line-through' : ''}`}>{t.title}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {t.subtitle}
          {review.due !== today && ` · ${future ? 'toca el' : 'tocaba el'} ${fmtShort(review.due)}`}
        </div>
      </div>
      {t.link && (
        <Link to={t.link} className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800" aria-label="Abrir">→</Link>
      )}
    </div>
  )
}
