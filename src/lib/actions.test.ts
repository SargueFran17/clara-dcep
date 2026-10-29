import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { completeLesson, completeReview, saveMockResult, saveSettings, setDayOff, setFinishDate, toggleStep, toggleStepPart, toggleTask, uncompleteLesson, undoReview } from './actions'
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

  it('marcar una parte de un paso guarda los minutos; la última parte completa el paso', async () => {
    await toggleStepPart('1.8', 2, 60, 105, '2027-01-09', true)
    let ch = await db.nieChapter.get('1.8')
    expect(ch!.steps[1]).toBeNull()
    expect(ch!.partial).toEqual([{ step: 2, minutes: 60, date: '2027-01-09' }])
    // desmarcar el mismo día la quita
    await toggleStepPart('1.8', 2, 60, 105, '2027-01-09', false)
    expect((await db.nieChapter.get('1.8'))!.partial).toEqual([])
    await toggleStepPart('1.8', 2, 60, 105, '2027-01-09', true)
    await toggleStepPart('1.8', 2, 45, 105, '2027-01-10', true)
    ch = await db.nieChapter.get('1.8')
    expect(ch!.steps[1]).toBe('2027-01-10')
  })

  it('cambiar la fecha real de fin recalcula los repasos pendientes', async () => {
    await toggleStep('1.2', 9, '2027-01-10')
    await setFinishDate('1.2', '2027-01-07')
    const [r] = await pending('lesson:nie-1.2')
    expect(r).toMatchObject({ step: 1, due: '2027-01-08', anchor: '2027-01-07' })
    expect((await db.nieChapter.get('1.2'))!.steps[9]).toBe('2027-01-07')
  })

  it('adelantar tareas de otro día: estudio cuenta hoy, entreno en su día', async () => {
    const today = '2026-11-02'
    await toggleTask({ kind: 'lesson', key: 'lesson:dr-9', section: 'plan', title: '', subtitle: '', lessonId: 'dr-9', done: false }, true, today, '2026-11-04')
    expect((await db.lessonProgress.get('dr-9'))?.completedAt).toBe(today)
    const [r] = await pending('lesson:dr-9')
    expect(r.due).toBe('2026-11-03')
    await toggleTask({ kind: 'check', key: 'workout:0:gym', section: 'training', title: '', done: false }, true, today, '2026-11-04')
    expect(await db.taskDone.get(['2026-11-04', 'workout:0:gym'])).toBeTruthy()
    // paso NIE adelantado y desmarcado otro día
    const step = { kind: 'nieStep' as const, key: 'nie:1.3:5', section: 'plan' as const, title: '', subtitle: '', chapter: '1.3', step: 5, minutes: 30, stepMinutes: 30, done: false, link: '' }
    await toggleTask(step, true, '2027-01-02', '2027-01-05')
    expect((await db.nieChapter.get('1.3'))!.steps[4]).toBe('2027-01-02')
    await toggleTask({ ...step, done: true }, false, '2027-01-03', '2027-01-05')
    expect((await db.nieChapter.get('1.3'))!.steps[4]).toBeNull()
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
