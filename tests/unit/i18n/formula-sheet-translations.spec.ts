/**
 * Unit Tests for Formula Sheet Translation Keys
 *
 * Verifies that formula sheet translation keys exist in both en and he locales.
 */
import { describe, expect, it } from 'vitest'
import en from '@/i18n/en.json'
import he from '@/i18n/he.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const enCourses = (en as any).courses as Record<string, string>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const heCourses = (he as any).courses as Record<string, string>

describe('Formula Sheet Translation Keys', () => {
  const requiredKeys = ['formulaSheetTitle', 'formulaSheetEmpty'] as const

  for (const key of requiredKeys) {
    it(`en.json should have courses.${key}`, () => {
      expect(enCourses[key]).toBeDefined()
      expect(typeof enCourses[key]).toBe('string')
      expect(enCourses[key].length).toBeGreaterThan(0)
    })

    it(`he.json should have courses.${key}`, () => {
      expect(heCourses[key]).toBeDefined()
      expect(typeof heCourses[key]).toBe('string')
      expect(heCourses[key].length).toBeGreaterThan(0)
    })
  }

  it('en and he should have different values for formulaSheetTitle', () => {
    expect(enCourses.formulaSheetTitle).not.toBe(heCourses.formulaSheetTitle)
  })
})
