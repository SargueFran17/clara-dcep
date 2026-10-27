import glossaryJson from '../../content/glossary.json'
import acronymsJson from '../../content/acronyms.json'
import type { Card, Question } from '../types'

// Glosario y acrónimos (content/glossary.json, content/acronyms.json) → flashcards y preguntas automáticas
// para la asignatura "Glosario y acrónimos" (ga): Acrónimos I/II y Glosario I/II/III.

export interface Term {
  term: string
  plain: string
  es: string
  topic: string
}

export interface Acronym {
  acronym: string
  full: string
  plain: string
  es: string
}

export const glossary: Term[] = glossaryJson.terms
export const acronyms: Acronym[] = acronymsJson.acronyms

const ACRONYMS_I = 40

/** Lección a la que pertenece cada entrada. */
export function acronymLesson(i: number): string {
  return i < ACRONYMS_I ? 'ac-1' : 'ac-2'
}

export function glossaryLesson(i: number, total = glossary.length): string {
  const third = Math.ceil(total / 3)
  return `gl-${Math.min(3, Math.floor(i / third) + 1)}`
}

/** 3 distractores deterministas: otras entradas del mismo bloque. */
function distractors<T>(items: T[], i: number): T[] {
  const n = items.length
  return [7, 13, 29].map((k) => items[(i + k) % n]).filter((x, j, arr) => x !== items[i] && arr.indexOf(x) === j)
}

/** Coloca la correcta en una posición que depende de i (no siempre la A). */
function place<T>(correct: T, wrong: T[], i: number): { options: T[]; correct: number } {
  const pos = i % (wrong.length + 1)
  const options = [...wrong]
  options.splice(pos, 0, correct)
  return { options, correct: pos }
}

export function glossaryCards(): Card[] {
  return [
    ...acronyms.map((a, i) => ({
      id: `c:ac-${i}`, subjectId: 'ga', lessonId: acronymLesson(i),
      front: a.acronym, back: `${a.full}\n— ${a.plain}`, es: a.es,
    })),
    ...glossary.map((t, i) => ({
      id: `c:gl-${i}`, subjectId: 'ga', lessonId: glossaryLesson(i),
      front: t.term, back: t.plain, es: t.es,
    })),
  ]
}

export function glossaryQuestions(): Question[] {
  const acr = acronyms.map((a, i): Question => {
    const { options, correct } = place(a, distractors(acronyms, i), i)
    return {
      id: `q:ac-${i}`, subjectId: 'ga', lessonId: acronymLesson(i),
      scenario: `What does ${a.acronym} stand for?`,
      options: options.map((o) => o.full),
      correct,
      explanations: options.map((o) => (o === a ? `Correct: ${a.acronym} = ${a.full} (${a.plain}).` : `No: that is ${o.acronym}.`)),
    }
  })
  const gl = glossary.map((t, i): Question => {
    const { options, correct } = place(t, distractors(glossary, i), i)
    return {
      id: `q:gl-${i}`, subjectId: 'ga', lessonId: glossaryLesson(i),
      scenario: `Which is the best plain-English meaning of "${t.term}"?`,
      options: options.map((o) => o.plain),
      correct,
      explanations: options.map((o) => (o === t ? `Correct. In Spanish: ${t.es}.` : `No: that describes "${o.term}".`)),
    }
  })
  return [...acr, ...gl]
}
