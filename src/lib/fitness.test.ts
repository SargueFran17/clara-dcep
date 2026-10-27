import { describe, expect, it } from 'vitest'
import { bleepReached, rateAdvice, weeklyLossRate } from './fitness'

describe('fitness', () => {
  it('ritmo semanal de pérdida de peso', () => {
    const e = [
      { date: '2026-11-01', kg: 70 },
      { date: '2026-11-15', kg: 69 },
    ]
    expect(weeklyLossRate(e, '2026-11-15')).toBe(0.5)
    expect(rateAdvice(0.5)).toBe('good')
  })
  it('avisa si es demasiado rápido', () => {
    const e = [
      { date: '2026-11-01', kg: 72 },
      { date: '2026-11-08', kg: 70.5 },
    ]
    expect(rateAdvice(weeklyLossRate(e, '2026-11-08'))).toBe('tooFast')
  })
  it('sin datos suficientes', () => {
    expect(weeklyLossRate([{ date: '2026-11-01', kg: 70 }], '2026-11-02')).toBeNull()
    expect(rateAdvice(null)).toBe('unknown')
  })
  it('bleep: nivel y shuttle (objetivo 5.4)', () => {
    expect(bleepReached({ level: 5, shuttle: 4 })).toBe(true)
    expect(bleepReached({ level: 5, shuttle: 3 })).toBe(false)
    expect(bleepReached({ level: 4, shuttle: 10 })).toBe(false)
    expect(bleepReached({ level: 6, shuttle: 1 })).toBe(true)
  })
})
