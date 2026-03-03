import { describe, it, expect } from 'vitest'

import { formatSlug } from '@/server/payload/fields/formatSlug'

describe('formatSlug', () => {
  describe('Hebrew support', () => {
    it('should produce non-empty slug for Hebrew-only title (via fallback)', () => {
      // Note: slugify with strict:true and locale:'he' strips Hebrew characters,
      // resulting in an empty string. The fallback mechanism ensures non-empty slugs.
      const result = formatSlug('שלום עולם')
      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
      // Fallback should be used since slugify returns empty for Hebrew with strict mode
      expect(result).toMatch(/^item-[a-z0-9]+$/)
    })

    it('should produce non-empty slug for mixed Hebrew/English title', () => {
      const result = formatSlug('כיתה 8 - Algebra בסיסי')
      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle Hebrew with diacritics/niqqud', () => {
      // With strict mode, Hebrew is stripped → empty → fallback
      const result = formatSlug('שָׁלוֹם עוֹלָם')
      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
      // Should use fallback since Hebrew is stripped
      expect(result).toMatch(/^item-[a-z0-9]+$/)
    })
  })

  describe('English/Latin support', () => {
    it('should produce lowercase hyphenated slug for English title', () => {
      const result = formatSlug('Hello World')
      expect(result).toBe('hello-world')
    })

    it('should handle numbers in title', () => {
      const result = formatSlug('Lesson 1 Introduction')
      expect(result).toBe('lesson-1-introduction')
    })
  })

  describe('strict mode', () => {
    it('should remove special characters in strict mode', () => {
      const result = formatSlug('Test & Demo: v2.0')
      expect(result).toBe('test-and-demo-v20')
    })

    it('should remove asterisks, hashes, and at signs', () => {
      const result = formatSlug('Test*#@File')
      expect(result).toBe('testfile')
    })
  })

  describe('fallback behavior', () => {
    it('should return transformed punctuation (not fallback) when slugify produces non-empty result', () => {
      // slugify transforms !@#$% to "dollarpercent" (not empty), so it's returned as-is
      const result = formatSlug('!@#$%')
      expect(result).toBe('dollarpercent')
    })

    it('should return provided fallback for whitespace-only input', () => {
      const result = formatSlug('   ', 'whitespace-fallback')
      expect(result).toBe('whitespace-fallback')
    })

    it('should return timestamp-based fallback for empty string without explicit fallback', () => {
      const result = formatSlug('')
      expect(result).toMatch(/^item-[a-z0-9]+$/)
    })

    it('should return timestamp-based fallback for whitespace-only without explicit fallback', () => {
      const result = formatSlug('   ')
      expect(result).toMatch(/^item-[a-z0-9]+$/)
    })
  })

  describe('general behavior', () => {
    it('should handle whitespace in input', () => {
      const result = formatSlug('  Hello   World  ')
      expect(result).toBe('hello-world')
    })

    it('should handle mixed case input', () => {
      const result = formatSlug('UPPERCASE lowercase Mixed')
      expect(result).toBe('uppercase-lowercase-mixed')
    })
  })
})
