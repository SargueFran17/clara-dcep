import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useToday } from '../lib/hooks'
import { fmtShort } from '../lib/dates'
import { fmtTimer } from '../lib/exam'
import { Button } from './ui'

/** Paso 9: grábate explicando el tema con el micrófono del navegador y escúchate. */
export function Recorder({ chapterId }: { chapterId: string }) {
  const today = useToday()
  const recordings = useLiveQuery(() => db.recordings.where('chapterId').equals(chapterId).toArray(), [chapterId])
  const [rec, setRec] = useState<MediaRecorder | null>(null)
  const [secs, setSecs] = useState(0)
  const [error, setError] = useState('')
  const chunks = useRef<Blob[]>([])

  useEffect(() => {
    if (!rec) return
    const t = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [rec])

  async function start() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const r = new MediaRecorder(stream)
      chunks.current = []
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' })
        await db.recordings.add({ chapterId, date: today, blob })
      }
      r.start()
      setSecs(0)
      setRec(r)
    } catch {
      setError('No se pudo usar el micrófono. Revisa los permisos del navegador.')
    }
  }

  function stop() {
    rec?.stop()
    setRec(null)
  }

  return (
    <div>
      {rec ? (
        <Button variant="danger" onClick={stop}>⏹ Parar ({fmtTimer(secs)})</Button>
      ) : (
        <Button onClick={start}>🎙️ Grabarme</Button>
      )}
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      <ul className="mt-3 space-y-2">
        {recordings?.map((r) => (
          <li key={r.id} className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{fmtShort(r.date)}</span>
            <AudioPlayer blob={r.blob} />
            <button className="text-xs text-rose-600" onClick={() => confirm('¿Borrar esta grabación?') && db.recordings.delete(r.id!)}>borrar</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AudioPlayer({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return <audio controls src={url} className="h-9 min-w-0 flex-1" />
}
