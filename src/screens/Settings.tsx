import { useRef, useState } from 'react'
import { useSettings } from '../lib/hooks'
import { saveSettings } from '../lib/actions'
import { exportBackup, importBackup, resetAll } from '../lib/backup'
import { BUILD, checkForUpdate } from '../lib/pwa'
import { SyncCard } from '../components/SyncCard'
import { todayISO } from '../lib/dates'
import { DEFAULT_SETTINGS } from '../lib/defaults'
import { Button, Card, PageHeader } from '../components/ui'
import type { Settings as S, WeekKey } from '../types'

type DateKey = { [K in keyof S]: S[K] extends string ? K : never }[keyof S]

const DATE_FIELDS: { key: DateKey; label: string }[] = [
  { key: 'studyStart', label: 'Inicio "en serio"' },
  { key: 'preEnd', label: 'Fin de pre-academia' },
  { key: 'xmasStart', label: 'Navidad: desde' },
  { key: 'xmasEnd', label: 'Navidad: hasta' },
  { key: 'academyStart', label: 'Inicio de la academia' },
  { key: 'nieStart', label: 'Inicio del estudio NIE (1ª vuelta)' },
  { key: 'academyEnd', label: 'Fin de la academia (18 semanas) = fin de la 1ª vuelta' },
  { key: 'nieBlockStart', label: 'Bloque NIE: desde' },
  { key: 'nieBlockEnd', label: 'Bloque NIE: hasta' },
  { key: 'finalReviewStart', label: 'Repaso final: desde (aquí se cortan los repasos espaciados)' },
  { key: 'finalReviewEnd', label: 'Repaso final: hasta' },
  { key: 'examDate', label: 'Examen NIE' },
]

const WEEK: [WeekKey, string][] = [['mon', 'L'], ['tue', 'M'], ['wed', 'X'], ['thu', 'J'], ['fri', 'V'], ['sat', 'S'], ['sun', 'D']]

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800'

export function Settings() {
  const s = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  const [lastCopy, setLastCopy] = useState(() => {
    try {
      return localStorage.getItem('lastCopy') ?? ''
    } catch {
      return ''
    }
  })
  const remember = (text: string) => {
    setLastCopy(text)
    try {
      localStorage.setItem('lastCopy', text)
    } catch {
      /* modo privado */
    }
  }
  const stamp = () => new Date().toLocaleString('es-ES', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short' })

  async function backupFile(): Promise<File> {
    const json = await exportBackup()
    const time = new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }).replace(':', '')
    return new File([json], `clara-dcep-${todayISO()}-${time}.json`, { type: 'application/json' })
  }

  function download(file: File) {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
  }

  async function doExport() {
    download(await backupFile())
    remember(`Copia guardada desde este aparato el ${stamp()}`)
    setMsg('Copia descargada ✓ Pásala al otro aparato (WhatsApp, correo, Drive…) e impórtala allí.')
  }

  /** En el móvil abre el menú de compartir (WhatsApp, correo, Drive…); si no se puede, la descarga. */
  async function doShare() {
    const file = await backupFile()
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Copia Clara DCEP' })
        remember(`Copia enviada desde este aparato el ${stamp()}`)
        setMsg('Copia enviada ✓ Ábrela en el otro aparato con "Importar".')
        return
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
    download(file)
    remember(`Copia guardada desde este aparato el ${stamp()}`)
    setMsg('Este navegador no deja compartir directamente: la copia se ha descargado. Envíatela por correo o Drive.')
  }

  async function doImport(file: File) {
    try {
      const text = await file.text()
      const when = JSON.parse(text)?.exportedAt
      const made = when ? new Date(when).toLocaleString('es-ES', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short' }) : '¿fecha desconocida?'
      if (!confirm(`Copia hecha el ${made}.\n\nEsto SUSTITUYE todo lo de este aparato por lo de la copia. ¿Continuar?`)) return
      await importBackup(text)
      remember(`Importada aquí el ${stamp()} la copia del ${made}`)
      setMsg('Copia importada ✓ Este aparato ya tiene lo mismo que el otro.')
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const listField = (key: 'cumulativeTests' | 'mocks', label: string) => (
    <label className="block text-sm">
      <span className="text-slate-500">{label} (aaaa-mm-dd separadas por comas)</span>
      <input
        className={input}
        defaultValue={s[key].join(', ')}
        key={s[key].join()}
        onBlur={(e) => {
          const dates = e.target.value.split(',').map((x) => x.trim()).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))
          saveSettings({ [key]: dates })
        }}
      />
    </label>
  )

  return (
    <div className="space-y-4">
      <PageHeader title="Ajustes" back="/mas" />

      <SyncCard />

      <Card>
        <h2 className="mb-1 font-semibold">Fechas clave</h2>
        <p className="mb-3 text-xs text-slate-500">Al cambiar una fecha, el calendario entero se recalcula. Formato en pantalla: dd/mm/aaaa.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {DATE_FIELDS.map((f) => (
            <label key={f.key} className="block text-sm">
              <span className="text-slate-500">{f.label}</span>
              <input type="date" lang="en-GB" className={input} value={s[f.key]} onChange={(e) => e.target.value && saveSettings({ [f.key]: e.target.value })} />
            </label>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={s.examConfirmed} onChange={(e) => saveSettings({ examConfirmed: e.target.checked })} />
          <span>Fecha del examen <b>confirmada</b> {!s.examConfirmed && <span className="text-amber-600">(ahora: estimada)</span>}</span>
        </label>
        <div className="mt-4">
          <div className="text-sm font-semibold">Minutos de NIE nuevo por día</div>
          <p className="mb-2 text-xs text-slate-500">La cola del NIE reparte tus pasos según estos minutos (festivos y "Hoy no puedo" = 0).</p>
          <div className="grid grid-cols-7 gap-1">
            {WEEK.map(([k, label]) => (
              <label key={k} className="text-center text-xs">
                <span className="text-slate-500">{label}</span>
                <input
                  type="number" inputMode="numeric" min={0} max={600} step={15}
                  key={s.nieMinutes[k]}
                  defaultValue={s.nieMinutes[k]}
                  onBlur={(e) => e.target.value !== '' && saveSettings({ nieMinutes: { ...s.nieMinutes, [k]: Math.max(0, +e.target.value) } })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-0.5 py-1 text-center text-sm dark:border-slate-700 dark:bg-slate-800"
                  aria-label={`Minutos de NIE el ${label}`}
                />
              </label>
            ))}
          </div>
        </div>
        <div className="mt-3 space-y-3">
          {listField('cumulativeTests', 'Tests acumulados')}
          {listField('mocks', 'Simulacros completos')}
        </div>
        <Button
          variant="ghost"
          className="mt-3"
          onClick={() => {
            const { theme, spanish, dailyNewCards, dailyReviewCards, streakThreshold, nieMinutes } = s
            saveSettings({ ...DEFAULT_SETTINGS, theme, spanish, dailyNewCards, dailyReviewCards, streakThreshold, nieMinutes })
          }}
        >
          Restaurar fechas por defecto
        </Button>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Apariencia e idioma</h2>
        <div className="space-y-3 text-sm">
          <div>
            <div className="mb-1 text-slate-500">Tema</div>
            <div className="flex gap-2">
              {(['system', 'light', 'dark'] as const).map((t) => (
                <Button key={t} variant={s.theme === t ? 'primary' : 'ghost'} onClick={() => saveSettings({ theme: t })}>
                  {{ system: 'Automático', light: '☀️ Claro', dark: '🌙 Oscuro' }[t]}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-slate-500">Explicaciones en español</div>
            <div className="flex gap-2">
              <Button variant={s.spanish === 'tap' ? 'primary' : 'ghost'} onClick={() => saveSettings({ spanish: 'tap' })}>Con un toque</Button>
              <Button variant={s.spanish === 'always' ? 'primary' : 'ghost'} onClick={() => saveSettings({ spanish: 'always' })}>Siempre visibles</Button>
            </div>
          </div>
          <label className="block">
            <span className="text-slate-500">Racha: % de tareas de Hoy para contar el día ({Math.round(s.streakThreshold * 100)} %)</span>
            <input type="range" min={50} max={100} step={5} value={s.streakThreshold * 100} onChange={(e) => saveSettings({ streakThreshold: +e.target.value / 100 })} className="w-full" />
          </label>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Versión de la app</h2>
        <p className="mb-3 text-xs text-slate-500">
          Versión del {BUILD}. La app busca actualizaciones sola al abrirla; si no ves lo último, pulsa el botón (tus datos no se borran).
        </p>
        <Button onClick={() => checkForUpdate()}>🔄 Actualizar ahora</Button>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">📲 Copia de seguridad (a mano)</h2>
        <p className="mb-2 text-xs text-slate-500">
          Si no usas la sincronización de arriba, así pasas los datos de un aparato a otro (y guardas una copia por si acaso):
        </p>
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
          <li>En el aparato donde marcaste las cosas: <b>📤 Enviar copia</b> (WhatsApp, correo, Drive…) o <b>⬇️ Descargar</b>.</li>
          <li>En el otro aparato: <b>⬆️ Importar</b> y elige ese archivo.</li>
          <li>⚠️ Importar <b>sustituye</b> todo lo del aparato: usa siempre la copia más reciente y marca las cosas en uno solo hasta pasarlas.</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button onClick={doShare}>📤 Enviar copia</Button>
          <Button variant="ghost" onClick={doExport}>⬇️ Descargar</Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>⬆️ Importar</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        </div>
        {lastCopy && <p className="mt-2 text-xs text-slate-500">Último movimiento: {lastCopy}</p>}
        {msg && <p className="mt-2 text-sm">{msg}</p>}
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold text-rose-600">Zona peligrosa</h2>
        <Button
          variant="danger"
          onClick={async () => {
            if (confirm('¿Borrar TODOS tus datos (progreso, registros, apuntes)? Exporta antes una copia.')) {
              await resetAll()
              setMsg('Datos borrados.')
            }
          }}
        >
          Borrar todos los datos
        </Button>
      </Card>
    </div>
  )
}
