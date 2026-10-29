import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import { resetAll } from './backup'
import { connectSync, decide, disconnectSync, getSyncState, setupSync, syncNow } from './sync'
import { completeLesson, saveSettings } from './actions'

describe('decide', () => {
  it('sube, baja, nada o conflicto', () => {
    expect(decide(3, false, 3)).toBe('none')
    expect(decide(3, true, 3)).toBe('push')
    expect(decide(3, false, 4)).toBe('pull')
    expect(decide(3, true, 4)).toBe('conflict')
    expect(decide(5, false, 0)).toBe('push')
  })
})

// GitHub falso en memoria: un usuario y sus gists
function fakeGitHub() {
  const gists = new Map<string, { id: string; description: string; files: Record<string, { content: string }> }>()
  let n = 0
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  return vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.replace('https://api.github.com', '')
    const method = init.method ?? 'GET'
    if (path === '/user') return json({ login: 'clara' })
    if (path.startsWith('/gists?')) return json([...gists.values()])
    if (path === '/gists' && method === 'POST') {
      const body = JSON.parse(init.body as string)
      const g = { id: `g${++n}`, description: body.description, files: body.files }
      gists.set(g.id, g)
      return json(g, 201)
    }
    const id = path.split('/')[2]
    const g = gists.get(id)
    if (!g) return json({}, 404)
    if (method === 'PATCH') {
      const body = JSON.parse(init.body as string)
      g.files = { ...g.files, ...body.files }
    }
    return json({ ...g, files: Object.fromEntries(Object.entries(g.files).map(([k, f]) => [k, { ...f, truncated: false }])) })
  })
}

describe('sincronización PC ↔ móvil', () => {
  beforeEach(async () => {
    await resetAll()
    vi.stubGlobal('fetch', fakeGitHub())
    vi.stubGlobal('confirm', () => true)
  })
  afterEach(() => {
    disconnectSync()
    vi.unstubAllGlobals()
  })

  it('lo que marcas en un aparato llega al otro', async () => {
    setupSync()
    // PC: conecta (crea el gist) y marca una lección
    await connectSync('ghp_test')
    expect(getSyncState().rev).toBe(1)
    await completeLesson('dr-1', '2026-10-31')
    expect(getSyncState().dirty).toBe(true)
    await syncNow()
    expect(getSyncState()).toMatchObject({ rev: 2, dirty: false })

    // Móvil: datos vacíos, se conecta y carga lo del PC
    disconnectSync()
    await resetAll()
    expect(await db.lessonProgress.count()).toBe(0)
    await connectSync('ghp_test')
    expect((await db.lessonProgress.get('dr-1'))?.completedAt).toBe('2026-10-31')
    expect(getSyncState()).toMatchObject({ rev: 2, dirty: false })
  })

  it('guardar lo mismo o datos calculados no provoca subida', async () => {
    setupSync()
    await saveSettings({ theme: 'dark' })
    await connectSync('ghp_test')
    expect(getSyncState().dirty).toBe(false)
    await db.settings.put({ ...(await db.settings.get('main'))!, id: 'main' })
    await db.dayLog.put({ date: '2026-10-31', total: 5, done: 2 })
    expect(getSyncState().dirty).toBe(false)
  })

  it('clave no válida → mensaje claro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    await expect(connectSync('mala')).rejects.toThrow(/clave de GitHub no es válida/)
    expect(getSyncState().status).toBe('error')
  })
})
