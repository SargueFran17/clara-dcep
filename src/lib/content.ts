import structureJson from '../../content/structure.json'
import preJson from '../../content/plan/pre-academy.json'
import nieJson from '../../content/plan/nie-order.json'
import fitnessJson from '../../content/fitness/plan.json'
import type { Folder, LessonMeta, NieGroupItem, Structure, Subject, WorkoutItem } from '../types'

// Todo el contenido vive en /content y se empaqueta al compilar.

export const structure = structureJson as Structure
export const preAcademyOrder: string[] = preJson.lessons
export const nieGroups: NieGroupItem[][] = nieJson.groups
export const fitnessWeek = fitnessJson.week as { day: number; items: WorkoutItem[] }[]

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
