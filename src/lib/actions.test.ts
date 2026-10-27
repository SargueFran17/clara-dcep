import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { completeLesson, completeReview, saveMockResult, saveSettings, setDayOff, setFinishDate, toggleStep, uncompleteLesson, undoReview } from './actions'
import { exportBackup, importBackup, resetAll } from './backup'

const pending = (key: string) => db.reviews.where('itemKey').equals(key).filter((r) => !r.doneAt).toArray()

beforeEach(resetAll)

describe('lecciones y repasos (IndexedDB)', () => {
  it('terminar una lección programa el repaso de +1 día desde la fecha real', async () => {
    await completeLesson('vo-1', '2026-11-04')
    const [r] = await pending('lesson:vo-1')
    expect(r.due).toBe('2026-11-05')
    expect(r.step).toBe(1)
  })

  it('hacer un repaso crea el siguiente', async () => {
    await completeLesson('vo-1', '2026-11-04')
    let [r] = await pending('lesson:vo-1')
    await completeReview(r, '2026-11-05')
    ;[r] = await pending('lesson:vo-1')
    expect(r.due).toBe('2026-11-07')
    await undoReview((await db.reviews.where('itemKey').equals('lesson:vo-1').filter((x) => !!x.doneAt).first())!)
    expect((await pending('lesson:vo-1')).map((x) => x.step)).toEqual([1])
  })

  it('los capítulos NIE no programan repasos a partir del repaso final', async () => {
    await saveSettings({ finalReviewStart: '2027-05-17' })
    await completeLesson('nie-2.14', '2027-05-16')
    expect(await pending('lesson:nie-2.14')).toEqual([])
  })

  it('marcar el paso ⑩ termina el capítulo y empieza los repasos (+1, +3…) desde esa fecha', async () => {
    await toggleStep('1.3', 0, '2027-01-02')
    expect(await db.lessonProgress.count()).toBe(0)
    expect((await db.nieChapter.get('1.3'))!.steps[0]).toBe('2027-01-02')
    await toggleStep('1.3', 9, '2027-01-04')
    expect((await db.lessonProgress.get('nie-1.3'))?.completedAt).toBe('2027-01-04')
    let [r] = await pending('lesson:nie-1.3')
    expect(r.due).toBe('2027-01-05')
    await completeReview(r, '2027-01-05')
    ;[r] = await pending('lesson:nie-1.3')
    expect(r.due).toBe('2027-01-07') // +3 días desde el 04/01
    // desmarcar ⑩ borra los repasos pendientes
    await toggleStep('1.3', 9, '2027-01-04')
    expect(await pending('lesson:nie-1.3')).toEqual([])
  })

  it('cambiar la fecha real de fin recalcula los repasos pendientes', async () => {
    await toggleStep('1.2', 9, '2027-01-10')
    await setFinishDate('1.2', '2027-01-07')
    const [r] = await pending('lesson:nie-1.2')
    expect(r).toMatchObject({ step: 1, due: '2027-01-08', anchor: '2027-01-07' })
    expect((await db.nieChapter.get('1.2'))!.steps[9]).toBe('2027-01-07')
  })

  it('deshacer una lección borra sus repasos pendientes', async () => {
    await completeLesson('gr-1', '2026-11-04')
    await uncompleteLesson('gr-1')
    expect(await db.lessonProgress.count()).toBe(0)
    expect(await pending('lesson:gr-1')).toEqual([])
  })

  it('exportar e importar la copia de seguridad', async () => {
    await completeLesson('vo-1', '2026-11-04')
    await db.weights.add({ date: '2026-11-01', kg: 70 })
    await setDayOff('2027-01-04', true)
    await saveMockResult('2027-05-01', 50, 80)
    const json = await exportBackup()
    await resetAll()
    expect(await db.weights.count()).toBe(0)
    await importBackup(json)
    expect(await db.weights.count()).toBe(1)
    expect((await db.lessonProgress.get('vo-1'))?.completedAt).toBe('2026-11-04')
    expect(await db.dayOff.get('2027-01-04')).toBeTruthy()
    expect((await db.mockResults.get('2027-05-01'))?.correct).toBe(50)
    await expect(importBackup('{"foo":1}')).rejects.toThrow()
  })
})
