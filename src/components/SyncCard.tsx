import { useState, useSyncExternalStore } from 'react'
import { connectSync, disconnectSync, getSyncState, subscribeSync, syncNow } from '../lib/sync'
import { Button, Card } from './ui'

export const useSync = () => useSyncExternalStore(subscribeSync, getSyncState)

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Clara%20DCEP%20app'
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('es-ES', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short' }) : '—')

/** Ajustes → sincronizar PC y móvil con GitHub. */
export function SyncCard() {
  const s = useSync()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)

  async function connect() {
    setBusy(true)
    try {
      await connectSync(token)
      setToken('')
    } catch {
      /* el error se muestra abajo */
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="mb-1 font-semibold">☁️ Sincronizar PC y móvil (GitHub)</h2>
      {s.token ? (
        <>
          <p className="text-sm">
            ✅ Conectado como <b>{s.login}</b>. Lo que marcas aquí se sube solo y lo del otro aparato se baja al abrir la app y cada minuto.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {s.status === 'syncing' ? '⏳ Sincronizando…' : s.dirty ? '⏳ Cambios pendientes de subir…' : `Última sincronización: ${when(s.lastSync)}`}
          </p>
          {s.error && <p className="mt-1 text-sm text-rose-600">⚠️ {s.error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => syncNow()} disabled={s.status === 'syncing'}>🔄 Sincronizar ahora</Button>
            <Button variant="ghost" onClick={() => confirm('¿Dejar de sincronizar este aparato? Tus datos se quedan aquí y en la nube.') && disconnectSync()}>Desconectar</Button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-2 text-xs text-slate-500">Hazlo una vez en cada aparato (primero en el que tenga tus datos más recientes):</p>
          <ol className="mb-3 list-decimal space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
            <li>
              Abre <a className="font-semibold text-indigo-600 underline" href={TOKEN_URL} target="_blank" rel="noreferrer">este enlace de GitHub</a> (inicia sesión si te lo pide). Ya viene rellenado: solo permiso <b>gist</b>.
            </li>
            <li>En <b>Expiration</b> elige <b>No expiration</b> (o 1 año) y pulsa <b>Generate token</b> abajo del todo.</li>
            <li>Copia la clave (empieza por <code>ghp_</code>) y pégala aquí. Puedes usar la misma clave en el móvil (envíatela por WhatsApp) o crear otra.</li>
          </ol>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_…"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <Button onClick={connect} disabled={!token.trim() || busy}>{busy ? 'Conectando…' : 'Conectar'}</Button>
          </div>
          {s.error && <p className="mt-2 text-sm text-rose-600">⚠️ {s.error}</p>}
          <p className="mt-2 text-[11px] text-slate-500">La clave solo puede leer y escribir tus gists y se guarda únicamente en este aparato. Tus datos van a un gist privado de tu cuenta. Las grabaciones de voz no se sincronizan.</p>
        </>
      )}
    </Card>
  )
}

/** Iconito en la barra de arriba: ☁️✓ al día · ⏳ subiendo · ⚠️ error. */
export function SyncBadge() {
  const s = useSync()
  if (!s.token) return null
  const icon = s.status === 'error' ? '⚠️' : s.status === 'syncing' || s.dirty ? '⏳' : '☁️'
  return (
    <a href="#/ajustes" className="rounded-full px-2 py-1 text-sm" title={s.error ?? (s.dirty ? 'Cambios pendientes de subir' : 'Sincronizado')} aria-label="Estado de la sincronización">
      {icon}
    </a>
  )
}
