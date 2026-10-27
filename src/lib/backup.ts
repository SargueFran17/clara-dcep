import { db } from '../db'

// Copia de seguridad: todas las tablas en un JSON. Los audios (Blob) van en base64.

const FORMAT = 'clara-dcep-backup'

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`
}

function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(',')
  const type = head.slice(5, head.indexOf(';'))
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export async function exportBackup(): Promise<string> {
  const tables: Record<string, unknown[]> = {}
  for (const table of db.tables) {
    const rows = await table.toArray()
    tables[table.name] =
      table.name === 'recordings'
        ? await Promise.all(rows.map(async (r) => ({ ...r, blob: await blobToDataUrl(r.blob) })))
        : rows
  }
  return JSON.stringify({ format: FORMAT, version: db.verno, exportedAt: new Date().toISOString(), tables })
}

/** Sustituye TODOS los datos por los de la copia. */
export async function importBackup(json: string) {
  const data = JSON.parse(json)
  if (data?.format !== FORMAT || typeof data.tables !== 'object') throw new Error('El archivo no es una copia de seguridad de esta app.')
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear()
      let rows = (data.tables[table.name] ?? []) as Record<string, unknown>[]
      if (table.name === 'recordings') rows = rows.map((r) => ({ ...r, blob: dataUrlToBlob(r.blob as string) }))
      await table.bulkAdd(rows)
    }
  })
}

export async function resetAll() {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
  })
}
