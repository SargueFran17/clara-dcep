import { diffDays, type ISODate } from './dates'
import type { WeightEntry } from '../types'

// Seguimiento de peso prudente: sin contar calorías, solo tendencia semanal.
// El NHS recomienda perder peso de forma gradual, en torno a 0,5–1 kg por semana.
export const SAFE_MAX_KG_PER_WEEK = 1

/**
 * Ritmo medio (kg/semana) entre el primer y el último registro de las últimas `weeks` semanas.
 * Positivo = pérdida. null si no hay datos suficientes (2 registros separados ≥ 7 días).
 */
export function weeklyLossRate(entries: WeightEntry[], today: ISODate, weeks = 4): number | null {
  const recent = entries.filter((e) => diffDays(today, e.date) <= weeks * 7 && e.date <= today).sort((a, b) => a.date.localeCompare(b.date))
  if (recent.length < 2) return null
  const first = recent[0]
  const last = recent[recent.length - 1]
  const days = diffDays(last.date, first.date)
  if (days < 7) return null
  return +(((first.kg - last.kg) / days) * 7).toFixed(2)
}

export type RateAdvice = 'tooFast' | 'good' | 'gaining' | 'stable' | 'unknown'

export function rateAdvice(rate: number | null): RateAdvice {
  if (rate === null) return 'unknown'
  if (rate > SAFE_MAX_KG_PER_WEEK) return 'tooFast'
  if (rate >= 0.25) return 'good'
  if (rate <= -0.25) return 'gaining'
  return 'stable'
}

/** Estándar nacional del test físico: nivel 5.4 en el 15 m multi-stage fitness test (confirmar con Hampshire). */
export const BLEEP_TARGET_LEVEL = { level: 5, shuttle: 4 }

export function bleepReached(r: { level: number; shuttle: number }, target = BLEEP_TARGET_LEVEL): boolean {
  return r.level > target.level || (r.level === target.level && r.shuttle >= target.shuttle)
}

/** Para gráficas: 5.4 → 5 + 4/20 (aprox. lineal dentro del nivel). */
export const bleepScore = (r: { level: number; shuttle: number }) => r.level + r.shuttle / 20
