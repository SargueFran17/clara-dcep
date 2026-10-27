import type { Question, TestAttempt } from '../types'

// Selección de preguntas y corrección de tests/simulacros.

export const MOCK_QUESTIONS = 80
export const MOCK_MINUTES = 120
export const CUMULATIVE_QUESTIONS = 30
export const CUMULATIVE_MINUTES = 45

/** Barajado reproducible (para tests se puede pasar otro generador). */
export function shuffle<T>(items: T[], rand: () => number = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Parte del NIE de una pregunta ("1"…"4"), o undefined si no es del NIE. */
export function partOf(q: Question): string | undefined {
  if (q.chapter) return q.chapter.split('.')[0]
  const m = /^nie-p(\d)$/.exec(q.subjectId)
  return m?.[1]
}

/**
 * Elige n preguntas repartidas entre capítulos (no todas del mismo):
 * va cogiendo una de cada capítulo por turnos hasta llegar a n.
 */
export function pickBalanced(pool: Question[], n: number, rand: () => number = Math.random): Question[] {
  const byChapter = new Map<string, Question[]>()
  for (const q of shuffle(pool, rand)) {
    const k = q.chapter ?? q.lessonId ?? q.subjectId
    byChapter.set(k, [...(byChapter.get(k) ?? []), q])
  }
  const buckets = shuffle([...byChapter.values()], rand)
  const out: Question[] = []
  while (out.length < n && buckets.some((b) => b.length)) for (const b of buckets) if (b.length && out.length < n) out.push(b.shift()!)
  return shuffle(out, rand)
}

export interface Score {
  total: number
  correct: number
  pct: number
  byPart: Record<string, { total: number; correct: number }>
}

/** answers[i] = opción elegida para questions[i] (null = en blanco). */
export function scoreAnswers(questions: Question[], answers: (number | null)[]): Score {
  const byPart: Score['byPart'] = {}
  let correct = 0
  questions.forEach((q, i) => {
    const ok = answers[i] === q.correct
    if (ok) correct++
    const part = partOf(q)
    if (part) {
      byPart[part] ??= { total: 0, correct: 0 }
      byPart[part].total++
      if (ok) byPart[part].correct++
    }
  })
  return { total: questions.length, correct, pct: questions.length ? +((correct / questions.length) * 100).toFixed(1) : 0, byPart }
}

export const attemptPct = (a: Pick<TestAttempt, 'correct' | 'total'>) => (a.total ? +((a.correct / a.total) * 100).toFixed(1) : 0)

export function fmtTimer(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(r).padStart(2, '0')}`
}
