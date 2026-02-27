import { describe, expect, it } from 'vitest'
import enMessages from '../../../src/i18n/en.json'
import heMessages from '../../../src/i18n/he.json'

describe('i18n loading and error keys', () => {
  describe('English translations (en.json)', () => {
    it('should have common.loading.label key', () => {
      expect(enMessages.common.loading).toBeDefined()
      expect(enMessages.common.loading.label).toBe('Loading...')
    })

    it('should have all common.error keys (title, message, retry, goHome)', () => {
      expect(enMessages.common.error).toBeDefined()
      expect(typeof enMessages.common.error.title).toBe('string')
      expect(typeof enMessages.common.error.message).toBe('string')
      expect(typeof enMessages.common.error.retry).toBe('string')
      expect(typeof enMessages.common.error.goHome).toBe('string')
      expect(enMessages.common.error.title).toBe('Something went wrong')
      expect(enMessages.common.error.retry).toBe('Try again')
    })
  })

  describe('Hebrew translations (he.json)', () => {
    it('should have common.loading.label key', () => {
      expect(heMessages.common.loading).toBeDefined()
      expect(typeof heMessages.common.loading.label).toBe('string')
      expect(heMessages.common.loading.label).not.toBe('Loading...')
    })

    it('should have all common.error keys matching en.json structure', () => {
      expect(heMessages.common.error).toBeDefined()
      expect(typeof heMessages.common.error.title).toBe('string')
      expect(typeof heMessages.common.error.message).toBe('string')
      expect(typeof heMessages.common.error.retry).toBe('string')
      expect(typeof heMessages.common.error.goHome).toBe('string')
      // Hebrew should have actual Hebrew text, not English
      expect(heMessages.common.error.title).not.toBe('Something went wrong')
      expect(heMessages.common.error.retry).not.toBe('Try again')
    })
  })
})
