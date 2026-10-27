import { db } from '../db'
import type { AcademyDay, ErrorEntry, NieChapterState, Review, Settings, TestAttempt } from '../types'
import { grade, newCardState, type Grade } from './sm2'
import { firstReview, nextReview, type SeriesOptions } from './srs'
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

/**
 * Reglas de cada serie de repasos:
 * - capítulos NIE: se cortan al empezar el repaso final (17 may);
 * - diario de academia: solo +1 día y +7 días.
 */
async function seriesFor(itemKey: string): Promise<SeriesOptions> {
  if (itemKey.startsWith('lesson:nie-')) return { until: (await getSettings()).finalReviewStart }
  if (itemKey.startsWith('academy:')) return { steps: [1, 3] }
  return {}
}

/** Programa el primer repaso de algo terminado hoy (si no tenía ya uno pendiente). */
export async function scheduleFirstReview(itemKey: string, completedOn: ISODate) {
  const pending = await db.reviews.where('itemKey').equals(itemKey).filter((r) => !r.doneAt).count()
  if (pending) return
  const r = firstReview(completedOn, await seriesFor(itemKey))
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
    const next = nextReview(review, on, await seriesFor(review.itemKey))
    if (next) await db.reviews.add({ itemKey: review.itemKey, ...next })
  })
}

export async function undoReview(review: Review) {
  await db.transaction('rw', db.reviews, async () => {
    // borra el repaso que se generó a partir de este
    await db.reviews
      .where('itemKey')
      .equals(review.itemKey)
      .filter((r) => !r.doneAt && r.step > review.step)
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

// ---------- Flashcards ----------

export async function gradeCard(cardId: string, g: Grade, today: ISODate) {
  const state = (await db.cardState.get(cardId)) ?? newCardState(cardId, today)
  await db.cardState.put(grade(state, g, today))
}

// ---------- Tests y errores ----------

export async function saveAttempt(a: TestAttempt) {
  return db.testAttempts.add(a)
}

export async function saveError(e: ErrorEntry) {
  if (e.id) await db.errors.put(e)
  else await db.errors.add(e)
}

// ---------- Capítulos NIE (método de 10 pasos) ----------

export async function getChapter(chapterId: string): Promise<NieChapterState> {
  return (await db.nieChapter.get(chapterId)) ?? { chapterId, steps: Array(10).fill(null) }
}

export async function updateChapter(chapterId: string, patch: Partial<NieChapterState>) {
  await db.nieChapter.put({ ...(await getChapter(chapterId)), ...patch, chapterId })
}

/**
 * Marca/desmarca un paso. Al completar los 10, el capítulo queda "Estudiado" en la fecha del
 * último paso y empiezan los repasos (+1d, +3d, +7d, +1m…) hasta el repaso final.
 */
export async function toggleStep(chapterId: string, index: number, today: ISODate) {
  const ch = await getChapter(chapterId)
  const steps = [...ch.steps]
  steps[index] = steps[index] ? null : today
  await db.nieChapter.put({ ...ch, steps })
  const lessonId = `nie-${chapterId}`
  if (steps.every(Boolean)) {
    if (!(await db.lessonProgress.get(lessonId))) await completeLesson(lessonId, today)
  } else if (await db.lessonProgress.get(lessonId)) {
    await uncompleteLesson(lessonId)
  }
}

// ---------- Academia ----------

export async function saveAcademyDay(day: AcademyDay) {
  await db.transaction('rw', db.academyDays, db.reviews, db.settings, async () => {
    await db.academyDays.put(day)
    await scheduleFirstReview(`academy:${day.date}`, day.date)
  })
}
