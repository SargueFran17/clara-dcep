import { describe, expect, it } from 'vitest'
import { dayCapacity, nieMargin, scheduleNie, type NieSchedule } from './scheduler'
import { DEFAULT_SETTINGS } from './defaults'
import { nieOrderedChapters, nieTemario } from './content'
import { addDays, type ISODate } from './dates'

const s = DEFAULT_SETTINGS
const base = { settings: s, chapters: nieOrderedChapters, capacity: nieTemario, progress: new Map(), daysOff: new Set<ISODate>(), today: '2026-11-01' }
const minutesOn = (sch: NieSchedule, d: ISODate) => (sch.days.get(d) ?? []).flatMap((x) => x.steps).reduce((a, c) => a + c.minutes, 0)
const allSteps = (sch: NieSchedule) => [...sch.days.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([, l]) => l.flatMap((x) => x.steps.map((c) => ({ chapter: x.chapter, ...c }))))

describe('capacidad por día', () => {
  it('academia L–V 75, sábado 180, domingo y festivos 0; nada antes del inicio del NIE', () => {
    expect(dayCapacity('2027-01-04', s, nieTemario)).toBe(75) // lunes
    expect(dayCapacity('2027-01-02', s, nieTemario)).toBe(180) // sábado
    expect(dayCapacity('2027-01-03', s, nieTemario)).toBe(0) // domingo
    expect(dayCapacity('2027-03-26', s, nieTemario)).toBe(0) // Good Friday
    expect(dayCapacity('2026-12-30', s, nieTemario)).toBe(0) // academia, pero antes del 02/01
    expect(dayCapacity('2027-01-04', s, nieTemario, new Set(['2027-01-04']))).toBe(0) // "Hoy no puedo"
  })
})

describe('plan inicial sin progreso', () => {
  const sch = scheduleNie(base)
  it('empieza el 02/01 con 1.3 ① y termina la 1ª vuelta antes del fin de la academia', () => {
    expect(sch.from).toBe('2027-01-02')
    expect(allSteps(sch)[0]).toMatchObject({ chapter: '1.3', step: 1 })
    expect(sch.finish! <= s.academyEnd).toBe(true)
    expect(nieMargin(sch, s).days).toBeGreaterThanOrEqual(0)
    expect(sch.ranges.size).toBe(43)
  })
  it('respeta tu orden de capítulos y de pasos', () => {
    const order = nieOrderedChapters.map((c) => c.code)
    const seen = [...new Set(allSteps(sch).map((x) => x.chapter))]
    expect(seen).toEqual(order)
    const of13 = allSteps(sch).filter((x) => x.chapter === '1.3').map((x) => x.step)
    expect([...new Set(of13)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
  it('nunca pone más minutos de los que caben en un día y reparte todo', () => {
    for (const d of sch.days.keys()) expect(minutesOn(sch, d)).toBeLessThanOrEqual(dayCapacity(d, s, nieTemario))
    const total = nieOrderedChapters.reduce((a, c) => a + c.stepMinutes.reduce((x, y) => x + y, 0), 0)
    expect(allSteps(sch).reduce((a, c) => a + c.minutes, 0)).toBe(total)
  })
  it('un paso que no cabe entero se reparte entre dos días', () => {
    expect(allSteps(sch).some((c) => c.minutes < c.stepMinutes)).toBe(true)
  })
})

describe('reprogramación', () => {
  it('"Hoy no puedo" retrasa el fin pero nunca sobrecarga un día', () => {
    const today = '2027-01-09' // sábado (180 min)
    const normal = scheduleNie({ ...base, today })
    const off = scheduleNie({ ...base, today, daysOff: new Set([today]) })
    expect(minutesOn(off, today)).toBe(0)
    expect(off.finish! > normal.finish!).toBe(true)
    for (const d of off.days.keys()) expect(minutesOn(off, d)).toBeLessThanOrEqual(dayCapacity(d, s, nieTemario, new Set([today])))
  })
  it('lo no hecho pasa al siguiente hueco desde HOY (no se acumula atrás)', () => {
    const sch = scheduleNie({ ...base, today: '2027-02-01' })
    expect([...sch.days.keys()].every((d) => d >= '2027-02-01')).toBe(true)
    expect(allSteps(sch)[0]).toMatchObject({ chapter: '1.3', step: 1 })
    expect(nieMargin(sch, s).days).toBeLessThan(nieMargin(scheduleNie(base), s).days)
  })
  it('lo marcado hoy cuenta como hecho y gasta la capacidad de hoy', () => {
    const today = '2027-01-04' // lunes, 75 min
    const progress = new Map([['1.3', ['2027-01-02', '2027-01-02', today, null, null, null, null, null, null, null]]])
    const sch = scheduleNie({ ...base, today, progress })
    const steps = sch.days.get(today)!.flatMap((x) => x.steps)
    expect(steps.filter((c) => c.done).map((c) => c.step)).toEqual([3])
    expect(minutesOn(sch, today)).toBeLessThanOrEqual(75)
    expect(sch.ranges.get('1.3')![0]).toBe('2027-01-02')
  })
  it('vas tarde → margen negativo', () => {
    const sch = scheduleNie({ ...base, today: '2027-04-20' })
    expect(nieMargin(sch, s).days).toBeLessThan(0)
  })
  it('si cambias el fin de la academia, el margen cambia', () => {
    const sch = scheduleNie(base)
    expect(nieMargin(sch, { ...s, academyEnd: addDays(s.academyEnd, -30) }).days).toBe(nieMargin(sch, s).days - 30)
  })
})
