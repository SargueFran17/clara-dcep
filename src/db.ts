import Dexie, { type EntityTable } from 'dexie'
import type {
  AcademyDay, AcademyModule, Assessment, BleepEntry, CardState, DayLog, ErrorEntry, Habit, LessonProgress,
  NieChapterState, Recording, Review, Settings, StudySession, TaskDone, TestAttempt, UserCard, UserQuestion,
  WeightEntry, Workout,
} from './types'

// Todo se guarda en el navegador (IndexedDB). Copia de seguridad: Ajustes → Exportar.

export class ClaraDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>
  lessonProgress!: EntityTable<LessonProgress, 'lessonId'>
  reviews!: EntityTable<Review, 'id'>
  taskDone!: Dexie.Table<TaskDone, [string, string]>
  dayLog!: EntityTable<DayLog, 'date'>
  studySessions!: EntityTable<StudySession, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  weights!: EntityTable<WeightEntry, 'id'>
  bleepLevels!: EntityTable<BleepEntry, 'id'>
  habits!: EntityTable<Habit, 'date'>
  nieChapter!: EntityTable<NieChapterState, 'chapterId'>
  cardState!: EntityTable<CardState, 'cardId'>
  errors!: EntityTable<ErrorEntry, 'id'>
  testAttempts!: EntityTable<TestAttempt, 'id'>
  academyDays!: EntityTable<AcademyDay, 'date'>
  academyModules!: EntityTable<AcademyModule, 'id'>
  assessments!: EntityTable<Assessment, 'id'>
  userCards!: EntityTable<UserCard, 'id'>
  userQuestions!: EntityTable<UserQuestion, 'id'>
  recordings!: EntityTable<Recording, 'id'>

  constructor(name = 'clara-dcep') {
    super(name)
    this.version(1).stores({
      settings: 'id',
      lessonProgress: 'lessonId, completedAt',
      reviews: '++id, itemKey, due, doneAt',
      taskDone: '[date+key], date',
      dayLog: 'date',
      studySessions: '++id, date',
      workouts: '++id, date',
      weights: '++id, date',
      bleepLevels: '++id, date',
      habits: 'date',
      nieChapter: 'chapterId',
      cardState: 'cardId, due',
      errors: '++id, date, subjectId, type',
      testAttempts: '++id, date, kind',
      academyDays: 'date',
      academyModules: '++id, order',
      assessments: '++id, date',
      userCards: '++id, subjectId, lessonId, academyDate',
      userQuestions: '++id, subjectId, chapter',
      recordings: '++id, chapterId',
    })
  }
}

export const db = new ClaraDB()
