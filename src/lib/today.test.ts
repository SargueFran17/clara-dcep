import { describe, expect, it } from 'vitest'
import { buildTasks, dayScore } from './today'
import { buildPlan } from './planner'
import { DEFAULT_SETTINGS } from './defaults'
import { fitnessWeek, nieGroups, preAcademyOrder } from './content'

const plan = buildPlan(DEFAULT_SETTINGS, { preOrder: preAcademyOrder, nieGroups, fitnessWeek })
const empty = { doneLessons: new Set<string>(), reviews: [], checked: new Set<string>() }

describe('Hoy', () => {
  it('lunes de pre-academia: 2 lecciones + entreno + hábitos', () => {
    const tasks = buildTasks('2026-11-02', plan, empty)
    const plan_ = tasks.filter((t) => t.section === 'plan')
    expect(plan_.map((t) => t.key)).toEqual(['lesson:ft-1', 'lesson:vo-1'])
    expect(tasks.some((t) => t.section === 'training')).toBe(true)
    // la lección del sábado 31 no hecha aparece como atrasada
    expect(tasks.filter((t) => t.section === 'overdue').map((t) => t.key)).toEqual(['lesson:se-1'])
  })

  it('repasos de hoy y atrasados', () => {
    const reviews = [
      { id: 1, itemKey: 'lesson:vo-1', anchor: '2026-11-02', step: 1, due: '2026-11-03' },
      { id: 2, itemKey: 'lesson:gr-1', anchor: '2026-11-01', step: 1, due: '2026-11-02' },
    ]
    const tasks = buildTasks('2026-11-03', plan, { ...empty, reviews })
    expect(tasks.find((t) => t.key === 'review:1')!.section).toBe('reviews')
    expect(tasks.find((t) => t.key === 'review:2')!.section).toBe('overdue')
  })

  it('día de academia: capítulo NIE + diario', () => {
    const first = buildTasks('2026-12-29', plan, { ...empty, doneLessons: new Set(preAcademyOrder) })
    expect(first.some((t) => t.key.startsWith('nie:'))).toBe(false) // el NIE empieza el 02/01
    expect(first.some((t) => t.key === 'event:academyStudy')).toBe(true)
    const tasks = buildTasks('2027-01-04', plan, { ...empty, doneLessons: new Set(preAcademyOrder) })
    expect(tasks.some((t) => t.key.startsWith('nie:'))).toBe(true)
    expect(tasks.some((t) => t.key === 'event:academyDiary')).toBe(true)
    expect(tasks.filter((t) => t.section === 'overdue')).toEqual([])
  })

  it('puntuación del día ignora lo atrasado', () => {
    const tasks = buildTasks('2026-11-02', plan, { ...empty, checked: new Set(['habits']) })
    const s = dayScore(tasks)
    expect(s.done).toBe(1)
    expect(s.total).toBe(tasks.filter((t) => t.section !== 'overdue').length)
  })
})
