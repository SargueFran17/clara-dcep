import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { savePlanNote } from '../lib/actions'

const input = 'w-full rounded-xl border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900'

/** Campo de texto que se guarda solo (objetivo o revisión de una semana/mes). */
export function NoteField({ id, field, label, placeholder, rows = 2 }: { id: string; field: 'goal' | 'review'; label: string; placeholder?: string; rows?: number }) {
  const note = useLiveQuery(() => db.planNotes.get(id), [id])
  const value = note?.[field] ?? ''
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <textarea
        key={id + value}
        className={input}
        rows={rows}
        defaultValue={value}
        placeholder={placeholder}
        onBlur={(e) => e.target.value !== value && savePlanNote(id, { [field]: e.target.value })}
      />
    </label>
  )
}

/** Valoración 1–5 de la semana. */
export function Rating({ id }: { id: string }) {
  const note = useLiveQuery(() => db.planNotes.get(id), [id])
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => savePlanNote(id, { rating: note?.rating === n ? undefined : n })}
          className={`h-9 flex-1 rounded-xl font-bold ${note?.rating === n ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
          aria-label={`Valoración ${n}`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}
