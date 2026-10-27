import type { ErrorType } from '../types'

export const ERROR_TYPES: { id: ErrorType; label: string; short: string }[] = [
  { id: 'concept', label: 'Concepto no sabido', short: 'Concepto' },
  { id: 'keyword', label: 'Palabra clave / lectura', short: 'Palabra clave' },
  { id: 'language', label: 'Idioma (inglés legal)', short: 'Idioma' },
  { id: 'confused', label: 'Confundí delitos o poderes', short: 'Confusión' },
  { id: 'detail', label: 'Detalle (plazos, rangos)', short: 'Detalle' },
  { id: 'rush', label: 'Despiste / prisa', short: 'Despiste' },
]
