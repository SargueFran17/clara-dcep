import { NavLink } from 'react-router-dom'

/** Pestañas Semana | Mes. */
export function CalendarTabs() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex-1 rounded-xl py-1.5 text-center text-sm font-semibold ${isActive ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500'}`
  return (
    <div className="mb-3 flex gap-1 rounded-2xl bg-slate-200/70 p-1 dark:bg-slate-800">
      <NavLink to="/semana" className={cls}>Semana</NavLink>
      <NavLink to="/mes" className={cls}>Mes</NavLink>
    </div>
  )
}
