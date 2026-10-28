import { describe, expect, it } from 'vitest'
import { buildPlan, phaseOf } from './planner'
import { DEFAULT_SETTINGS } from './defaults'
import { arranque, fitnessStart, fitnessWeek, nieGroups, nieTemario, preAcademyCapacity, preAcademyOrder, weighIn } from './content'
import { weekday } from './dates'

const inputs = { preOrder: preAcademyOrder, temario: nieTemario, fitnessWeek }
const plan = buildPlan(DEFAULT_SETTINGS, inputs)
const s = DEFAULT_SETTINGS

describe('fases', () => {
  it('asigna las fases según las fechas clave', () => {
    expect(phaseOf('2026-10-27', s)).toBe('before')
    expect(phaseOf('2026-10-31', s)).toBe('pre')
    expect(phaseOf('2026-12-25', s)).toBe('xmas')
    expect(phaseOf('2026-12-29', s)).toBe('academy')
    expect(phaseOf('2027-05-02', s)).toBe('academy')
    expect(phaseOf('2027-05-03', s)).toBe('nieBlock')
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
  it('del 31/10 al 05/11: todo Conducir en el Reino Unido (2/día) + fitness (1/día); luego academia', () => {
    const p = buildPlan(s, { ...inputs, preCapacity: preAcademyCapacity, kickoff: arranque })
    for (const id of preAcademyOrder.filter((x) => x.startsWith('dr-'))) expect(p.lessonDates.get(id)! <= '2026-11-05').toBe(true)
    expect(p.days.get('2026-11-01')!.lessons).toEqual(['dr-3', 'dr-4', 'ft-3'])
    expect(p.days.get('2026-11-01')!.events.some((e) => e.type === 'weeklyReview')).toBe(false)
    expect(p.lessonDates.get('ft-7')! <= '2026-11-06').toBe(true)
    expect(p.days.get('2026-11-09')!.lessons.every((id) => !id.startsWith('dr-') && !id.startsWith('ft-'))).toBe(true)
  })
  it('pesaje semanal los sábados desde el 31/10', () => {
    const p = buildPlan(s, { ...inputs, kickoff: arranque, fitnessStart, weighIn })
    expect(p.days.get('2026-10-31')!.events.map((e) => e.type)).toContain('weighIn')
    expect(p.days.get('2026-11-07')!.events.map((e) => e.type)).toContain('weighIn')
    expect(p.days.get('2026-11-02')!.events.map((e) => e.type)).not.toContain('weighIn')
  })
  it('"Hoy no puedo": las lecciones de ese día pasan a los siguientes', () => {
    const p = buildPlan(s, { ...inputs, daysOff: new Set(['2026-11-02']) })
    expect(p.days.get('2026-11-02')!.lessons).toEqual([])
    expect(p.days.get('2026-11-03')!.lessons).toEqual(plan.days.get('2026-11-02')!.lessons)
    expect([...p.days.values()].flatMap((d) => d.lessons).length).toBe(preAcademyOrder.length)
  })
  it('si se acortan las fechas, las lecciones sobrantes no se pierden', () => {
    const p = buildPlan({ ...s, preEnd: '2026-11-07' }, inputs)
    const planned = [...p.days.values()].flatMap((d) => d.lessons)
    expect(planned.length).toBe(preAcademyOrder.length)
  })
})

describe('NIE 1ª vuelta', () => {
  const order = nieGroups.flat()
  it('empieza con 1.3 el 02/01 (no el primer día de academia) y respeta tu orden', () => {
    expect(plan.nieRanges.get('1.3')![0]).toBe('2027-01-02')
    for (const d of ['2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01']) expect(plan.days.get(d)!.nie).toEqual([])
    const starts = order.map((c) => plan.nieRanges.get(c)![0])
    expect([...starts].sort()).toEqual(starts)
  })
  it('todos los capítulos terminan antes del fin de la academia (02/05)', () => {
    expect(plan.nieRanges.size).toBe(43)
    for (const [, [, end]] of plan.nieRanges) expect(end <= s.academyEnd).toBe(true)
  })
  it('los capítulos largos tienen más días (1.7 > 1.3)', () => {
    const len = (c: string) => [...plan.days.values()].filter((d) => d.nie.some((n) => n.chapter === c)).length
    expect(len('1.7')).toBeGreaterThan(len('1.3'))
    expect(len('1.8')).toBeGreaterThan(len('1.4'))
  })
  it('los domingos también hay estudio NIE', () => {
    expect(plan.days.get('2027-01-10')!.nie.length).toBeGreaterThan(0)
    expect(weekday('2027-01-10')).toBe(6)
  })
  it('se recalcula si cambias el inicio del NIE', () => {
    const p = buildPlan({ ...s, nieStart: '2027-01-11' }, inputs)
    expect(p.nieRanges.get('1.3')![0]).toBe('2027-01-11')
  })
  it('L–V de academia: estudio de la academia + diario', () => {
    const types = plan.days.get('2026-12-29')!.events.map((e) => e.type)
    expect(types).toContain('academyStudy')
    expect(types).toContain('academyDiary')
    expect(plan.days.get('2027-01-03')!.events.map((e) => e.type)).not.toContain('academyStudy') // domingo
  })
  it('domingos y festivos sin estudio nuevo', () => {
    expect(plan.days.get('2027-03-26')!.nie).toEqual([])
    expect(plan.days.get('2027-03-29')!.nie).toEqual([])
  })
})

describe('entreno', () => {
  it('desde el 31/10: lunes tenis, miércoles y jueves gym + tenis, gym de miércoles a domingo con 20′ de cinta', () => {
    const p = buildPlan(s, { ...inputs, fitnessStart, kickoff: arranque })
    expect(p.days.get('2026-10-28')!.workouts).toEqual([])
    const types = (d: string) => p.days.get(d)!.workouts.map((w) => w.type)
    expect(types('2026-11-02')).toEqual(['tennis'])
    expect(types('2026-11-04')).toEqual(['gym', 'tennis'])
    expect(types('2026-11-05')).toEqual(['gym', 'tennis'])
    for (const d of ['2026-11-06', '2026-11-07', '2026-11-08']) expect(types(d)).toEqual(['gym'])
    expect(p.days.get('2026-10-31')!.workouts[0].label).toMatch(/20′ corriendo en la cinta/)
  })
})

describe('hitos y repaso final', () => {
  it('tests acumulados, simulacros y examen', () => {
    expect(plan.days.get('2027-01-31')!.events.map((e) => e.type)).toContain('cumulativeTest')
    for (const m of s.mocks) expect(plan.days.get(m)!.events.map((e) => e.type)).toContain('mock')
    expect(plan.days.get('2027-06-01')!.events.map((e) => e.type)).toEqual(['exam'])
  })
  it('repaso final en las fechas fijas del temario, sin pisar simulacros', () => {
    const groups = [...plan.days.values()].flatMap((d) => d.events.filter((e) => e.type === 'finalGroup').map((e) => [d.date, e.group]))
    expect(groups[0]).toEqual(['2027-05-17', 1])
    expect(groups.find(([, g]) => g === 6)).toEqual(['2027-05-23', 6])
    expect(groups.length).toBe(nieTemario.finalReview.length)
    expect(plan.days.get('2027-05-22')!.events.some((e) => e.type === 'finalGroup')).toBe(false)
  })
  it('si mueves el inicio del repaso final, las fechas se desplazan', () => {
    const p = buildPlan({ ...s, finalReviewStart: '2027-05-24', finalReviewEnd: '2027-06-07', examDate: '2027-06-08' }, inputs)
    expect(p.days.get('2027-05-24')!.events.find((e) => e.type === 'finalGroup')?.group).toBe(1)
  })
  it('objetivos de horas', () => {
    expect(plan.days.get('2026-11-02')!.targetMin).toBe(120)
    expect(plan.days.get('2027-01-04')!.targetMin).toBe(150) // L–V academia + NIE
    expect(plan.days.get('2027-01-02')!.targetMin).toBe(210) // sábado academia
  })
})
