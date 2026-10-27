import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Today } from './screens/Today'
import { Week } from './screens/Week'
import { FolderView, Folders, SubjectView } from './screens/Folders'
import { LessonView } from './screens/LessonView'
import { Settings } from './screens/Settings'
import { ComingSoon, More, Search } from './screens/More'

// las gráficas (recharts) se cargan solo al abrir Progreso
const Progress = lazy(() => import('./screens/Progress').then((m) => ({ default: m.Progress })))

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
          <Route path="academia/*" element={<ComingSoon title="Academia" phase={2} />} />
          <Route path="nie/capitulos" element={<ComingSoon title="NIE · capítulos" phase={2} />} />
          <Route path="nie/simulacros" element={<ComingSoon title="NIE · simulacros" phase={2} />} />
          <Route path="errores" element={<ComingSoon title="Registro de errores" phase={2} />} />
          <Route path="glosario" element={<ComingSoon title="Glosario y acrónimos" phase={3} />} />
          <Route path="fitness" element={<ComingSoon title="Fitness" phase={3} />} />
          <Route path="*" element={<Today />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
