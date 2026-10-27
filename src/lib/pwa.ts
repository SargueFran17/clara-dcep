import { registerSW } from 'virtual:pwa-register'

// Actualizaciones de la app instalada: busca versión nueva al abrirla, al volver a ella y cada
// 30 minutos; cuando la hay, se instala y la página se recarga sola (tus datos no se tocan).

let updateSW: ((reload?: boolean) => Promise<void>) | undefined
let registration: ServiceWorkerRegistration | undefined

export function setupPWA() {
  if (!('serviceWorker' in navigator)) return
  updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, r) {
      registration = r
      if (!r) return
      setInterval(() => r.update(), 30 * 60 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') r.update()
      })
    },
  })
}

/** Botón "Actualizar ahora": busca la última versión y recarga. */
export async function checkForUpdate() {
  await registration?.update()
  await updateSW?.(true)
  location.reload()
}

/** Fecha y hora de esta versión (se fija al compilar). */
export const BUILD = __BUILD__
