/**
 * @fileType unit-test
 * @domain i18n
 * @pattern translation-keys
 * @ai-summary Tests for scroll view translation keys (renamed from pdfView) in en.json and he.json
 */
import { describe, expect, it } from 'vitest'
import enMessages from '../../../src/i18n/en.json'
import heMessages from '../../../src/i18n/he.json'

describe('scrollView translations', () => {
  describe('English translations (en.json)', () => {
    it('contains courses.scrollView key with correct value', () => {
      expect(enMessages.courses).toBeDefined()
      expect((enMessages.courses as Record<string, unknown>).scrollView).toBe('Scroll View')
    })

    it('contains courses.lessonViewModePdf key renamed to Scroll view', () => {
      expect(enMessages.courses).toBeDefined()
      expect((enMessages.courses as Record<string, unknown>).lessonViewModePdf).toBe('Scroll view')
    })

    it('does NOT contain courses.pdfView key (renamed to scrollView)', () => {
      expect(enMessages.courses).toBeDefined()
      expect((enMessages.courses as Record<string, unknown>).pdfView).toBeUndefined()
    })
  })

  describe('Hebrew translations (he.json)', () => {
    it('contains courses.scrollView key with correct Hebrew value', () => {
      expect(heMessages.courses).toBeDefined()
      expect((heMessages.courses as Record<string, unknown>).scrollView).toBe('תצוגת גלילה')
    })

    it('contains courses.lessonViewModePdf key renamed to Hebrew scroll view label', () => {
      expect(heMessages.courses).toBeDefined()
      expect((heMessages.courses as Record<string, unknown>).lessonViewModePdf).toBe('תצוגת גלילה')
    })

    it('does NOT contain courses.pdfView key (renamed to scrollView)', () => {
      expect(heMessages.courses).toBeDefined()
      expect((heMessages.courses as Record<string, unknown>).pdfView).toBeUndefined()
    })
  })
})
