import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Today } from './screens/Today'
import { Week } from './screens/Week'
import { FolderView, Folders, SubjectView } from './screens/Folders'
import { LessonView } from './screens/LessonView'
import { Settings } from './screens/Settings'
import { More, Search } from './screens/More'
import { Glossary } from './screens/Glossary'
import { Academy, AcademyDayView, AcademyModuleView } from './screens/Academy'
import { NieChapter, NieChapterList } from './screens/NieChapters'
import { Exam, MockCenter } from './screens/Exam'
import { Practice } from './screens/Practice'
import { Flashcards } from './screens/Flashcards'
import { Errors } from './screens/Errors'
import { Reviews } from './screens/Reviews'

// las gráficas (recharts) se cargan solo al abrir Progreso
const Progress = lazy(() => import('./screens/Progress').then((m) => ({ default: m.Progress })))
const Fitness = lazy(() => import('./screens/Fitness').then((m) => ({ default: m.Fitness })))

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Today />} />
          <Route path="semana" element={<Week />} />
          <Route path="carpetas" element={<Folders />} />
          <Route path="carpetas/:folderId" element={<FolderView />} />
          <Route path="asignatura/:subjectId" element={<SubjectView />} />
          <Route path="leccion/:lessonId" element={<LessonView />} />
          <Route path="progreso" element={<Suspense fallback={null}><Progress /></Suspense>} />
          <Route path="mas" element={<More />} />
          <Route path="ajustes" element={<Settings />} />
          <Route path="buscar" element={<Search />} />
          <Route path="academia" element={<Academy />} />
          <Route path="academia/dia/:date" element={<AcademyDayView />} />
          <Route path="academia/modulo/:id" element={<AcademyModuleView />} />
          <Route path="nie/capitulos" element={<NieChapterList />} />
          <Route path="nie/capitulo/:chapter" element={<NieChapter />} />
          <Route path="nie/simulacros" element={<MockCenter />} />
          <Route path="nie/repasos" element={<Reviews />} />
          <Route path="examen" element={<Exam />} />
          <Route path="test" element={<Practice />} />
          <Route path="flashcards" element={<Flashcards />} />
          <Route path="flashcards/:subjectId" element={<Flashcards />} />
          <Route path="errores" element={<Errors />} />
          <Route path="glosario" element={<Glossary />} />
          <Route path="fitness" element={<Suspense fallback={null}><Fitness /></Suspense>} />
          <Route path="*" element={<Today />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
