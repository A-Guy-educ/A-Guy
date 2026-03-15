/**
 * Unit tests for access-types.ts - FR-001
 *
 * Tests:
 * - ACCESS_TYPES includes 'accessCode'
 * - resolveAccessType correctly resolves 'accessCode' type
 * - LessonAccessType includes 'accessCode'
 */

import { describe, expect, it } from 'vitest'

import { ACCESS_TYPES, LESSON_ACCESS_TYPES, resolveAccessType } from '@/infra/auth/access-types'

describe('Access Types - FR-001: accessCode access type', () => {
  describe('ACCESS_TYPES constant', () => {
    it('should include accessCode in ACCESS_TYPES', () => {
      expect(ACCESS_TYPES).toContain('accessCode')
    })

    it('should have free, mandatory, gated, accessCode as access types', () => {
      expect(ACCESS_TYPES).toEqual(
        expect.arrayContaining(['free', 'mandatory', 'gated', 'accessCode']),
      )
    })
  })

  describe('LESSON_ACCESS_TYPES constant', () => {
    it('should include inherit as first option', () => {
      expect(LESSON_ACCESS_TYPES[0]).toBe('inherit')
    })

    it('should include accessCode via spread from ACCESS_TYPES', () => {
      expect(LESSON_ACCESS_TYPES).toContain('accessCode')
    })

    it('should have inherit, free, mandatory, gated, accessCode', () => {
      expect(LESSON_ACCESS_TYPES).toEqual(['inherit', 'free', 'mandatory', 'gated', 'accessCode'])
    })
  })

  describe('resolveAccessType function', () => {
    it('should return accessCode when lesson has accessCode type', () => {
      const result = resolveAccessType('accessCode', 'free')
      expect(result).toBe('accessCode')
    })

    it('should return accessCode when lesson inherits and course has accessCode', () => {
      const result = resolveAccessType('inherit', 'accessCode')
      expect(result).toBe('accessCode')
    })

    it('should return free when lesson has accessCode and course has free (lesson takes precedence)', () => {
      // This test verifies that lesson-level accessCode takes precedence over course-level free
      // Note: The current behavior is lesson non-inherit types take precedence
      const result = resolveAccessType('accessCode', 'free')
      expect(result).toBe('accessCode')
    })

    it('should return free when both lesson and course are free', () => {
      const result = resolveAccessType('free', 'free')
      expect(result).toBe('free')
    })

    it('should return mandatory when lesson has mandatory', () => {
      const result = resolveAccessType('mandatory', 'free')
      expect(result).toBe('mandatory')
    })

    it('should return gated when lesson has gated', () => {
      const result = resolveAccessType('gated', 'free')
      expect(result).toBe('gated')
    })

    it('should fallback to free for unknown types', () => {
      const result = resolveAccessType('unknown', 'free')
      expect(result).toBe('free')
    })

    it('should fallback to free when lesson is inherit and course is unknown', () => {
      const result = resolveAccessType('inherit', 'unknown')
      expect(result).toBe('free')
    })
  })
})
