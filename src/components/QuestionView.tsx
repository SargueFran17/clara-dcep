import type { Question } from '../types'

const LETTERS = ['A', 'B', 'C', 'D']

/**
 * Una pregunta de opción múltiple.
 * - `reveal` = false: solo se elige (modo examen).
 * - `reveal` = true: marca la correcta y muestra la explicación de cada opción.
 */
export function QuestionView({
  q, chosen, onChoose, reveal,
}: { q: Question; chosen: number | null; onChoose?: (i: number) => void; reveal: boolean }) {
  return (
    <div>
      <p className="whitespace-pre-line text-[15px] leading-relaxed">{q.scenario}</p>
      <div className="mt-4 space-y-2">
        {q.options.map((opt, i) => {
          const isChosen = chosen === i
          const isCorrect = q.correct === i
          let style = 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
          if (!reveal && isChosen) style = 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50'
          if (reveal && isCorrect) style = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
          if (reveal && isChosen && !isCorrect) style = 'border-rose-500 bg-rose-50 dark:bg-rose-950/40'
          return (
            <div key={i}>
              <button
                disabled={reveal || !onChoose}
                onClick={() => onChoose?.(i)}
                className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left text-sm transition ${style}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold dark:bg-slate-800">
                  {reveal && isCorrect ? '✓' : reveal && isChosen ? '✗' : LETTERS[i]}
                </span>
                <span>{opt}</span>
              </button>
              {reveal && q.explanations[i] && (
                <p className={`mx-3 mt-1 text-xs ${isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  {q.explanations[i]}
                </p>
              )}
            </div>
          )
        })}
      </div>
      {reveal && q.manualRef && <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">📘 {q.manualRef} · comprueba con tu edición 2027</p>}
    </div>
  )
}
