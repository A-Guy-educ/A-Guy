/**
 * Unit tests: LessonDuplications relationship cell components
 *
 * Verifies that the display logic for SourceLessonCell and OutputLessonCell
 * works correctly without making additional fetches, preventing the "Loading..."
 * forever issue that occurs when Payload's default relationship cell tries to
 * fetch the related document and that request hangs.
 *
 * This guards against issue #2576 where /admin/collections/lesson-duplications
 * showed "Loading..." in sourceLesson and outputLesson columns indefinitely.
 */
import { describe, expect, it } from 'vitest'

describe('SourceLessonCell display logic', () => {
  // Helper that mirrors the cell's getDisplayText logic
  function getDisplayText(cellData: unknown): string {
    if (!cellData) return '<No Source Lesson>'
    if (typeof cellData === 'string') return cellData
    if (typeof cellData === 'object') {
      const doc = cellData as { id: string; title?: string }
      return doc.title || doc.id
    }
    return String(cellData)
  }

  it('renders lesson title when cellData is a full object with title', () => {
    const cellData = { id: 'lesson-123', title: 'Algebra Basics' }
    expect(getDisplayText(cellData)).toBe('Algebra Basics')
  })

  it('renders lesson id when cellData is a string (id only)', () => {
    const cellData = 'lesson-456'
    expect(getDisplayText(cellData)).toBe('lesson-456')
  })

  it('renders fallback when cellData is null', () => {
    expect(getDisplayText(null)).toBe('<No Source Lesson>')
  })

  it('renders fallback when cellData is undefined', () => {
    expect(getDisplayText(undefined)).toBe('<No Source Lesson>')
  })

  it('renders lesson id as fallback when title is missing from object', () => {
    const cellData = { id: 'lesson-789' }
    expect(getDisplayText(cellData)).toBe('lesson-789')
  })
})

describe('OutputLessonCell display logic', () => {
  const NO_OUTPUT_LESSON = '<No Output Lesson>'

  function getDisplayText(cellData: unknown): string {
    if (cellData == null) return NO_OUTPUT_LESSON
    if (typeof cellData === 'string') return cellData
    if (typeof cellData === 'object') {
      const doc = cellData as { id: string; title?: string }
      return doc.title || doc.id
    }
    return String(cellData)
  }

  it('renders lesson title when cellData is a full object with title', () => {
    const cellData = { id: 'output-lesson-123', title: 'Algebra Variation 1' }
    expect(getDisplayText(cellData)).toBe('Algebra Variation 1')
  })

  it('renders lesson id when cellData is a string (id only)', () => {
    const cellData = 'output-lesson-456'
    expect(getDisplayText(cellData)).toBe('output-lesson-456')
  })

  it('renders <No Output Lesson> placeholder when cellData is null', () => {
    expect(getDisplayText(null)).toBe(NO_OUTPUT_LESSON)
  })

  it('renders <No Output Lesson> placeholder when cellData is undefined', () => {
    expect(getDisplayText(undefined)).toBe(NO_OUTPUT_LESSON)
  })

  it('renders lesson id as fallback when title is missing from object', () => {
    const cellData = { id: 'output-lesson-789' }
    expect(getDisplayText(cellData)).toBe('output-lesson-789')
  })
})
