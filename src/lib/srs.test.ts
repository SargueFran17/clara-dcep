import { describe, expect, it } from 'vitest'
import { dueForStep, firstReview, nextReview, reviewState, stepLabel } from './srs'
import { addMonths, todayISO, weekday, fmtUK } from './dates'

describe('dates', () => {
  it('addMonths se queda en el último día del mes', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28')
    expect(addMonths('2026-12-15', 2)).toBe('2027-02-15')
  })
  it('weekday: 0 = lunes', () => {
    expect(weekday('2026-10-31')).toBe(5) // sábado
    expect(weekday('2027-06-01')).toBe(1) // martes
  })
  it('todayISO usa Europe/London (23:30 UTC en verano ya es el día siguiente)', () => {
    expect(todayISO(new Date('2026-07-01T23:30:00Z'))).toBe('2026-07-02')
    expect(todayISO(new Date('2026-12-01T23:30:00Z'))).toBe('2026-12-01')
  })
  it('formato UK', () => expect(fmtUK('2027-06-01')).toBe('01/06/2027'))
})

describe('repasos espaciados', () => {
  it('+1d, +3d, +7d, +1 mes y luego mensual desde la fecha real', () => {
    const a = '2026-11-02'
    expect([1, 2, 3, 4, 5, 6].map((s) => dueForStep(a, s))).toEqual([
      '2026-11-03', '2026-11-05', '2026-11-09', '2026-12-02', '2027-01-02', '2027-02-02',
    ])
  })

  it('encadena repasos hechos a tiempo', () => {
    let r = firstReview('2026-11-02')!
    const dues = [r.due]
    for (let i = 0; i < 4; i++) {
      r = nextReview(r, r.due)!
      dues.push(r.due)
    }
    expect(dues).toEqual(['2026-11-03', '2026-11-05', '2026-11-09', '2026-12-02', '2027-01-02'])
  })

  it('un repaso hecho tarde desplaza los siguientes', () => {
    const r1 = firstReview('2026-11-02')! // due 03/11
    const r2 = nextReview(r1, '2026-11-06')! // 3 días tarde
    expect(r2.anchor).toBe('2026-11-05')
    expect(r2.due).toBe('2026-11-08')
  })

  it('hacerlo antes de tiempo no adelanta la serie', () => {
    const r1 = firstReview('2026-11-02')!
    expect(nextReview(r1, '2026-11-02')!.due).toBe('2026-11-05')
  })

  it('corta la serie en la fecha límite (17 may para NIE)', () => {
    expect(firstReview('2027-05-16', { until: '2027-05-17' })).toBeNull()
    const r = { anchor: '2027-04-20', step: 3, due: '2027-04-27' }
    expect(nextReview(r, '2027-04-27', { until: '2027-05-17' })).toBeNull() // +1 mes = 20/05
  })

  it('diario de academia: solo +1 día y +7 días', () => {
    const r1 = firstReview('2027-01-04', { steps: [1, 3] })!
    expect(r1.due).toBe('2027-01-05')
    const r2 = nextReview(r1, '2027-01-05', { steps: [1, 3] })!
    expect(r2).toEqual({ anchor: '2027-01-04', step: 3, due: '2027-01-11' })
    expect(nextReview(r2, '2027-01-11', { steps: [1, 3] })).toBeNull()
  })

  it('estado y etiquetas', () => {
    expect(reviewState('2026-11-01', '2026-11-02')).toBe('overdue')
    expect(reviewState('2026-11-02', '2026-11-02')).toBe('today')
    expect(stepLabel(4)).toBe('+1 mes')
    expect(stepLabel(6)).toBe('+3 meses')
  })
})
