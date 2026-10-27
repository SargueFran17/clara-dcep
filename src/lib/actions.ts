import { db } from '../db'
import type { AcademyDay, ErrorEntry, NieChapterState, Review, Settings, TestAttempt } from '../types'
import { grade, newCardState, type Grade } from './sm2'
import { dueForStep, firstReview, nextReview, type SeriesOptions } from './srs'
import type { ISODate } from './dates'
import { DEFAULT_SETTINGS } from './defaults'
import { NIE_OFFSETS, seriesForKey } from './reviews'
import type { NieSlot } from './scheduler'

// Operaciones que cambian datos. Las pantallas solo llaman a estas funciones.

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await db.settings.get('main')) }
}

export async function saveSettings(patch: Partial<Settings>) {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch, id: 'main' })
}

/** Reglas de cada serie de repasos (ver reviews.ts). */
async function seriesFor(itemKey: string): Promise<SeriesOptions> {
  return seriesForKey(itemKey, await getSettings())
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
 * Marca/desmarca un paso (guarda la fecha en que lo marcas). Al marcar el paso ⑩ el capítulo
 * queda "Estudiado" en esa fecha y empiezan sus repasos (+1, +3, +7, +30, +60, +90, +120 días).
 */
export async function toggleStep(chapterId: string, index: number, today: ISODate) {
  const ch = await getChapter(chapterId)
  const steps = [...ch.steps]
  steps[index] = steps[index] ? null : today
  await db.nieChapter.put({ ...ch, steps })
  if (index !== 9) return
  const lessonId = `nie-${chapterId}`
  if (steps[9]) {
    if (!(await db.lessonProgress.get(lessonId))) await completeLesson(lessonId, steps[9])
  } else if (await db.lessonProgress.get(lessonId)) {
    await uncompleteLesson(lessonId)
  }
}

/**
 * Marca (o desmarca) el trozo de un paso que tocaba hoy. Si con él el paso queda completo, se
 * marca el paso entero; si es solo una parte, se guardan esos minutos y mañana sale solo lo que falta.
 */
export async function toggleStepPart(chapterId: string, step: number, minutes: number, stepMinutes: number, today: ISODate, done: boolean) {
  const ch = await getChapter(chapterId)
  const parts = ch.partial ?? []
  const i = step - 1
  if (done) {
    const before = parts.filter((p) => p.step === step).reduce((a, p) => a + p.minutes, 0)
    if (before + minutes >= stepMinutes) return toggleStep(chapterId, i, today)
    await db.nieChapter.put({ ...ch, partial: [...parts, { step, minutes, date: today }] })
    return
  }
  if (ch.steps[i] === today) return toggleStep(chapterId, i, today)
  await db.nieChapter.put({ ...ch, partial: parts.filter((p) => !(p.step === step && p.date === today)) })
}

/**
 * Cambia la fecha real del paso ⑩ (fin del capítulo). Los repasos pendientes se recalculan
 * desde la nueva fecha; los que ya hiciste se mantienen.
 */
export async function setFinishDate(chapterId: string, date: ISODate) {
  const s = await getSettings()
  const itemKey = `lesson:nie-${chapterId}`
  await db.transaction('rw', db.nieChapter, db.lessonProgress, db.reviews, async () => {
    const ch = await getChapter(chapterId)
    const steps = [...ch.steps]
    steps[9] = date
    await db.nieChapter.put({ ...ch, steps })
    await db.lessonProgress.put({ lessonId: `nie-${chapterId}`, status: 'done', completedAt: date })
    await db.reviews.where('itemKey').equals(itemKey).filter((r) => !r.doneAt).delete()
    const done = await db.reviews.where('itemKey').equals(itemKey).filter((r) => !!r.doneAt).count()
    const step = done + 1
    if (step > NIE_OFFSETS.length) return
    const due = dueForStep(date, step, NIE_OFFSETS)
    if (due < s.finalReviewStart) await db.reviews.add({ itemKey, anchor: date, step, due })
  })
}

// ---------- Plan NIE: "Hoy no puedo" y foto del día ----------

export async function setDayOff(date: ISODate, off: boolean) {
  if (off) await db.dayOff.put({ date })
  else await db.dayOff.delete(date)
}

/** Guarda lo que el plan ponía hoy, para que los días pasados se vean tal como estaban. */
export async function saveNieDayLog(date: ISODate, slots: NieSlot[]) {
  await db.nieDayLog.put({ date, slots: slots.map((x) => ({ chapter: x.chapter, steps: x.steps.map((c) => ({ step: c.step, minutes: c.minutes })) })) })
}

// ---------- Objetivos y revisiones (semana / mes) ----------

export async function savePlanNote(id: string, patch: { goal?: string; review?: string; rating?: number }) {
  await db.planNotes.put({ ...(await db.planNotes.get(id)), ...patch, id })
}

// ---------- Simulacros externos ----------

export async function saveMockResult(date: ISODate, correct: number | null, total: number) {
  if (correct === null) await db.mockResults.delete(date)
  else await db.mockResults.put({ date, correct, total })
}

// ---------- Academia ----------

export async function saveAcademyDay(day: AcademyDay) {
  await db.transaction('rw', db.academyDays, db.reviews, db.settings, async () => {
    await db.academyDays.put(day)
    await scheduleFirstReview(`academy:${day.date}`, day.date)
  })
}
