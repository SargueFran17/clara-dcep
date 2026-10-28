import structureJson from '../../content/structure.json'
import preJson from '../../content/plan/pre-academy.json'
import temarioJson from '../../content/plan/nie-temario.json'
import arranqueJson from '../../content/plan/arranque.json'
import fitnessJson from '../../content/fitness/plan.json'
import { glossaryCards, glossaryQuestions } from './glossary'
import type { Card, Folder, LessonMeta, NieTemario, Question, Structure, Subject, WorkoutItem } from '../types'

// Todo el contenido vive en /content y se empaqueta al compilar.

export const structure = structureJson as Structure
export const preAcademyOrder: string[] = preJson.lessons
/** días con más lecciones de pre-academia (fecha → nº) */
export const preAcademyCapacity: Record<string, number> = (preJson as { capacity?: Record<string, number> }).capacity ?? {}
/** Tareas de arranque (antes del inicio "en serio"). */
export const arranque = arranqueJson as { minutes: number; days: { date: string; label: string }[] }

export const nieTemario = temarioJson as unknown as NieTemario
/** Tus 12 grupos NIE, en tu orden (códigos de capítulo). */
export const nieGroups: string[][] = nieTemario.groups
export const nieChapters = nieTemario.chapters
export const nieChapterMeta = (code: string) => nieChapters.find((c) => c.code === code)
/** Capítulos en TU orden (el de los 12 grupos). */
export const nieOrderedChapters = nieGroups.flat().map((c) => nieChapterMeta(c)!)
export const fitnessWeek = fitnessJson.week as { day: number; items: WorkoutItem[] }[]
/** fecha desde la que cuenta el plan de entreno */
export const fitnessStart: string | undefined = (fitnessJson as { start?: string }).start
/** pesaje semanal */
export const weighIn = (fitnessJson as { weighIn?: { weekday: number; label: string } }).weighIn

const lessonFiles = import.meta.glob('../../content/lessons/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export interface LessonRef {
  lesson: LessonMeta
  subject: Subject
  folder: Folder
}

const byId = new Map<string, LessonRef>()
for (const folder of structure.folders)
  for (const subject of folder.subjects)
    for (const lesson of subject.lessons) byId.set(lesson.id, { lesson, subject, folder })

export function lessonRef(id: string): LessonRef | undefined {
  return byId.get(id)
}

export function allLessons(): LessonRef[] {
  return [...byId.values()]
}

export function findSubject(id: string): { subject: Subject; folder: Folder } | undefined {
  for (const folder of structure.folders)
    for (const subject of folder.subjects) if (subject.id === id) return { subject, folder }
}

export function findFolder(id: string): Folder | undefined {
  return structure.folders.find((f) => f.id === id)
}

/** Texto Markdown de una lección: content/lessons/<carpeta>/<asignatura>/<id>.md */
export function lessonMarkdown(id: string): string | undefined {
  const suffix = `/${id}.md`
  for (const [path, text] of Object.entries(lessonFiles)) if (path.endsWith(suffix)) return text
}

/** Capítulo NIE ("1.3") → id de lección ("nie-1.3") */
export const nieLessonId = (chapter: string) => `nie-${chapter}`

/** Enlace de una lección: los capítulos NIE abren su página de 10 pasos. */
export function lessonLink(id: string): string {
  return lessonRef(id)?.subject.nie ? `/nie/capitulo/${id.slice(4)}` : `/leccion/${id}`
}

// ---------- Flashcards y preguntas: content/flashcards/<asignatura>.json y content/questions/<asignatura>.json ----------

type CardFile = { cards: (Omit<Card, 'id' | 'subjectId'> & { id: string })[] }
type QuestionFile = { questions: (Omit<Question, 'id' | 'subjectId'> & { id: string })[] }

/**
 * Asignatura de un archivo: content/questions/vo.json → "vo";
 * content/questions/nie-p1/1.3.json → "nie-p1" (una carpeta por asignatura, un archivo por capítulo).
 */
export function fileSubject(path: string): string {
  const parts = path.split('/')
  const i = parts.findIndex((p) => p === 'questions' || p === 'flashcards')
  return parts.length - i > 2 ? parts[i + 1] : parts[parts.length - 1].replace(/\.json$/, '')
}

const cardFiles = import.meta.glob('../../content/flashcards/**/*.json', { eager: true, import: 'default' }) as Record<string, CardFile>
const questionFiles = import.meta.glob('../../content/questions/**/*.json', { eager: true, import: 'default' }) as Record<string, QuestionFile>

export const contentCards: Card[] = [
  ...Object.entries(cardFiles).flatMap(([path, file]) => (file.cards ?? []).map((c) => ({ ...c, id: `c:${c.id}`, subjectId: fileSubject(path) }))),
  ...glossaryCards(),
]

export const contentQuestions: Question[] = [
  ...Object.entries(questionFiles).flatMap(([path, file]) => (file.questions ?? []).map((q) => ({ ...q, id: `q:${q.id}`, subjectId: fileSubject(path) }))),
  ...glossaryQuestions(),
]

/** "1.3" → "nie-p1" */
export function nieSubjectOf(chapter: string): string {
  return `nie-p${chapter.split('.')[0]}`
}

/** Nombre legible de una asignatura (incluye las flashcards del diario de academia). */
export function subjectName(id: string): string {
  if (id === 'academy') return 'Diario de academia'
  return findSubject(id)?.subject.name ?? id
}
