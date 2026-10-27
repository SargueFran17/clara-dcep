import Dexie, { type EntityTable } from 'dexie'
import type {
  AcademyDay, AcademyModule, Assessment, BleepEntry, CardState, DayLog, DayOff, MockResult, NieDayLog, PlanNote, ErrorEntry, Habit, LessonProgress,
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
  dayOff!: EntityTable<DayOff, 'date'>
  nieDayLog!: EntityTable<NieDayLog, 'date'>
  mockResults!: EntityTable<MockResult, 'date'>
  planNotes!: EntityTable<PlanNote, 'id'>

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
    // v2: temario NIE con cola de estudio ("Hoy no puedo", foto de cada día, resultados de simulacros)
    this.version(2)
      .stores({ dayOff: 'date', nieDayLog: 'date', mockResults: 'date' })
      .upgrade(async (tx) => {
        // fechas nuevas (18 semanas + 5 de bloque NIE) si seguías con las antiguas por defecto
        const OLD: Record<string, [string, string]> = {
          academyEnd: ['2027-04-25', '2027-05-02'],
          nieBlockStart: ['2027-04-26', '2027-05-03'],
          nieBlockEnd: ['2027-05-30', '2027-06-06'],
        }
        await tx.table('settings').toCollection().modify((row: Record<string, unknown>) => {
          for (const [k, [before, after]] of Object.entries(OLD)) if (row[k] === before) row[k] = after
        })
      })
    // v3: objetivo y revisión de cada semana y mes
    this.version(3).stores({ planNotes: 'id' })
  }
}

export const db = new ClaraDB()
