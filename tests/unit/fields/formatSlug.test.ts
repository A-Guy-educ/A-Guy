import { describe, it, expect, vi } from 'vitest'

import { formatSlug, formatSlugAsync, stripCopySuffix } from '@/server/payload/fields/formatSlug'

// Mock the translation module
vi.mock('@/server/payload/fields/translateForSlug', () => ({
  containsHebrew: (input: string) => /[\u0590-\u05FF]/.test(input),
  translateHebrewForSlug: vi.fn().mockResolvedValue('hello world'),
}))

describe('formatSlug', () => {
  describe('Hebrew transliteration', () => {
    it('should transliterate Hebrew-only title to Latin slug', () => {
      const result = formatSlug('שלום עולם')
      expect(result).toBe('shlvm-avlm')
    })

    it('should transliterate mixed Hebrew/English title', () => {
      const result = formatSlug('כיתה 8 - Algebra בסיסי')
      expect(result).toBe('kyth-8-algebra-bsysy')
    })

    it('should handle Hebrew with diacritics/niqqud', () => {
      const result = formatSlug('שָׁלוֹם עוֹלָם')
      // Niqqud stripped, then Hebrew transliterated
      expect(result).toBe('shlvm-avlm')
    })

    it('should transliterate final-form letters (sofit)', () => {
      const result = formatSlug('חשבון')
      expect(result).toBe('chshbvn')
    })

    it('should transliterate lesson-style Hebrew title', () => {
      const result = formatSlug('שיעור ראשון')
      expect(result).toBe('shyavr-rshvn')
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

  describe('whitespace trimming (slug 404 prevention)', () => {
    it('should trim leading whitespace from input', () => {
      const result = formatSlug(' hello-world')
      expect(result).toBe('hello-world')
    })

    it('should trim trailing whitespace from input', () => {
      const result = formatSlug('hello-world ')
      expect(result).toBe('hello-world')
    })

    it('should trim input with only trailing space after numbers', () => {
      const result = formatSlug('test-slug-682076 ')
      expect(result).toBe('test-slug-682076')
    })
  })
})

describe('formatSlugAsync', () => {
  it('should translate Hebrew title to English via OpenAI and slugify', async () => {
    // Mock returns 'hello world' for any Hebrew input
    const result = await formatSlugAsync('שלום עולם')
    expect(result).toBe('hello-world')
  })

  it('should pass English titles through without translation', async () => {
    const result = await formatSlugAsync('First Lesson')
    expect(result).toBe('first-lesson')
  })

  it('should fall back to transliteration when translation returns null', async () => {
    const { translateHebrewForSlug } = await import('@/server/payload/fields/translateForSlug')
    vi.mocked(translateHebrewForSlug).mockResolvedValueOnce(null)

    const result = await formatSlugAsync('שלום עולם')
    expect(result).toBe('shlvm-avlm')
  })
})

describe('stripCopySuffix', () => {
  it('should strip Payload " - Copy" suffix', () => {
    expect(stripCopySuffix('bdykt-ytsyrt-slvg - Copy')).toBe('bdykt-ytsyrt-slvg')
  })

  it('should strip Payload " - Copy (2)" suffix', () => {
    expect(stripCopySuffix('my-lesson - Copy (2)')).toBe('my-lesson')
  })

  it('should strip repeated " - Copy" suffixes', () => {
    expect(stripCopySuffix('my-lesson - Copy - Copy')).toBe('my-lesson')
  })

  it('should strip lowercase -copy suffix', () => {
    expect(stripCopySuffix('my-lesson-copy')).toBe('my-lesson')
  })

  it('should strip repeated -copy suffixes', () => {
    expect(stripCopySuffix('my-lesson-copy-copy-copy')).toBe('my-lesson')
  })

  it('should strip -copy-2 suffixes', () => {
    expect(stripCopySuffix('my-lesson-copy-2')).toBe('my-lesson')
  })

  it('should not modify slug without copy suffix', () => {
    expect(stripCopySuffix('my-lesson')).toBe('my-lesson')
  })

  it('should not strip copy from middle of slug', () => {
    expect(stripCopySuffix('copy-lesson')).toBe('copy-lesson')
  })
})
