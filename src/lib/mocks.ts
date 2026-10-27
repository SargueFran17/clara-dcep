import type { MockResult, NieMockPlan, Settings } from '../types'
import { PASS_MARK } from './defaults'

// Tabla de simulacros: las fechas de Ajustes + el tipo/material/objetivo del temario.

export interface MockRow extends NieMockPlan {
  kind: 'cumulative' | 'mock'
  result?: MockResult
  /** % de aciertos (1 decimal) si ya apuntaste el resultado */
  pct?: number
}

const isFull = (m: NieMockPlan) => m.questions >= 80

export function mockRows(s: Settings, plans: NieMockPlan[], results: MockResult[]): MockRow[] {
  const cumulative = plans.filter((m) => !isFull(m))
  const full = plans.filter(isFull)
  const byDate = new Map(results.map((r) => [r.date, r]))
  const row = (date: string, kind: MockRow['kind'], i: number): MockRow => {
    const base = (kind === 'mock' ? full : cumulative)[i]
    const plan: NieMockPlan = base
      ? { ...base, date }
      : kind === 'mock'
        ? { date, type: 'Completo (80 preg · 2 h)', material: '80 preguntas mezcladas', questions: 80, minutes: 120, targetPercent: 65 }
        : { date, type: 'Test acumulado', material: 'Capítulos ya estudiados', questions: 30, minutes: 45, targetPercent: 60 }
    const result = byDate.get(date)
    return { ...plan, kind, result, pct: result ? pctOf(result.correct, result.total) : undefined }
  }
  return [...s.cumulativeTests.map((d, i) => row(d, 'cumulative', i)), ...s.mocks.map((d, i) => row(d, 'mock', i))].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
}

export const pctOf = (correct: number, total: number) => (total ? Math.round((correct / total) * 1000) / 10 : 0)

/** verde = objetivo cumplido · ámbar = aprobado (55,7 %) · rojo = por debajo */
export function mockTone(pct: number, target: number): 'green' | 'amber' | 'red' {
  if (pct >= target) return 'green'
  if (pct >= PASS_MARK) return 'amber'
  return 'red'
}
