import type { ISODate } from './lib/dates'

// ---------- Contenido (content/) ----------

export interface LessonMeta {
  id: string
  code: string
  title: string
  /** ids de lecciones relacionadas (p. ej. conducción ↔ NIE 2.14) */
  links?: string[]
}

export interface Subject {
  id: string
  code: string
  name: string
  lessons: LessonMeta[]
  /** true en las Partes del NIE: las lecciones son capítulos con el método de 10 pasos */
  nie?: boolean
}

export interface Folder {
  id: string
  name: string
  emoji: string
  color: string
  subjects: Subject[]
}

export interface Structure {
  folders: Folder[]
}

export interface NieGroupItem {
  chapter: string
  weight: number
}

export interface WorkoutItem {
  type: 'gym' | 'run' | 'tennis' | 'rest'
  label: string
}

// ---------- Ajustes ----------

export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  id: 'main'
  studyStart: ISODate
  preEnd: ISODate
  xmasStart: ISODate
  xmasEnd: ISODate
  academyStart: ISODate
  academyEnd: ISODate
  nieBlockStart: ISODate
  nieBlockEnd: ISODate
  finalReviewStart: ISODate
  finalReviewEnd: ISODate
  examDate: ISODate
  cumulativeTests: ISODate[]
  mocks: ISODate[]
  theme: Theme
  /** 'tap' = el español se abre con un toque; 'always' = siempre visible */
  spanish: 'tap' | 'always'
  dailyNewCards: number
  dailyReviewCards: number
  /** fracción de tareas de Hoy que cuenta como día cumplido para la racha */
  streakThreshold: number
}

// ---------- Estado del usuario (IndexedDB) ----------

export interface LessonProgress {
  lessonId: string
  status: 'done'
  completedAt: ISODate
}

export interface Review {
  id?: number
  /** 'lesson:<id>' | 'academy:<fecha>' */
  itemKey: string
  anchor: ISODate
  step: number
  due: ISODate
  doneAt?: ISODate
}

export interface TaskDone {
  date: ISODate
  key: string
}

export interface DayLog {
  date: ISODate
  total: number
  done: number
}

export interface StudySession {
  id?: number
  date: ISODate
  minutes: number
  folderId?: string
  note?: string
}

export interface Workout {
  id?: number
  date: ISODate
  type: WorkoutItem['type']
  label: string
  notes?: string
}

export interface WeightEntry {
  id?: number
  date: ISODate
  kg: number
}

export interface BleepEntry {
  id?: number
  date: ISODate
  level: number
}

export interface Habit {
  date: ISODate
  meals?: 'yes' | 'partial' | 'no'
  waterLitres?: number
  sleepHours?: number
}

export type ChapterStatus = 'pending' | 'inProgress' | 'studied' | 'reviewing' | 'final'

export interface NieChapterState {
  chapterId: string
  /** fecha en que completaste cada paso (índice 0–9) */
  steps: (ISODate | null)[]
  confidence?: number
  summary?: string
  finalDoneAt?: ISODate
}

export interface CardState {
  cardId: string
  ease: number
  interval: number
  reps: number
  lapses: number
  due: ISODate
}

export type ErrorType = 'concept' | 'keyword' | 'language' | 'confused' | 'detail' | 'rush'

export interface ErrorEntry {
  id?: number
  date: ISODate
  questionId: string
  subjectId: string
  type: ErrorType
  rule: string
}

export interface TestAttempt {
  id?: number
  date: ISODate
  kind: 'mini' | 'cumulative' | 'mock' | 'practice'
  subjectId?: string
  total: number
  correct: number
  byPart?: Record<string, { total: number; correct: number }>
  durationSec?: number
  answers?: { questionId: string; chosen: number | null; correct: number }[]
}

export interface AcademyDay {
  date: ISODate
  moduleId?: number
  topic?: string
  notes?: string
  keyIdeas?: string[]
  questions?: string
}

export interface AcademyModule {
  id?: number
  name: string
  order: number
}

export interface Assessment {
  id?: number
  date: ISODate
  type: string
  score?: string
  improve?: string
}

export interface UserCard {
  id?: number
  subjectId: string
  lessonId?: string
  academyDate?: ISODate
  front: string
  back: string
}

export interface UserQuestion {
  id?: number
  subjectId: string
  chapter?: string
  scenario: string
  options: string[]
  correct: number
  explanations: string[]
  manualRef?: string
}

export interface Recording {
  id?: number
  chapterId: string
  date: ISODate
  blob: Blob
}
