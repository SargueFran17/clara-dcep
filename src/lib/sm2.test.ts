import { describe, expect, it } from 'vitest'
import { buildQueue, grade, newCardState } from './sm2'

const T = '2026-11-02'

describe('flashcards (SM-2 simplificado)', () => {
  it('Lo sé: 1 día, 4 días y luego × facilidad', () => {
    let s = grade(newCardState('a', T), 'know', T)
    expect(s.interval).toBe(1)
    expect(s.due).toBe('2026-11-03')
    s = grade(s, 'know', s.due)
    expect(s.interval).toBe(4)
    s = grade(s, 'know', s.due)
    expect(s.interval).toBe(Math.round(4 * 2.7))
  })

  it('No lo sé: vuelve mañana y baja la facilidad', () => {
    let s = grade(newCardState('a', T), 'know', T)
    s = grade(s, 'know', s.due)
    s = grade(s, 'forgot', s.due)
    expect(s.interval).toBe(1)
    expect(s.reps).toBe(0)
    expect(s.lapses).toBe(1)
    expect(s.ease).toBeLessThan(2.7)
  })

  it('Dudo: crece poco', () => {
    let s = { ...newCardState('a', T), reps: 3, interval: 10 }
    s = grade(s, 'doubt', T)
    expect(s.interval).toBe(12)
    expect(s.ease).toBe(2.35)
  })

  it('la facilidad nunca baja de 1,3', () => {
    let s = newCardState('a', T)
    for (let i = 0; i < 20; i++) s = grade(s, 'forgot', T)
    expect(s.ease).toBe(1.3)
  })

  it('cola: atrasadas primero y límite de nuevas por día', () => {
    const states = new Map([
      ['b', { ...newCardState('b', '2026-10-01'), due: '2026-11-01' }],
      ['c', { ...newCardState('c', '2026-10-01'), due: '2026-10-30' }],
      ['d', { ...newCardState('d', '2026-10-01'), due: '2026-11-10' }],
      ['e', newCardState('e', T)], // nueva vista hoy (due hoy)
    ])
    const q = buildQueue({ cardIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], states, today: T, newLimit: 2, reviewLimit: 100 })
    expect(q.due).toEqual(['c', 'b', 'e'])
    expect(q.fresh).toEqual(['a']) // 2 nuevas por día y 'e' ya se presentó hoy
  })
})
