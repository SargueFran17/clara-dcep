import type { Folder, NieChapterState, Subject } from '../types'
import type { ChapterStatus } from '../types'

export interface Pct {
  done: number
  total: number
  pct: number
}

const pct = (done: number, total: number): Pct => ({ done, total, pct: total ? Math.round((done / total) * 100) : 0 })

export function subjectProgress(subject: Subject, done: Set<string>): Pct {
  return pct(subject.lessons.filter((l) => done.has(l.id)).length, subject.lessons.length)
}

export function folderProgress(folder: Folder, done: Set<string>): Pct {
  const all = folder.subjects.flatMap((s) => s.lessons)
  return pct(all.filter((l) => done.has(l.id)).length, all.length)
}

export function globalProgress(folders: Folder[], done: Set<string>): Pct {
  const all = folders.flatMap((f) => f.subjects.flatMap((s) => s.lessons))
  return pct(all.filter((l) => done.has(l.id)).length, all.length)
}

export const NIE_STEPS = [
  { title: '3 preguntas sin leer', minutes: 10 },
  { title: '1ª lectura del manual', minutes: 90 },
  { title: 'Workbook', minutes: 45 },
  { title: 'Recall questions', minutes: 30 },
  { title: '2ª lectura', minutes: 60 },
  { title: 'Repetir las 3 preguntas iniciales', minutes: 10 },
  { title: 'Audios y vídeos', minutes: 30 },
  { title: 'Todas las preguntas posibles', minutes: 60 },
  { title: 'Explicarlo en voz alta', minutes: 15 },
  { title: 'Escribir el tema (resumen)', minutes: 45 },
] as const

export interface ChapterInfo {
  status: ChapterStatus
  stepsDone: number
  reviewsDone: number
}

/** Pendiente → En curso (x/10) → Estudiado → En repaso (n) → Final ✓ */
export function chapterStatus(state: NieChapterState | undefined, reviewsDone: number, studied: boolean): ChapterInfo {
  const stepsDone = state?.steps.filter(Boolean).length ?? 0
  let status: ChapterStatus = 'pending'
  if (state?.finalDoneAt) status = 'final'
  else if (studied && reviewsDone > 0) status = 'reviewing'
  else if (studied) status = 'studied'
  else if (stepsDone > 0) status = 'inProgress'
  return { status, stepsDone, reviewsDone }
}

export const CHAPTER_STATUS_LABEL: Record<ChapterStatus, string> = {
  pending: 'Pendiente',
  inProgress: 'En curso',
  studied: 'Estudiado',
  reviewing: 'En repaso',
  final: 'Final ✓',
}

export function chapterLabel(info: ChapterInfo): string {
  if (info.status === 'inProgress') return `En curso ${info.stepsDone}/10`
  if (info.status === 'reviewing') return `En repaso (${info.reviewsDone})`
  return CHAPTER_STATUS_LABEL[info.status]
}
