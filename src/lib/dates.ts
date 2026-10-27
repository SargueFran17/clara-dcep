// Fechas como cadenas ISO "aaaa-mm-dd" (día civil en Europe/London).
// Toda la aritmética se hace en UTC para evitar problemas con el cambio de hora.

export type ISODate = string

const TZ = 'Europe/London'

function toUTC(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fromUTC(date: Date): ISODate {
  return date.toISOString().slice(0, 10)
}

/** Fecha de hoy en Londres. */
export function todayISO(now: Date = new Date()): ISODate {
  // en-CA formatea como aaaa-mm-dd
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = toUTC(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return fromUTC(d)
}

/** Suma meses; si el día no existe (31 → febrero) se queda en el último día del mes. */
export function addMonths(iso: ISODate, n: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + n, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return fromUTC(target)
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86_400_000)
}

/** 0 = lunes … 6 = domingo */
export function weekday(iso: ISODate): number {
  return (toUTC(iso).getUTCDay() + 6) % 7
}

export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, -weekday(iso))
}

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/** dd/mm/aaaa */
export function fmtUK(iso: ISODate): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** dd/mm */
export function fmtShort(iso: ISODate): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const DAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function dayName(iso: ISODate): string {
  return DAYS[weekday(iso)]
}

export function dayLetter(iso: ISODate): string {
  return DAYS_SHORT[weekday(iso)]
}

/** "martes 27 oct" */
export function fmtLong(iso: ISODate): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${dayName(iso)} ${d} ${MONTHS[m - 1]}`
}
