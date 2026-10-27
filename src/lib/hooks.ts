import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { DEFAULT_SETTINGS } from './defaults'
import { buildPlan, type Plan } from './planner'
import { contentCards, contentQuestions, fitnessWeek, nieChapterMeta, nieOrderedChapters, nieTemario, preAcademyOrder } from './content'
import { scheduleNie, type NieSchedule, type NieSlot } from './scheduler'
import { buildQueue } from './sm2'
import { todayISO, type ISODate } from './dates'
import type { Card, Question, Settings } from '../types'

export function useSettings(): Settings {
  const stored = useLiveQuery(() => db.settings.get('main'), [])
  return useMemo(() => ({ ...DEFAULT_SETTINGS, ...stored }), [stored])
}

/** Cola NIE recalculada desde hoy con tu progreso real y tus días "Hoy no puedo". */
export function useNieSchedule(): NieSchedule | undefined {
  const s = useSettings()
  const today = useToday()
  const states = useLiveQuery(() => db.nieChapter.toArray(), [])
  const off = useLiveQuery(() => db.dayOff.toArray(), [])
  return useMemo(() => {
    if (!states || !off) return undefined
    return scheduleNie({
      settings: s,
      chapters: nieOrderedChapters,
      capacity: nieTemario,
      progress: new Map(states.map((x) => [x.chapterId, x.steps])),
      partial: new Map(states.map((x) => [x.chapterId, x.partial ?? []])),
      daysOff: new Set(off.map((d) => d.date)),
      today,
    })
  }, [s, today, states, off])
}

export function usePlan(): Plan {
  const s = useSettings()
  const nie = useNieSchedule()
  const logs = useLiveQuery(() => db.nieDayLog.toArray(), [])
  return useMemo(() => {
    const nieHistory = new Map<ISODate, NieSlot[]>(
      (logs ?? []).map((l) => [
        l.date,
        l.slots.map((x) => ({
          chapter: x.chapter, first: false, last: false,
          steps: x.steps.map((c) => ({ ...c, stepMinutes: nieChapterMeta(x.chapter)?.stepMinutes[c.step - 1] ?? c.minutes })),
        })),
      ]),
    )
    return buildPlan(s, { preOrder: preAcademyOrder, temario: nieTemario, fitnessWeek, nie, nieHistory })
  }, [s, nie, logs])
}

/** Fecha de hoy en Londres; se actualiza sola al pasar la medianoche. */
export function useToday(): ISODate {
  const [today, setToday] = useState(todayISO())
  useEffect(() => {
    const t = setInterval(() => setToday(todayISO()), 60_000)
    return () => clearInterval(t)
  }, [])
  return today
}

export function useDoneLessons(): Set<string> {
  const rows = useLiveQuery(() => db.lessonProgress.toArray(), [])
  return useMemo(() => new Set((rows ?? []).map((r) => r.lessonId)), [rows])
}

// ---------- Banco de flashcards y preguntas (contenido + las tuyas) ----------

export function useAllCards(): Card[] | undefined {
  const user = useLiveQuery(() => db.userCards.toArray(), [])
  return useMemo(
    () =>
      user && [
        ...contentCards,
        ...user.map((u) => ({ id: `u:${u.id}`, subjectId: u.subjectId, lessonId: u.lessonId, front: u.front, back: u.back })),
      ],
    [user],
  )
}

export function useAllQuestions(): Question[] | undefined {
  const user = useLiveQuery(() => db.userQuestions.toArray(), [])
  return useMemo(() => user && [...contentQuestions, ...user.map((u) => ({ ...u, id: `uq:${u.id}` }))], [user])
}

/** Cola de flashcards de hoy: todas, o solo las de una asignatura. */
export function useCardQueue(subjectId?: string) {
  const today = useToday()
  const settings = useSettings()
  const cards = useAllCards()
  const states = useLiveQuery(() => db.cardState.toArray(), [])
  return useMemo(() => {
    if (!cards || !states) return undefined
    const map = new Map(states.map((s) => [s.cardId, s]))
    const list = subjectId ? cards.filter((c) => c.subjectId === subjectId) : cards
    const q = buildQueue({ cardIds: list.map((c) => c.id), states: map, today, newLimit: settings.dailyNewCards, reviewLimit: settings.dailyReviewCards })
    const reviewedToday = states.filter((s) => s.lastReviewed === today).length
    return { ...q, cards: list, states: map, reviewedToday }
  }, [cards, states, today, settings.dailyNewCards, settings.dailyReviewCards, subjectId])
}
