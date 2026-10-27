import { describe, expect, it } from 'vitest'
import { splitSpanish, stripFrontmatter } from './markdown'

describe('markdown', () => {
  it('separa los bloques en español', () => {
    const md = 'Intro\n\n:::es\nHola\n:::\n\nMore'
    expect(splitSpanish(md).map((s) => s.lang)).toEqual(['en', 'es', 'en'])
    expect(splitSpanish(md)[1].text.trim()).toBe('Hola')
  })
  it('lee el frontmatter', () => {
    const { body, meta } = stripFrontmatter('---\nid: vo-1\ntitle: "Arrest"\n---\n# Hi')
    expect(meta).toEqual({ id: 'vo-1', title: 'Arrest' })
    expect(body).toBe('# Hi')
  })
})
