import { describe, expect, it } from 'vitest'
import { addMonthsYM, daySummary, monthGrid } from './month'
import { buildPlan } from './planner'
import { DEFAULT_SETTINGS } from './defaults'
import { arranque, fitnessWeek, nieTemario, preAcademyOrder } from './content'

const plan = buildPlan(DEFAULT_SETTINGS, { preOrder: preAcademyOrder, temario: nieTemario, fitnessWeek, kickoff: arranque })

describe('calendario mensual', () => {
  it('semanas completas de lunes a domingo', () => {
    const g = monthGrid('2026-11')
    expect(g[0]).toBe('2026-10-26') // lunes
    expect(g.at(-1)).toBe('2026-12-06') // domingo
    expect(g.length % 7).toBe(0)
    expect(addMonthsYM('2026-12', 1)).toBe('2027-01')
  })
  it('resumen corto de cada día', () => {
    expect(daySummary(plan.days.get('2026-11-02')).slice(0, 2)).toEqual(['FT1', 'VO1'])
    expect(daySummary(plan.days.get('2027-01-02')).join(' ')).toMatch(/NIE 1\.3/)
    expect(daySummary(plan.days.get('2027-06-01'))).toContain('🎯 EXAMEN')
  })
})

describe('arranque', () => {
  it('las tareas de arranque salen antes del inicio en serio', () => {
    const d = plan.days.get('2026-10-27')!
    expect(d.events.map((e) => e.type)).toContain('kickoff')
    expect(d.targetMin).toBe(arranque.minutes)
    expect(plan.days.get('2026-10-31')!.events.some((e) => e.type === 'kickoff')).toBe(false)
  })
})
