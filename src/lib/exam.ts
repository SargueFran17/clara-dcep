import type { Question, TestAttempt } from '../types'

// Selección de preguntas y corrección de tests/simulacros.

// Formato del NIE real (handbook 2026): 80 preguntas en 2 h; se puntúan 70 (las otras 10 son
// preguntas de prueba que no cuentan y no sabes cuáles son); aprobado 39/70 = 55,7 %.
export const MOCK_QUESTIONS = 80
export const MOCK_MINUTES = 120
export const MOCK_UNSCORED = 10
export const PASS_CORRECT = 39
/** nº de capítulos por parte: reparto de las 80 preguntas del simulacro (≈ proporcional) */
export const CHAPTERS_PER_PART: Record<string, number> = { '1': 12, '2': 14, '3': 9, '4': 8 }
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

/** Reparte n entre las partes según su nº de capítulos (método del mayor resto). */
export function partQuotas(n: number, weights: Record<string, number> = CHAPTERS_PER_PART): Record<string, number> {
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  const raw = Object.entries(weights).map(([k, w]) => ({ k, exact: (n * w) / total }))
  const out: Record<string, number> = Object.fromEntries(raw.map((r) => [r.k, Math.floor(r.exact)]))
  let left = n - Object.values(out).reduce((a, b) => a + b, 0)
  for (const r of [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1))) if (left-- > 0) out[r.k]++
  return out
}

/**
 * Simulacro como el real: cuota por parte y, si una parte no tiene preguntas suficientes,
 * se completa con las demás.
 */
export function pickMock(pool: Question[], n: number, rand: () => number = Math.random): Question[] {
  const quotas = partQuotas(n)
  const picked: Question[] = []
  for (const [part, quota] of Object.entries(quotas)) picked.push(...pickBalanced(pool.filter((q) => partOf(q) === part), quota, rand))
  if (picked.length < n) {
    const used = new Set(picked.map((q) => q.id))
    picked.push(...pickBalanced(pool.filter((q) => !used.has(q.id)), n - picked.length, rand))
  }
  return shuffle(picked, rand)
}

/** Índices de las preguntas "de prueba" que no puntúan (como en el NIE real). */
export function chooseUnscored(n: number, count = MOCK_UNSCORED, rand: () => number = Math.random): Set<number> {
  if (n < MOCK_QUESTIONS) return new Set() // solo en simulacros completos
  return new Set(shuffle([...Array(n).keys()], rand).slice(0, count))
}

/** Tests fijos de un capítulo: las preguntas ordenadas, en bloques de `size` (Test 1, Test 2…). */
export function fixedSets(questions: Question[], size = 10): Question[][] {
  const sorted = [...questions].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  const sets: Question[][] = []
  for (let i = 0; i < sorted.length; i += size) sets.push(sorted.slice(i, i + size))
  return sets
}

export interface Score {
  total: number
  correct: number
  pct: number
  byPart: Record<string, { total: number; correct: number }>
}

/** answers[i] = opción elegida para questions[i] (null = en blanco). `unscored` = índices que no puntúan. */
export function scoreAnswers(questions: Question[], answers: (number | null)[], unscored: Set<number> = new Set()): Score {
  const byPart: Score['byPart'] = {}
  let correct = 0
  let total = 0
  questions.forEach((q, i) => {
    if (unscored.has(i)) return
    total++
    const ok = answers[i] === q.correct
    if (ok) correct++
    const part = partOf(q)
    if (part) {
      byPart[part] ??= { total: 0, correct: 0 }
      byPart[part].total++
      if (ok) byPart[part].correct++
    }
  })
  return { total, correct, pct: total ? +((correct / total) * 100).toFixed(1) : 0, byPart }
}

export const attemptPct = (a: Pick<TestAttempt, 'correct' | 'total'>) => (a.total ? +((a.correct / a.total) * 100).toFixed(1) : 0)

/** Ritmo del examen real: 90 s por pregunta. ¿Por qué pregunta deberías ir? */
export function expectedQuestion(elapsedSec: number, totalMin: number, n: number): number {
  return Math.min(n, Math.floor(elapsedSec / ((totalMin * 60) / n)) + 1)
}

export function fmtTimer(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(r).padStart(2, '0')}`
}
