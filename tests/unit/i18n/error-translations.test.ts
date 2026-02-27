import { describe, it, expect } from 'vitest'
import en from '@/i18n/en.json'
import he from '@/i18n/he.json'

describe('i18n Error Translations', () => {
  describe('en.json', () => {
    it('should contain common.error.title with correct value', () => {
      expect(en.common.error.title).toBe('Something went wrong')
    })

    it('should contain common.error.message as non-empty string', () => {
      expect(typeof en.common.error.message).toBe('string')
      expect(en.common.error.message.length).toBeGreaterThan(0)
    })

    it('should contain common.error.tryAgain with correct value', () => {
      expect(en.common.error.tryAgain).toBe('Try again')
    })
  })

  describe('he.json', () => {
    it('should contain common.error.title with correct value', () => {
      expect(he.common.error.title).toBe('משהו השתבש')
    })

    it('should contain common.error.message as non-empty string', () => {
      expect(typeof he.common.error.message).toBe('string')
      expect(he.common.error.message.length).toBeGreaterThan(0)
    })

    it('should contain common.error.tryAgain with correct value', () => {
      expect(he.common.error.tryAgain).toBe('נסו שוב')
    })
  })
})
