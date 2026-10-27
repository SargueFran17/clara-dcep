import { useEffect } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { useSettings } from '../lib/hooks'

const TABS = [
  { to: '/', label: 'Hoy', icon: '☀️' },
  { to: '/semana', label: 'Semana', icon: '🗓️' },
  { to: '/carpetas', label: 'Carpetas', icon: '📚' },
  { to: '/progreso', label: 'Progreso', icon: '📈' },
  { to: '/mas', label: 'Más', icon: '☰' },
]

export function Layout() {
  const { theme } = useSettings()

  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* modo privado */
    }
    apply()
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <Link to="/" className="text-sm font-bold tracking-tight text-indigo-700 dark:text-indigo-300">
          Clara · DCEP
        </Link>
        <Link to="/buscar" className="rounded-full px-3 py-1 text-sm text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800" aria-label="Buscar">
          🔍 Buscar
        </Link>
      </div>
      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}`
              }
            >
              <span className="text-lg leading-none" aria-hidden>
                {t.icon}
              </span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
