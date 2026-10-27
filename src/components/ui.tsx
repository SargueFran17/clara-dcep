import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {children}
    </div>
  )
}

export function PageHeader({ title, subtitle, back, right }: { title: string; subtitle?: ReactNode; back?: boolean | string; right?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="mb-4 flex items-start gap-2">
      {back && (
        <button
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
          className="-ml-2 rounded-full p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
          aria-label="Volver"
        >
          ←
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</div>}
      </div>
      {right}
    </header>
  )
}

const BAR_COLORS: Record<string, string> = {
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  sky: 'bg-sky-500',
}

export function ProgressBar({ pct, color = 'indigo', className = '' }: { pct: number; color?: string; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all ${BAR_COLORS[color] ?? BAR_COLORS.indigo}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
        checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-indigo-400 dark:border-slate-600'
      }`}
    >
      {checked && '✓'}
    </button>
  )
}

const PILL: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  red: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
}

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: keyof typeof PILL }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${PILL[tone]}`}>{children}</span>
}

export function Button({
  children, onClick, variant = 'primary', className = '', type = 'button', disabled,
}: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger'; className?: string; type?: 'button' | 'submit'; disabled?: boolean }) {
  const styles = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-slate-400',
    ghost: 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
    danger: 'bg-rose-600 text-white hover:bg-rose-500',
  }[variant]
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${styles} ${className}`}>
      {children}
    </button>
  )
}

export function RowLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700">
      {children}
    </Link>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">{children}</p>
}
