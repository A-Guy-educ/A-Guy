/**
 * Unit Tests for Lesson Context Injection
 *
 * Tests buildLessonContextPrompt function:
 * - Injection of lesson context into system prompt
 * - Preservation of original system prompt
 * - Handling of undefined/empty context
 * - Size validation
 * - Delimiter wrapping
 */
import { describe, expect, it } from 'vitest'
import {
  buildLessonContextPrompt,
  LESSON_CONTEXT_BLOCK_END,
  LESSON_CONTEXT_BLOCK_START,
  LESSON_CONTEXT_MAX_CHARS,
} from '@/lib/ai/lesson-context'

describe('buildLessonContextPrompt', () => {
  const baseSystemPrompt = 'You are a helpful assistant.'

  describe('injection behavior', () => {
    it('should inject lessonContextText into system prompt', () => {
      const lessonContext = 'This lesson covers basic algebra concepts.'
      const result = buildLessonContextPrompt(baseSystemPrompt, lessonContext)

      expect(result).toContain(lessonContext)
      expect(result).toContain(LESSON_CONTEXT_BLOCK_START)
      expect(result).toContain(LESSON_CONTEXT_BLOCK_END)
    })

    it('should preserve original system prompt', () => {
      const lessonContext = 'This lesson covers basic algebra concepts.'
      const result = buildLessonContextPrompt(baseSystemPrompt, lessonContext)

      expect(result).toContain(baseSystemPrompt)
      expect(result.startsWith(baseSystemPrompt)).toBe(true)
    })

    it('should wrap context in delimiters', () => {
      const lessonContext = 'Test context'
      const result = buildLessonContextPrompt(baseSystemPrompt, lessonContext)

      const startIndex = result.indexOf(LESSON_CONTEXT_BLOCK_START)
      const endIndex = result.indexOf(LESSON_CONTEXT_BLOCK_END)

      expect(startIndex).toBeGreaterThan(-1)
      expect(endIndex).toBeGreaterThan(-1)
      expect(startIndex).toBeLessThan(endIndex)
      expect(result).toContain('## Lesson Context')
    })
  })

  describe('edge cases', () => {
    it('should return original when lessonContext is undefined', () => {
      const result = buildLessonContextPrompt(baseSystemPrompt, undefined)
      expect(result).toBe(baseSystemPrompt)
      expect(result).not.toContain(LESSON_CONTEXT_BLOCK_START)
      expect(result).not.toContain(LESSON_CONTEXT_BLOCK_END)
    })

    it('should return original when lessonContext is null', () => {
      const result = buildLessonContextPrompt(baseSystemPrompt, null)
      expect(result).toBe(baseSystemPrompt)
      expect(result).not.toContain(LESSON_CONTEXT_BLOCK_START)
      expect(result).not.toContain(LESSON_CONTEXT_BLOCK_END)
    })

    it('should return original when lessonContext is empty', () => {
      const result = buildLessonContextPrompt(baseSystemPrompt, '')
      expect(result).toBe(baseSystemPrompt)
      expect(result).not.toContain(LESSON_CONTEXT_BLOCK_START)
      expect(result).not.toContain(LESSON_CONTEXT_BLOCK_END)
    })

    it('should return original when lessonContext is whitespace only', () => {
      const result = buildLessonContextPrompt(baseSystemPrompt, '   \n\t  ')
      expect(result).toBe(baseSystemPrompt)
      expect(result).not.toContain(LESSON_CONTEXT_BLOCK_START)
      expect(result).not.toContain(LESSON_CONTEXT_BLOCK_END)
    })

    it('should trim lesson context', () => {
      const lessonContext = '  This lesson covers basic algebra.  '
      const result = buildLessonContextPrompt(baseSystemPrompt, lessonContext)

      expect(result).toContain('This lesson covers basic algebra.')
      expect(result).not.toContain('  This lesson covers basic algebra.  ')
    })
  })

  describe('size validation', () => {
    it('should reject oversized lessonContext', () => {
      const oversizedContext = 'a'.repeat(LESSON_CONTEXT_MAX_CHARS + 1)

      expect(() => {
        buildLessonContextPrompt(baseSystemPrompt, oversizedContext)
      }).toThrow('exceeds maximum')
    })

    it('should accept context at exactly max size', () => {
      const maxSizeContext = 'a'.repeat(LESSON_CONTEXT_MAX_CHARS)

      expect(() => {
        buildLessonContextPrompt(baseSystemPrompt, maxSizeContext)
      }).not.toThrow()
    })

    it('should accept context below max size', () => {
      const smallContext = 'a'.repeat(100)

      expect(() => {
        buildLessonContextPrompt(baseSystemPrompt, smallContext)
      }).not.toThrow()
    })
  })
})
