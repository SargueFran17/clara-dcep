import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { completeLesson, completeReview, saveSettings, uncompleteLesson, undoReview } from './actions'
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

  it('deshacer una lección borra sus repasos pendientes', async () => {
    await completeLesson('gr-1', '2026-11-04')
    await uncompleteLesson('gr-1')
    expect(await db.lessonProgress.count()).toBe(0)
    expect(await pending('lesson:gr-1')).toEqual([])
  })

  it('exportar e importar la copia de seguridad', async () => {
    await completeLesson('vo-1', '2026-11-04')
    await db.weights.add({ date: '2026-11-01', kg: 70 })
    const json = await exportBackup()
    await resetAll()
    expect(await db.weights.count()).toBe(0)
    await importBackup(json)
    expect(await db.weights.count()).toBe(1)
    expect((await db.lessonProgress.get('vo-1'))?.completedAt).toBe('2026-11-04')
    await expect(importBackup('{"foo":1}')).rejects.toThrow()
  })
})
