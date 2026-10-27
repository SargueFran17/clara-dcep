/** Minúsculas y sin tildes, para buscar "deteccion" y encontrar "detección". */
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
