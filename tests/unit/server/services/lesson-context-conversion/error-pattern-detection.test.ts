/**
 * Unit tests for error pattern detection in context extraction.
 *
 * Tests verify that the error pattern detection correctly identifies
 * when the LLM returns error text instead of valid LaTeX content.
 */
import { describe, expect, it } from 'vitest'

// Error patterns extracted from extract-context.ts
const errorPatterns = [/^an error occurred/i, /^error:/i, /^sorry,/i, /^i cannot/i, /^i'm sorry/i]

function detectErrorText(text: string): boolean {
  return errorPatterns.some((pattern) => pattern.test(text))
}

describe('error pattern detection', () => {
  describe('should detect LLM error messages', () => {
    const errorTexts = [
      'An error occurred while processing your request.',
      'an error occurred',
      'ERROR: something went wrong',
      'Error: API rate limit exceeded',
      'Sorry, I cannot help with that request.',
      'sorry, I cannot do that',
      "I'm sorry, but I encountered an issue.",
      "i'm sorry, something went wrong",
    ]

    errorTexts.forEach((text) => {
      it(`should detect: "${text}"`, () => {
        expect(detectErrorText(text)).toBe(true)
      })
    })
  })

  describe('should not flag valid LaTeX content', () => {
    const validLatexTexts = [
      '\\documentclass{article}',
      '\\begin{document}\n\\section{Test}\n\\end{document}',
      'This is a normal response with Error in the middle.',
      // Note: "Sorry," at the start would be flagged (limitation of pattern matching)
      // but the error is caught by subsequent validation anyway.
      'I can help you with your math.',
      "I'm happy to explain the solution.",
    ]

    validLatexTexts.forEach((text) => {
      it(`should allow: "${text.substring(0, 50)}..."`, () => {
        expect(detectErrorText(text)).toBe(false)
      })
    })
  })

  describe('should be case-insensitive', () => {
    it('should detect ERROR: in uppercase', () => {
      expect(detectErrorText('ERROR: something failed')).toBe(true)
    })

    it('should detect Error: in mixed case', () => {
      expect(detectErrorText('Error: something failed')).toBe(true)
    })

    it('should detect error: in lowercase', () => {
      expect(detectErrorText('error: something failed')).toBe(true)
    })
  })

  describe('should match at start of text only', () => {
    it('should detect error at beginning', () => {
      expect(detectErrorText('Error: something went wrong')).toBe(true)
    })

    it('should not flag error in middle of valid content', () => {
      // "Error:" appearing mid-sentence should not trigger
      expect(detectErrorText('Here is the solution. Error: see below.')).toBe(false)
    })
  })
})
