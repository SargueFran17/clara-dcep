import { describe, expect, it } from 'vitest'
import { buildPlan, phaseOf } from './planner'
import { DEFAULT_SETTINGS } from './defaults'
import { fitnessWeek, nieGroups, preAcademyOrder } from './content'
import { weekday } from './dates'

const inputs = { preOrder: preAcademyOrder, nieGroups, fitnessWeek }
const plan = buildPlan(DEFAULT_SETTINGS, inputs)
const s = DEFAULT_SETTINGS

describe('fases', () => {
  it('asigna las fases según las fechas clave', () => {
    expect(phaseOf('2026-10-27', s)).toBe('before')
    expect(phaseOf('2026-10-31', s)).toBe('pre')
    expect(phaseOf('2026-12-25', s)).toBe('xmas')
    expect(phaseOf('2026-12-29', s)).toBe('academy')
    expect(phaseOf('2027-04-26', s)).toBe('nieBlock')
    expect(phaseOf('2027-05-17', s)).toBe('final')
    expect(phaseOf('2027-06-01', s)).toBe('exam')
  })
})

describe('pre-academia', () => {
  it('planifica todas las lecciones antes del fin de pre-academia, en orden', () => {
    const planned = [...plan.days.values()].flatMap((d) => d.lessons)
    expect(planned).toEqual(preAcademyOrder)
    for (const id of preAcademyOrder) expect(plan.lessonDates.get(id)! <= s.preEnd).toBe(true)
  })
  it('respeta la capacidad: L–V 2, sábado 1, domingo 0', () => {
    for (const d of plan.days.values()) {
      if (d.phase !== 'pre') continue
      const wd = weekday(d.date)
      expect(d.lessons.length).toBeLessThanOrEqual(wd === 6 ? 0 : wd === 5 ? 1 : 2)
    }
    expect(plan.days.get('2026-10-31')!.lessons).toEqual([preAcademyOrder[0]])
    expect(plan.days.get('2026-11-01')!.events.some((e) => e.type === 'weeklyReview')).toBe(true)
  })
  it('si se acortan las fechas, las lecciones sobrantes no se pierden', () => {
    const p = buildPlan({ ...s, preEnd: '2026-11-07' }, inputs)
    const planned = [...p.days.values()].flatMap((d) => d.lessons)
    expect(planned.length).toBe(preAcademyOrder.length)
  })
})

describe('NIE 1ª vuelta', () => {
  const order = nieGroups.flat().map((c) => c.chapter)
  it('empieza con 1.3 el primer día de academia y respeta tu orden', () => {
    expect(plan.nieRanges.get('1.3')![0]).toBe('2026-12-29')
    const starts = order.map((c) => plan.nieRanges.get(c)![0])
    expect([...starts].sort()).toEqual(starts)
  })
  it('todos los capítulos terminan antes del 25 abr', () => {
    expect(plan.nieRanges.size).toBe(43)
    for (const [, [, end]] of plan.nieRanges) expect(end < '2027-04-25').toBe(true)
  })
  it('los capítulos largos tienen más días (1.7 > 1.3)', () => {
    const len = (c: string) => [...plan.days.values()].filter((d) => d.nie.some((n) => n.chapter === c)).length
    expect(len('1.7')).toBeGreaterThan(len('1.3'))
    expect(len('1.8')).toBeGreaterThan(len('1.4'))
  })
  it('los domingos no hay capítulo nuevo', () => {
    for (const d of plan.days.values()) if (weekday(d.date) === 6) expect(d.nie).toEqual([])
  })
  it('se recalcula si cambias el fin de la academia', () => {
    const p = buildPlan({ ...s, academyEnd: '2027-03-28' }, inputs)
    expect(p.nieRanges.get('2.14')![1] < '2027-03-28').toBe(true)
  })
})

describe('hitos y repaso final', () => {
  it('tests acumulados, simulacros y examen', () => {
    expect(plan.days.get('2027-01-31')!.events.map((e) => e.type)).toContain('cumulativeTest')
    for (const m of s.mocks) expect(plan.days.get(m)!.events.map((e) => e.type)).toContain('mock')
    expect(plan.days.get('2027-06-01')!.events.map((e) => e.type)).toEqual(['exam'])
  })
  it('reparte los 12 grupos en el repaso final sin pisar simulacros', () => {
    const groups = [...plan.days.values()].flatMap((d) => d.events.filter((e) => e.type === 'finalGroup'))
    expect(groups.map((e) => e.group)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(plan.days.get('2027-05-22')!.events.some((e) => e.type === 'finalGroup')).toBe(false)
  })
  it('objetivos de horas', () => {
    expect(plan.days.get('2026-11-02')!.targetMin).toBe(120)
    expect(plan.days.get('2027-01-02')!.targetMin).toBe(210) // sábado academia
  })
})
