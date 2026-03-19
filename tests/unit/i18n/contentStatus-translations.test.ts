/**
 * @fileType unit-test
 * @domain i18n
 * @pattern translation-keys
 * @ai-summary Tests for contentStatus translation keys in en.json and he.json
 */
import { describe, expect, it } from 'vitest'
import enMessages from '../../../src/i18n/en.json'
import heMessages from '../../../src/i18n/he.json'

describe('contentStatus translations', () => {
  describe('English translations (en.json)', () => {
    it('contains courses.soonBadge key', () => {
      expect(enMessages.courses).toBeDefined()
      expect((enMessages.courses as Record<string, unknown>).soonBadge).toBe('Soon')
    })

    it('contains courses.justAddedBadge key', () => {
      expect(enMessages.courses).toBeDefined()
      expect((enMessages.courses as Record<string, unknown>).justAddedBadge).toBe('New')
    })

    it('contains courses.contentLocked key', () => {
      expect(enMessages.courses).toBeDefined()
      expect((enMessages.courses as Record<string, unknown>).contentLocked).toBe(
        'This content is being prepared and will be available soon.',
      )
    })
  })

  describe('Hebrew translations (he.json)', () => {
    it('contains courses.soonBadge key', () => {
      expect(heMessages.courses).toBeDefined()
      expect((heMessages.courses as Record<string, unknown>).soonBadge).toBe('בקרוב')
    })

    it('contains courses.justAddedBadge key', () => {
      expect(heMessages.courses).toBeDefined()
      expect((heMessages.courses as Record<string, unknown>).justAddedBadge).toBe('חדש')
    })

    it('contains courses.contentLocked key', () => {
      expect(heMessages.courses).toBeDefined()
      expect((heMessages.courses as Record<string, unknown>).contentLocked).toBe(
        'תוכן זה בהכנה ויהיה זמין בקרוב.',
      )
    })
  })

  describe('both locales have all required keys', () => {
    const requiredKeys = ['soonBadge', 'justAddedBadge', 'contentLocked']

    it('has all keys in English', () => {
      requiredKeys.forEach((key) => {
        expect((enMessages.courses as Record<string, unknown>)[key]).toBeDefined()
      })
    })

    it('has all keys in Hebrew', () => {
      requiredKeys.forEach((key) => {
        expect((heMessages.courses as Record<string, unknown>)[key]).toBeDefined()
      })
    })
  })
})
