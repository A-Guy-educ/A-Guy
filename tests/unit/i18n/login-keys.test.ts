/**
 * Unit Tests for Login Page i18n Translation Keys
 *
 * Verifies that both en.json and he.json contain all required login page translation keys.
 */
import { describe, expect, it } from 'vitest'
import en from '@/i18n/en.json'
import he from '@/i18n/he.json'

describe('Login Page Translation Keys', () => {
  const requiredKeys: string[] = [
    'headline',
    'headlineSubtitle',
    'quickEntry',
    'signupCTA',
    'footerSecure',
    'footerOneClick',
    'needHelp',
  ]

  // Cast to any to avoid index signature issues with JSON imports
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enLogin = en.auth.login as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heLogin = he.auth.login as any

  describe('English translations (en.json)', () => {
    it('should have auth.login section', () => {
      expect(en.auth).toBeDefined()
      expect(en.auth.login).toBeDefined()
    })

    requiredKeys.forEach((key) => {
      it(`should have auth.login.${key} key`, () => {
        expect(enLogin[key]).toBeDefined()
      })

      it(`should have non-empty auth.login.${key} value`, () => {
        expect(enLogin[key]).toBeTruthy()
        expect(typeof enLogin[key]).toBe('string')
      })
    })
  })

  describe('Hebrew translations (he.json)', () => {
    it('should have auth.login section', () => {
      expect(he.auth).toBeDefined()
      expect(he.auth.login).toBeDefined()
    })

    requiredKeys.forEach((key) => {
      it(`should have auth.login.${key} key`, () => {
        expect(heLogin[key]).toBeDefined()
      })

      it(`should have non-empty auth.login.${key} value`, () => {
        expect(heLogin[key]).toBeTruthy()
        expect(typeof heLogin[key]).toBe('string')
      })
    })
  })

  describe('JSON validity', () => {
    it('should have valid en.json', () => {
      expect(() => JSON.stringify(en)).not.toThrow()
    })

    it('should have valid he.json', () => {
      expect(() => JSON.stringify(he)).not.toThrow()
    })
  })
})
