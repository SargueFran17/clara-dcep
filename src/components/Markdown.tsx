import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSettings } from '../lib/hooks'
import { splitSpanish } from '../lib/markdown'

// Las lecciones están en inglés. Los bloques
//   :::es
//   texto en español
//   :::
// se muestran plegados con un botón "Ver en español".

function SpanishBlock({ text, always }: { text: string; always: boolean }) {
  const [open, setOpen] = useState(always)
  return (
    <div className="my-3">
      {!always && (
        <button
          onClick={() => setOpen(!open)}
          className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
        >
          {open ? 'Ocultar español' : '🇪🇸 Ver en español'}
        </button>
      )}
      {(open || always) && (
        <div className="mt-2 rounded-xl border-l-4 border-amber-400 bg-amber-50 px-4 py-1 dark:bg-amber-950/30">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}

export function Markdown({ text }: { text: string }) {
  const { spanish } = useSettings()
  return (
    <div className="prose-lesson">
      {splitSpanish(text).map((s, i) =>
        s.lang === 'es' ? (
          <SpanishBlock key={i} text={s.text} always={spanish === 'always'} />
        ) : (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
            {s.text}
          </ReactMarkdown>
        ),
      )}
    </div>
  )
}
