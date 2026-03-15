/**
 * Unit tests for i18n translation keys - NFR-001
 *
 * Tests:
 * - en.json contains all accessCode translation keys
 * - he.json contains all accessCode translation keys
 */

import { describe, expect, it } from 'vitest'

import enMessages from '../../src/i18n/en.json'
import heMessages from '../../src/i18n/he.json'

describe('i18n Translation Keys - NFR-001: accessCode translations', () => {
  const requiredKeys = [
    'accessCodeTitle',
    'accessCodeDescription',
    'accessCodePlaceholder',
    'accessCodeUnlock',
    'accessCodeError',
    'accessCodeSuccess',
    'accessCodeExpired',
    'accessCodeMaxReached',
  ]

  describe('English translations (en.json)', () => {
    it('should have accessControl section', () => {
      expect(enMessages.accessControl).toBeDefined()
    })

    it('should contain all required accessCode keys', () => {
      const accessControl = enMessages.accessControl as Record<string, unknown>
      for (const key of requiredKeys) {
        expect(accessControl).toHaveProperty(key)
        expect(typeof accessControl[key]).toBe('string')
      }
    })

    it('should have correct accessCodeTitle', () => {
      const accessControl = enMessages.accessControl as Record<string, string>
      expect(accessControl.accessCodeTitle).toBe('Access Restricted')
    })

    it('should have correct accessCodeDescription', () => {
      const accessControl = enMessages.accessControl as Record<string, string>
      expect(accessControl.accessCodeDescription).toBe(
        'Please insert your school access code to unlock this content.',
      )
    })

    it('should have correct accessCodePlaceholder', () => {
      const accessControl = enMessages.accessControl as Record<string, string>
      expect(accessControl.accessCodePlaceholder).toBe('Enter access code')
    })

    it('should have correct accessCodeUnlock', () => {
      const accessControl = enMessages.accessControl as Record<string, string>
      expect(accessControl.accessCodeUnlock).toBe('Unlock')
    })

    it('should have correct accessCodeError', () => {
      const accessControl = enMessages.accessControl as Record<string, string>
      expect(accessControl.accessCodeError).toBe('Incorrect code. Please check with your teacher.')
    })

    it('should have correct accessCodeSuccess', () => {
      const accessControl = enMessages.accessControl as Record<string, string>
      expect(accessControl.accessCodeSuccess).toBe('Content unlocked!')
    })

    it('should have correct accessCodeExpired', () => {
      const accessControl = enMessages.accessControl as Record<string, string>
      expect(accessControl.accessCodeExpired).toBe('This code has expired.')
    })

    it('should have correct accessCodeMaxReached', () => {
      const accessControl = enMessages.accessControl as Record<string, string>
      expect(accessControl.accessCodeMaxReached).toBe('This code has reached its maximum uses.')
    })
  })

  describe('Hebrew translations (he.json)', () => {
    it('should have accessControl section', () => {
      expect(heMessages.accessControl).toBeDefined()
    })

    it('should contain all required accessCode keys', () => {
      const accessControl = heMessages.accessControl as Record<string, unknown>
      for (const key of requiredKeys) {
        expect(accessControl).toHaveProperty(key)
        expect(typeof accessControl[key]).toBe('string')
      }
    })

    it('should have correct accessCodeTitle in Hebrew', () => {
      const accessControl = heMessages.accessControl as Record<string, string>
      expect(accessControl.accessCodeTitle).toBe('הגישה מוגבלת')
    })

    it('should have correct accessCodeDescription in Hebrew', () => {
      const accessControl = heMessages.accessControl as Record<string, string>
      expect(accessControl.accessCodeDescription).toBe(
        'אנא הזן את קוד הגישה של בית הספר שלך כדי לפתוח תוכן זה.',
      )
    })

    it('should have correct accessCodePlaceholder in Hebrew', () => {
      const accessControl = heMessages.accessControl as Record<string, string>
      expect(accessControl.accessCodePlaceholder).toBe('הזן קוד גישה')
    })

    it('should have correct accessCodeUnlock in Hebrew', () => {
      const accessControl = heMessages.accessControl as Record<string, string>
      expect(accessControl.accessCodeUnlock).toBe('פתח')
    })

    it('should have correct accessCodeError in Hebrew', () => {
      const accessControl = heMessages.accessControl as Record<string, string>
      expect(accessControl.accessCodeError).toBe('קוד שגוי. אנא בדוק עם המורה שלך.')
    })

    it('should have correct accessCodeSuccess in Hebrew', () => {
      const accessControl = heMessages.accessControl as Record<string, string>
      expect(accessControl.accessCodeSuccess).toBe('התוכן נפתח!')
    })

    it('should have correct accessCodeExpired in Hebrew', () => {
      const accessControl = heMessages.accessControl as Record<string, string>
      expect(accessControl.accessCodeExpired).toBe('קוד זה פג תוקף.')
    })

    it('should have correct accessCodeMaxReached in Hebrew', () => {
      const accessControl = heMessages.accessControl as Record<string, string>
      expect(accessControl.accessCodeMaxReached).toBe('קוד זה הגיע למקסימום השימושים.')
    })
  })

  describe('Existing translations should not be broken', () => {
    it('should preserve existing accessControl keys', () => {
      const enAccessControl = enMessages.accessControl as Record<string, unknown>
      const heAccessControl = heMessages.accessControl as Record<string, unknown>

      // Existing keys that must remain
      const existingKeys = [
        'mandatoryTitle',
        'mandatoryDescription',
        'gatedWarningTitle',
        'gatedLockedTitle',
        'gatedLockedDescription',
        'signInPrompt',
        'warningCountdown',
        'browseCourses',
      ]

      for (const key of existingKeys) {
        expect(enAccessControl).toHaveProperty(key)
        expect(heAccessControl).toHaveProperty(key)
      }
    })
  })
})
