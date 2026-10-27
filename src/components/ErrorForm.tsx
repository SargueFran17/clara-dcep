import { useState } from 'react'
import { ERROR_TYPES } from '../lib/errors'
import { saveError } from '../lib/actions'
import { useToday } from '../lib/hooks'
import type { ErrorType, Question } from '../types'
import { Button } from './ui'

/** Apunta un fallo en el registro de errores: tipo + la regla correcta con tus palabras. */
export function ErrorForm({ question, chosen }: { question: Question; chosen: number | null }) {
  const today = useToday()
  const [type, setType] = useState<ErrorType | null>(null)
  const [rule, setRule] = useState('')
  const [saved, setSaved] = useState(false)

  if (saved) return <p className="mt-3 text-sm font-semibold text-emerald-600">✓ Guardado en el registro de errores</p>

  return (
    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/30">
      <div className="mb-2 text-sm font-semibold">Apuntar en el registro de errores</div>
      <div className="flex flex-wrap gap-1.5">
        {ERROR_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${type === t.id ? 'bg-rose-600 text-white' : 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        value={rule}
        onChange={(e) => setRule(e.target.value)}
        placeholder="La regla correcta, con tus palabras…"
        rows={2}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      />
      <Button
        className="mt-2"
        disabled={!type || !rule.trim()}
        onClick={async () => {
          await saveError({ date: today, questionId: question.id, subjectId: question.subjectId, chapter: question.chapter, type: type!, rule: rule.trim(), chosen: chosen ?? undefined })
          setSaved(true)
        }}
      >
        Guardar error
      </Button>
    </div>
  )
}
