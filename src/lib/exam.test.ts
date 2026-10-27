import { describe, expect, it } from 'vitest'
import { fmtTimer, partOf, pickBalanced, scoreAnswers } from './exam'
import type { Question } from '../types'

const q = (id: string, chapter: string, correct = 0): Question => ({
  id, chapter, subjectId: `nie-p${chapter[0]}`, scenario: id, options: ['a', 'b', 'c', 'd'], correct, explanations: ['', '', '', ''],
})

// generador determinista
function seeded(seed = 1) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}

describe('exámenes', () => {
  it('reparte entre capítulos', () => {
    const pool = [...Array.from({ length: 10 }, (_, i) => q(`a${i}`, '1.3')), q('b', '1.2'), q('c', '2.7')]
    const picked = pickBalanced(pool, 3, seeded())
    expect(new Set(picked.map((p) => p.chapter))).toEqual(new Set(['1.3', '1.2', '2.7']))
  })

  it('si no hay suficientes preguntas, devuelve todas', () => {
    expect(pickBalanced([q('a', '1.3'), q('b', '1.2')], 80).length).toBe(2)
  })

  it('puntúa total y por parte', () => {
    const qs = [q('a', '1.3', 0), q('b', '1.2', 1), q('c', '2.7', 2), q('d', '3.1', 3)]
    const s = scoreAnswers(qs, [0, 0, 2, null])
    expect(s.correct).toBe(2)
    expect(s.pct).toBe(50)
    expect(s.byPart).toEqual({ '1': { total: 2, correct: 1 }, '2': { total: 1, correct: 1 }, '3': { total: 1, correct: 0 } })
  })

  it('parte desde la asignatura si no hay capítulo', () => {
    expect(partOf({ ...q('x', '4.2'), chapter: undefined, subjectId: 'nie-p4' })).toBe('4')
    expect(partOf({ ...q('x', '4.2'), chapter: undefined, subjectId: 'vo' })).toBeUndefined()
  })

  it('temporizador', () => {
    expect(fmtTimer(7200)).toBe('2:00:00')
    expect(fmtTimer(65)).toBe('1:05')
  })
})
