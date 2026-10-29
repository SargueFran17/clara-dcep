import { describe, expect, it } from 'vitest'
import { bucketReviews, NIE_OFFSETS, overdueForToday, plannedDues, reviewGuide, reviewStepLabel, seriesForKey } from './reviews'
import { firstReview, nextReview } from './srs'
import { DEFAULT_SETTINGS } from './defaults'
import type { Review } from '../types'

const s = DEFAULT_SETTINGS
const key = 'lesson:nie-1.3'

describe('repasos NIE', () => {
  it('offsets +1, +3, +7, +30, +60, +90, +120 desde la fecha REAL del paso ⑩', () => {
    expect(NIE_OFFSETS).toEqual([1, 3, 7, 30, 60, 90, 120])
    expect(plannedDues('2027-01-05', s)).toEqual(['2027-01-06', '2027-01-08', '2027-01-12', '2027-02-04', '2027-03-06', '2027-04-05', '2027-05-05'])
    // terminado más tarde → todo se recalcula desde esa fecha
    expect(firstReview('2027-01-09', seriesForKey(key, s))!.due).toBe('2027-01-10')
  })
  it('ningún repaso cae en o después del inicio del repaso final (stopBefore)', () => {
    for (const anchor of ['2027-01-02', '2027-02-20', '2027-04-10', '2027-05-10', '2027-05-16'])
      for (const d of plannedDues(anchor, s)) expect(d < s.finalReviewStart).toBe(true)
    // la serie real (con nextReview) también se corta
    const opts = seriesForKey(key, s)
    let r = firstReview('2027-03-01', opts)
    const dues: string[] = []
    while (r) {
      dues.push(r.due)
      r = nextReview(r, r.due, opts)
    }
    expect(dues.length).toBeLessThan(7)
    expect(dues.every((d) => d < s.finalReviewStart)).toBe(true)
  })
  it('etiquetas y qué hacer en cada repaso', () => {
    expect(reviewStepLabel({ itemKey: key, step: 4 })).toBe('+1 mes')
    expect(reviewStepLabel({ itemKey: key, step: 6 })).toBe('+3 meses')
    expect(reviewGuide({ itemKey: key, step: 1 })).toMatch(/voz alta/)
    expect(reviewGuide({ itemKey: key, step: 2 })).toMatch(/10 preguntas/)
    expect(reviewGuide({ itemKey: key, step: 3 })).toMatch(/15 preguntas/)
    expect(reviewGuide({ itemKey: key, step: 5 })).toMatch(/20 preguntas/)
    expect(reviewGuide({ itemKey: 'lesson:vo-1', step: 1 })).toBeUndefined()
  })
})

describe('fitness', () => {
  it('fitness sin repasos; conducir solo +1 día; el resto la serie completa', () => {
    expect(firstReview('2026-11-01', seriesForKey('lesson:ft-1', s))).toBeNull()
    const dr = firstReview('2026-11-01', seriesForKey('lesson:dr-1', s))!
    expect(dr.due).toBe('2026-11-02')
    expect(nextReview(dr, '2026-11-02', seriesForKey('lesson:dr-1', s))).toBeNull()
    const vo = firstReview('2026-11-01', seriesForKey('lesson:vo-1', s))!
    expect(nextReview(vo, '2026-11-02', seriesForKey('lesson:vo-1', s))!.due).toBe('2026-11-04')
  })
})

describe('Atrasados · Hoy · Próximos 7 días', () => {
  const mk = (id: number, due: string, doneAt?: string): Review => ({ id, itemKey: key, anchor: due, step: 1, due, doneAt })
  const all = [mk(1, '2027-01-01'), mk(2, '2027-01-03'), mk(3, '2027-01-02'), mk(4, '2027-01-04'), mk(5, '2027-01-10'), mk(6, '2027-01-12'), mk(7, '2027-01-11'), mk(8, '2027-01-09', '2027-01-10'), mk(9, '2027-01-05')]
  const b = bucketReviews(all, '2027-01-10')
  it('reparte y ordena (los más antiguos primero)', () => {
    expect(b.overdue.map((r) => r.id)).toEqual([1, 3, 2, 4, 9])
    expect(b.today.map((r) => r.id)).toEqual([8, 5])
    expect(b.next7.map((r) => r.id)).toEqual([7, 6])
  })
  it('máximo 3 atrasados en Hoy, con aviso de los que esperan', () => {
    const o = overdueForToday(b.overdue)
    expect(o.shown.map((r) => r.id)).toEqual([1, 3, 2])
    expect(o.waiting).toBe(2)
    expect(overdueForToday(b.overdue.slice(0, 2)).waiting).toBe(0)
  })
})
