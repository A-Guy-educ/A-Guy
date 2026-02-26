/**
 * @fileType test
 * @domain i18n
 * @pattern translations
 * @ai-summary Tests for i18n error translations
 */
import { describe, expect, it } from 'vitest'
import enMessages from '@/i18n/en.json'
import heMessages from '@/i18n/he.json'

describe('i18n error translations', () => {
  describe('English error translations', () => {
    it('should have common.error.title in English', () => {
      expect(enMessages.common).toBeDefined()
      expect(enMessages.common.error).toBeDefined()
      expect(enMessages.common.error.title).toBe('Something went wrong')
    })

    it('should have common.error.retryButton in English', () => {
      expect(enMessages.common).toBeDefined()
      expect(enMessages.common.error).toBeDefined()
      expect(enMessages.common.error.retryButton).toBe('Try again')
    })
  })

  describe('Hebrew error translations', () => {
    it('should have common.error.title in Hebrew', () => {
      expect(heMessages.common).toBeDefined()
      expect(heMessages.common.error).toBeDefined()
      expect(heMessages.common.error.title).toBe('משהו השתבש')
    })

    it('should have common.error.retryButton in Hebrew', () => {
      expect(heMessages.common).toBeDefined()
      expect(heMessages.common.error).toBeDefined()
      expect(heMessages.common.error.retryButton).toBe('נסה שוב')
    })
  })
})
