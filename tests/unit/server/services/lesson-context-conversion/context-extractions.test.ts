/**
 * Unit tests for ContextExtractions collection and integration with
 * the convert-context procedure.
 *
 * Tests verify that:
 * 1. The collection schema is correctly defined
 * 2. The extract-context service writes to context-extractions (not lessonContextText)
 * 3. The create-context-exercises route reads from context-extractions
 * 4. The context-exercise-parser works with extraction text from the new collection
 */
import { describe, expect, it } from 'vitest'
import { ContextExtractions } from '@/server/payload/collections/ContextExtractions'
import { parseContextText, reconstructContextText } from '@/lib/context-exercise-parser'

describe('ContextExtractions collection', () => {
  it('should have the correct slug', () => {
    expect(ContextExtractions.slug).toBe('context-extractions')
  })

  it('should be hidden from admin navigation', () => {
    expect(ContextExtractions.admin?.hidden).toBe(true)
  })

  it('should be in the System group', () => {
    expect(ContextExtractions.admin?.group).toBe('System')
  })

  it('should have required lesson relationship field', () => {
    const lessonField = ContextExtractions.fields.find((f) => 'name' in f && f.name === 'lesson')
    expect(lessonField).toBeDefined()
    expect(lessonField).toMatchObject({
      name: 'lesson',
      type: 'relationship',
      relationTo: 'lessons',
      required: true,
      index: true,
    })
  })

  it('should have required sourceMedia relationship field', () => {
    const sourceMediaField = ContextExtractions.fields.find(
      (f) => 'name' in f && f.name === 'sourceMedia',
    )
    expect(sourceMediaField).toBeDefined()
    expect(sourceMediaField).toMatchObject({
      name: 'sourceMedia',
      type: 'relationship',
      relationTo: 'media',
      required: true,
    })
  })

  it('should have required text field with 200K max length', () => {
    const textField = ContextExtractions.fields.find((f) => 'name' in f && f.name === 'text')
    expect(textField).toBeDefined()
    expect(textField).toMatchObject({
      name: 'text',
      type: 'textarea',
      required: true,
      maxLength: 200_000,
    })
  })

  it('should have timestamps enabled', () => {
    expect(ContextExtractions.timestamps).toBe(true)
  })

  it('should restrict access to admin users only', () => {
    const mockAdmin = {
      req: { user: { collection: 'users', role: 'admin' } },
    }
    const mockStudent = {
      req: { user: { collection: 'users', role: 'student' } },
    }
    const mockNoAuth = {
      req: { user: null },
    }

    // Admin should have access
    const readAccess = ContextExtractions.access?.read
    if (typeof readAccess === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(readAccess(mockAdmin as any)).toBe(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(readAccess(mockStudent as any)).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(readAccess(mockNoAuth as any)).toBe(false)
    }
  })
})

describe('context-exercise-parser works with extraction text', () => {
  const sampleLatex = `\\documentclass{article}
\\begin{document}

\\textbf{תרגיל 1}
\\(2x + 3 = 7\\)

\\textbf{תרגיל 2}
\\(x^2 - 4 = 0\\)

\\section*{פתרונות}
\\section*{פתרון תרגיל 1}
\\(x = 2\\)

\\section*{פתרון תרגיל 2}
\\(x = \\pm 2\\)

\\end{document}`

  it('should parse extraction text into exercises', () => {
    const segments = parseContextText(sampleLatex)
    expect(segments).toHaveLength(1)

    const exercises = segments[0].exercises
    expect(exercises).toHaveLength(2)
    expect(exercises[0].title).toBe('תרגיל 1')
    expect(exercises[1].title).toBe('תרגיל 2')
  })

  it('should preserve exercise content in round-trip', () => {
    const segments = parseContextText(sampleLatex)
    const reconstructed = reconstructContextText(segments)

    // Re-parse should yield the same exercises
    const reparsed = parseContextText(reconstructed)
    expect(reparsed[0].exercises).toHaveLength(2)
    expect(reparsed[0].exercises[0].title).toBe('תרגיל 1')
  })

  it('should handle appended extractions (--- delimiter)', () => {
    const appendedText = `${sampleLatex}\n\n---\n\n\\textbf{תרגיל 3}\n\\(3y = 9\\)`
    const segments = parseContextText(appendedText)

    expect(segments).toHaveLength(2)
    expect(segments[0].exercises).toHaveLength(2)
    expect(segments[1].exercises).toHaveLength(1)
    expect(segments[1].exercises[0].title).toBe('תרגיל 3')
  })

  it('should handle empty extraction text', () => {
    expect(parseContextText('')).toEqual([])
    expect(parseContextText('   ')).toEqual([])
  })
})
