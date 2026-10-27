import { describe, expect, it } from 'vitest'
import { computeStreak } from './streak'

const log = (date: string, done: number, total = 5) => ({ date, done, total })

describe('racha', () => {
  it('cuenta días seguidos cumplidos (≥ 80 %)', () => {
    const logs = [log('2026-11-01', 5), log('2026-11-02', 4), log('2026-11-03', 5)]
    expect(computeStreak(logs, '2026-11-03', 0.8)).toBe(3)
  })
  it('si hoy aún no está cumplido, cuenta hasta ayer', () => {
    const logs = [log('2026-11-02', 5), log('2026-11-03', 1)]
    expect(computeStreak(logs, '2026-11-03', 0.8)).toBe(1)
  })
  it('un día sin abrir la app rompe la racha', () => {
    const logs = [log('2026-11-01', 5), log('2026-11-03', 5)]
    expect(computeStreak(logs, '2026-11-03', 0.8)).toBe(1)
  })
  it('los días sin tareas no la rompen', () => {
    const logs = [log('2026-11-01', 5), log('2026-11-02', 0, 0), log('2026-11-03', 5)]
    expect(computeStreak(logs, '2026-11-03', 0.8)).toBe(2)
  })
})
