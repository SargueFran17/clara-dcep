import { describe, expect, it } from 'vitest'
import { acronyms, glossary, glossaryCards, glossaryQuestions } from './glossary'

describe('glosario y acrónimos', () => {
  it('tiene al menos 150 términos y 80 acrónimos, sin duplicados', () => {
    expect(glossary.length).toBeGreaterThanOrEqual(150)
    expect(acronyms.length).toBeGreaterThanOrEqual(80)
    expect(new Set(glossary.map((t) => t.term.toLowerCase())).size).toBe(glossary.length)
    expect(new Set(acronyms.map((a) => a.acronym)).size).toBe(acronyms.length)
  })
  it('cada término tiene inglés sencillo y español', () => {
    for (const t of glossary) expect(t.plain && t.es).toBeTruthy()
  })
  it('genera una flashcard y una pregunta por entrada', () => {
    const n = glossary.length + acronyms.length
    expect(glossaryCards().length).toBe(n)
    const qs = glossaryQuestions()
    expect(qs.length).toBe(n)
    for (const q of qs) {
      expect(q.options.length).toBe(4)
      expect(new Set(q.options).size).toBe(4)
      expect(q.correct).toBeGreaterThanOrEqual(0)
      expect(q.correct).toBeLessThan(4)
    }
  })
})
