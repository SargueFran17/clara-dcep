import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { DEFAULT_SETTINGS } from './defaults'
import { buildPlan, type Plan } from './planner'
import { fitnessWeek, nieGroups, preAcademyOrder } from './content'
import { todayISO, type ISODate } from './dates'
import type { Settings } from '../types'

export function useSettings(): Settings {
  const stored = useLiveQuery(() => db.settings.get('main'), [])
  return useMemo(() => ({ ...DEFAULT_SETTINGS, ...stored }), [stored])
}

export function usePlan(): Plan {
  const s = useSettings()
  return useMemo(() => buildPlan(s, { preOrder: preAcademyOrder, nieGroups, fitnessWeek }), [s])
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
