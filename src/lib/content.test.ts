import { describe, expect, it } from 'vitest'
import { contentCards, contentQuestions, fileSubject, lessonMarkdown, lessonRef, nieChapters, preAcademyOrder, structure } from './content'
import { stripFrontmatter } from './markdown'

// Comprueba que el contenido de content/ está bien formado (para poder editarlo sin miedo).

describe('contenido', () => {
  it('ids de flashcards y preguntas únicos', () => {
    expect(new Set(contentCards.map((c) => c.id)).size).toBe(contentCards.length)
    expect(new Set(contentQuestions.map((q) => q.id)).size).toBe(contentQuestions.length)
  })

  it('cada pregunta tiene 4 opciones, 4 explicaciones y una correcta válida', () => {
    for (const q of contentQuestions) {
      expect(q.options, q.id).toHaveLength(4)
      expect(q.explanations, q.id).toHaveLength(4)
      expect(q.correct, q.id).toBeGreaterThanOrEqual(0)
      expect(q.correct, q.id).toBeLessThan(4)
    }
  })

  it('las lecciones referenciadas existen', () => {
    for (const x of [...contentCards, ...contentQuestions]) if (x.lessonId) expect(lessonRef(x.lessonId), x.id).toBeDefined()
  })

  it('las lecciones 1 y 2 de cada asignatura están escritas y su frontmatter coincide', () => {
    // NIE: las 2 primeras lecciones son 1.3 y 1.2 (Parte 1); las Partes 2–4 siguen tu orden en la Fase 4
    for (const f of structure.folders)
      for (const s of f.subjects.filter((s) => !s.nie || s.id === 'nie-p1'))
        for (const l of s.lessons.slice(0, 2)) {
          const md = lessonMarkdown(l.id)
          expect(md, `${s.id}/${l.id}`).toBeDefined()
          const { meta, body } = stripFrontmatter(md!)
          expect(meta.id).toBe(l.id)
          for (const h of ['## Objectives', '## Summary', '## Sources']) expect(body, `${l.id} ${h}`).toContain(h)
        }
  })

  it('todas las lecciones de pre-academia están escritas, con flashcards y mini-test', () => {
    for (const id of preAcademyOrder) {
      expect(lessonMarkdown(id), id).toBeDefined()
      expect(contentCards.some((c) => c.lessonId === id), `${id} flashcards`).toBe(true)
      expect(contentQuestions.some((q) => q.lessonId === id), `${id} preguntas`).toBe(true)
    }
  })

  it('los 43 capítulos NIE tienen lección, ≥ 15 preguntas y flashcards', () => {
    expect(nieChapters.length).toBe(43)
    for (const c of nieChapters) {
      expect(lessonMarkdown(`nie-${c.code}`), c.code).toBeTruthy()
      expect(contentQuestions.filter((q) => q.chapter === c.code).length, c.code).toBeGreaterThanOrEqual(15)
      expect(contentCards.filter((x) => x.lessonId === `nie-${c.code}`).length, c.code).toBeGreaterThan(0)
    }
  })

  it('preguntas NIE: capítulo coincide con su lección', () => {
    for (const q of contentQuestions.filter((q) => q.chapter)) expect(q.lessonId).toBe(`nie-${q.chapter}`)
  })

  it('asignatura desde la ruta del archivo', () => {
    expect(fileSubject('../../content/questions/vo.json')).toBe('vo')
    expect(fileSubject('../../content/questions/nie-p1/1.3.json')).toBe('nie-p1')
  })
})
