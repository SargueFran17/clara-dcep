import { describe, expect, it } from 'vitest'
import { chooseUnscored, expectedQuestion, fixedSets, fmtTimer, partOf, partQuotas, pickBalanced, pickMock, scoreAnswers } from './exam'
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

  it('simulacro: 80 preguntas repartidas por partes según nº de capítulos', () => {
    expect(partQuotas(80)).toEqual({ '1': 22, '2': 26, '3': 17, '4': 15 })
    const pool = ['1.3', '2.7', '3.1', '4.2'].flatMap((c) => Array.from({ length: 40 }, (_, i) => q(`${c}-${i}`, c)))
    const mock = pickMock(pool, 80, seeded(3))
    expect(mock.length).toBe(80)
    expect(mock.filter((x) => partOf(x) === '2').length).toBe(26)
  })

  it('simulacro: si falta una parte se completa con las demás', () => {
    const pool = Array.from({ length: 100 }, (_, i) => q(`p1-${i}`, '1.3'))
    expect(pickMock(pool, 80).length).toBe(80)
  })

  it('10 preguntas no puntúan: se corrige sobre 70', () => {
    const qs = Array.from({ length: 80 }, (_, i) => q(`x${i}`, '1.3', 0))
    const unscored = chooseUnscored(80, 10, seeded(5))
    expect(unscored.size).toBe(10)
    const s = scoreAnswers(qs, qs.map(() => 0), unscored)
    expect(s.total).toBe(70)
    expect(s.correct).toBe(70)
    expect(chooseUnscored(30).size).toBe(0)
  })

  it('tests fijos por capítulo en bloques de 10', () => {
    const qs = Array.from({ length: 23 }, (_, i) => q(`1.3-${i + 1}`, '1.3'))
    const sets = fixedSets(qs)
    expect(sets.map((x) => x.length)).toEqual([10, 10, 3])
    expect(sets[0][1].id).toBe('1.3-2')
  })

  it('ritmo de 90 s por pregunta', () => {
    expect(expectedQuestion(0, 120, 80)).toBe(1)
    expect(expectedQuestion(60 * 60, 120, 80)).toBe(41)
  })
})
