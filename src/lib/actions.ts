import { db } from '../db'
import type { Review, Settings } from '../types'
import { firstReview, nextReview } from './srs'
import type { ISODate } from './dates'
import { DEFAULT_SETTINGS } from './defaults'

// Operaciones que cambian datos. Las pantallas solo llaman a estas funciones.

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await db.settings.get('main')) }
}

export async function saveSettings(patch: Partial<Settings>) {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch, id: 'main' })
}

/** Los capítulos NIE dejan de tener repasos espaciados al empezar el repaso final. */
async function reviewLimitFor(itemKey: string): Promise<ISODate | undefined> {
  if (itemKey.startsWith('lesson:nie-')) return (await getSettings()).finalReviewStart
}

/** Programa el primer repaso de algo terminado hoy (si no tenía ya uno pendiente). */
export async function scheduleFirstReview(itemKey: string, completedOn: ISODate) {
  const pending = await db.reviews.where('itemKey').equals(itemKey).filter((r) => !r.doneAt).count()
  if (pending) return
  const r = firstReview(completedOn, await reviewLimitFor(itemKey))
  if (r) await db.reviews.add({ itemKey, ...r })
}

export async function completeLesson(lessonId: string, on: ISODate) {
  await db.transaction('rw', db.lessonProgress, db.reviews, db.settings, async () => {
    await db.lessonProgress.put({ lessonId, status: 'done', completedAt: on })
    await scheduleFirstReview(`lesson:${lessonId}`, on)
  })
}

/** Deshacer: borra el progreso y los repasos pendientes de esa lección. */
export async function uncompleteLesson(lessonId: string) {
  await db.transaction('rw', db.lessonProgress, db.reviews, async () => {
    await db.lessonProgress.delete(lessonId)
    await db.reviews.where('itemKey').equals(`lesson:${lessonId}`).filter((r) => !r.doneAt).delete()
  })
}

export async function completeReview(review: Review, on: ISODate) {
  await db.transaction('rw', db.reviews, db.settings, async () => {
    await db.reviews.update(review.id!, { doneAt: on })
    const next = nextReview(review, on, await reviewLimitFor(review.itemKey))
    if (next) await db.reviews.add({ itemKey: review.itemKey, ...next })
  })
}

export async function undoReview(review: Review) {
  await db.transaction('rw', db.reviews, async () => {
    // borra el repaso que se generó a partir de este
    await db.reviews
      .where('itemKey')
      .equals(review.itemKey)
      .filter((r) => !r.doneAt && r.step === review.step + 1)
      .delete()
    await db.reviews.update(review.id!, { doneAt: undefined })
  })
}

export async function setTaskDone(date: ISODate, key: string, done: boolean) {
  if (done) await db.taskDone.put({ date, key })
  else await db.taskDone.delete([date, key])
}

export async function logMinutes(date: ISODate, minutes: number, folderId?: string) {
  if (minutes > 0) await db.studySessions.add({ date, minutes, folderId })
}
