import { describe, expect, it } from 'vitest'
import { mockRows, mockTone, pctOf } from './mocks'
import { DEFAULT_SETTINGS } from './defaults'
import { nieTemario } from './content'

describe('tabla de simulacros', () => {
  const rows = mockRows(DEFAULT_SETTINGS, nieTemario.mocks, [{ date: '2027-05-01', correct: 50, total: 80 }])
  it('junta fechas de Ajustes con tipo, material y objetivo del temario', () => {
    expect(rows.length).toBe(9)
    expect(rows[0]).toMatchObject({ date: '2027-01-31', kind: 'cumulative', questions: 30, minutes: 45, targetPercent: 60 })
    expect(rows.find((r) => r.date === '2027-05-22')).toMatchObject({ kind: 'mock', minutes: 120, targetPercent: 70, material: "Blackstone's Mock Exam 2027" })
  })
  it('calcula el % y lo compara con el objetivo y con el 55,7 %', () => {
    const r = rows.find((x) => x.date === '2027-05-01')!
    expect(r.pct).toBe(62.5)
    expect(mockTone(62.5, 60)).toBe('green')
    expect(mockTone(57, 65)).toBe('amber')
    expect(mockTone(50, 60)).toBe('red')
    expect(pctOf(39, 70)).toBe(55.7)
  })
  it('si añades fechas en Ajustes, salen con valores por defecto', () => {
    const extra = mockRows({ ...DEFAULT_SETTINGS, mocks: [...DEFAULT_SETTINGS.mocks, '2027-05-30'] }, nieTemario.mocks, [])
    expect(extra.at(-1)).toMatchObject({ date: '2027-05-30', questions: 80 })
  })
})
