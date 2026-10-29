import { db } from '../db'
import { exportBackup, importBackup } from './backup'

// Sincronización entre aparatos con un gist PRIVADO de tu cuenta de GitHub.
// - Cada cambio marca el aparato como "con cambios" y se sube a los pocos segundos.
// - Al abrir la app, al volver a ella y cada minuto se mira si el otro aparato subió algo nuevo.
// - Cada subida lleva un nº de versión (rev). Si los dos aparatos cambiaron cosas a la vez, se pregunta.
// La clave (token) se guarda solo en este aparato (localStorage), nunca en la copia de seguridad.

const API = 'https://api.github.com'
const FILE = 'clara-dcep-sync.json'
const DESC = 'Clara DCEP · datos de la app (privado, no borrar)'
const KEY = 'sync'
/** las grabaciones de voz pesan mucho: se quedan en cada aparato */
const SKIP = ['recordings']
/** datos que cada aparato recalcula solo (puntuación del día, foto del plan): se suben, pero no provocan subida */
const DERIVED = ['dayLog', 'nieDayLog']
const PUSH_DELAY = 4000
const POLL_EVERY = 60_000

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error'

export interface SyncState {
  token?: string
  gistId?: string
  login?: string
  /** versión remota con la que está al día este aparato */
  rev: number
  /** hay cambios en este aparato que aún no se han subido */
  dirty: boolean
  lastSync?: string
  status: SyncStatus
  error?: string
}

export type SyncAction = 'none' | 'push' | 'pull' | 'conflict'

/** Qué hacer según la versión local, si hay cambios sin subir y la versión remota. */
export function decide(localRev: number, dirty: boolean, remoteRev: number): SyncAction {
  if (remoteRev > localRev) return dirty ? 'conflict' : 'pull'
  if (remoteRev < localRev) return 'push'
  return dirty ? 'push' : 'none'
}

// ---------------------------------------------------------------- estado

function load(): SyncState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...JSON.parse(raw), status: JSON.parse(raw).token ? 'idle' : 'off', error: undefined }
  } catch {
    /* sin localStorage */
  }
  return { rev: 0, dirty: false, status: 'off' }
}

let state: SyncState = load()
const listeners = new Set<() => void>()

function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  try {
    const { status: _s, error: _e, ...persist } = state
    localStorage.setItem(KEY, JSON.stringify(persist))
  } catch {
    /* sin localStorage */
  }
  listeners.forEach((l) => l())
}

export const getSyncState = () => state
export function subscribeSync(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

// ---------------------------------------------------------------- GitHub

async function gh(path: string, init: RequestInit = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${state.token}`, 'Content-Type': 'application/json', ...init.headers },
  })
  if (res.status === 401) throw new Error('La clave de GitHub no es válida o ha caducado. Crea una nueva y pégala en Ajustes.')
  if (!res.ok) throw new Error(`GitHub respondió ${res.status}. Inténtalo más tarde.`)
  return res.json()
}

interface Remote {
  rev: number
  savedAt: string
  device: string
  data: string
}

async function fetchRemote(): Promise<Remote | null> {
  const gist = await gh(`/gists/${state.gistId}`)
  const file = gist.files?.[FILE]
  if (!file) return null
  const content: string = file.truncated ? await (await fetch(file.raw_url)).text() : file.content
  return JSON.parse(content)
}

const deviceName = () => (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'móvil' : 'ordenador')

async function upload(rev: number) {
  const body: Remote = { rev, savedAt: new Date().toISOString(), device: deviceName(), data: await exportBackup({ skip: SKIP }) }
  await gh(`/gists/${state.gistId}`, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(body) } } }) })
  set({ rev, dirty: false, lastSync: body.savedAt })
}

let applying = false
async function applyRemote(r: Remote) {
  applying = true
  try {
    await importBackup(r.data, { skip: SKIP })
  } finally {
    applying = false
  }
  set({ rev: r.rev, dirty: false, lastSync: new Date().toISOString() })
}

const fmt = (iso: string) => new Date(iso).toLocaleString('es-ES', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short' })

// ---------------------------------------------------------------- sincronizar

let running: Promise<void> | null = null
let again = false

/** Sube o baja lo que haga falta. Nunca corre dos veces a la vez. */
export function syncNow(): Promise<void> {
  if (!state.token || !state.gistId) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    set({ status: 'syncing', error: undefined })
    try {
      const remote = await fetchRemote()
      const action = decide(state.rev, state.dirty, remote?.rev ?? 0)
      if (action === 'pull' && remote) await applyRemote(remote)
      else if (action === 'push') await upload(Math.max(state.rev, remote?.rev ?? 0) + 1)
      else if (action === 'conflict' && remote) {
        const keepOther = confirm(
          `Has marcado cosas en este aparato y también en el ${remote.device} (guardado el ${fmt(remote.savedAt)}).\n\n` +
            `Aceptar = quedarte con lo del ${remote.device} (se pierde lo nuevo de aquí).\nCancelar = quedarte con lo de ESTE aparato (sustituye lo del ${remote.device}).`,
        )
        if (keepOther) await applyRemote(remote)
        else await upload(remote.rev + 1)
      } else set({ lastSync: new Date().toISOString() })
      set({ status: 'idle' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    } finally {
      running = null
    }
    if (again) {
      again = false
      await syncNow()
    }
  })()
  return running
}

/** ¿Alguna modificación cambia de verdad el valor? (las listas y objetos se comparan por contenido) */
export function realChange(mods: Record<string, unknown>, obj: unknown): boolean {
  return Object.entries(mods).some(([path, value]) => {
    const current = path.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj)
    return JSON.stringify(current) !== JSON.stringify(value)
  })
}

let pushTimer: ReturnType<typeof setTimeout> | undefined
function markDirty() {
  if (applying || !state.token) return
  if (!state.dirty) set({ dirty: true })
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void syncNow(), PUSH_DELAY)
}

/**
 * Conecta este aparato con tu GitHub. Si ya hay datos en la nube (del otro aparato), pregunta si
 * cargarlos aquí; si no, sube lo de este aparato.
 */
export async function connectSync(token: string) {
  set({ token: token.trim(), status: 'syncing', error: undefined })
  try {
    const user = await gh('/user')
    const gists: { id: string; description: string; files: Record<string, unknown> }[] = await gh('/gists?per_page=100')
    const found = gists.find((g) => g.description === DESC && g.files[FILE])
    if (found) {
      set({ gistId: found.id, login: user.login, rev: 0, dirty: false })
      const remote = await fetchRemote()
      if (remote) {
        const load = confirm(
          `Ya hay datos guardados desde tu ${remote.device} (${fmt(remote.savedAt)}).\n\n` +
            'Aceptar = cargarlos en este aparato (sustituyen lo de aquí).\nCancelar = subir lo de este aparato (sustituye lo de la nube).',
        )
        if (load) await applyRemote(remote)
        else await upload(remote.rev + 1)
      } else await upload(1)
    } else {
      const created = await gh('/gists', {
        method: 'POST',
        body: JSON.stringify({ description: DESC, public: false, files: { [FILE]: { content: '{}' } } }),
      })
      set({ gistId: created.id, login: user.login, rev: 0 })
      await upload(1)
    }
    set({ status: 'idle' })
  } catch (e) {
    set({ status: 'error', error: (e as Error).message })
    throw e
  }
}

/** Deja de sincronizar este aparato (los datos se quedan aquí y en la nube). */
export function disconnectSync() {
  clearTimeout(pushTimer)
  set({ token: undefined, gistId: undefined, login: undefined, rev: 0, dirty: false, lastSync: undefined, status: 'off', error: undefined })
}

/** Se llama al arrancar: vigila cambios y sincroniza al abrir, al volver y cada minuto. */
export function setupSync() {
  for (const table of db.tables) {
    if (SKIP.includes(table.name) || DERIVED.includes(table.name)) continue
    table.hook('creating', () => markDirty())
    // guardar algo idéntico (sin cambios reales) no cuenta
    table.hook('updating', (mods, _key, obj) => {
      if (realChange(mods as Record<string, unknown>, obj)) markDirty()
    })
    table.hook('deleting', () => markDirty())
  }
  if (typeof window === 'undefined') return
  void syncNow()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  window.addEventListener('online', () => void syncNow())
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, POLL_EVERY)
}
