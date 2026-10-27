// Utilidades para las lecciones en Markdown.

export type Segment = { lang: 'en' | 'es'; text: string }

export function splitSpanish(md: string): Segment[] {
  const out: Segment[] = []
  const re = /^:::es[ \t]*\n([\s\S]*?)^:::[ \t]*$/gm
  let last = 0
  for (let m = re.exec(md); m; m = re.exec(md)) {
    if (m.index > last) out.push({ lang: 'en', text: md.slice(last, m.index) })
    out.push({ lang: 'es', text: m[1] })
    last = m.index + m[0].length
  }
  if (last < md.length) out.push({ lang: 'en', text: md.slice(last) })
  return out.filter((s) => s.text.trim())
}

/** Quita el frontmatter YAML (--- … ---) del principio. */
export function stripFrontmatter(md: string): { body: string; meta: Record<string, string> } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(md)
  if (!m) return { body: md, meta: {} }
  const meta: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '')
  }
  return { body: md.slice(m[0].length), meta }
}
