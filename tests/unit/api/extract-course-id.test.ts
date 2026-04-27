/**
 * Unit tests for extractCourseId helper function
 *
 * Tests the course ID extraction logic used in the dashboard metrics API.
 * This function must handle:
 * - String IDs (e.g., "abc123")
 * - Plain objects with id property (e.g., { id: "abc123" })
 * - MongoDB ObjectId instances (has toString() but no .id property)
 * - Null/undefined values
 * - Edge cases
 */
import { describe, expect, it } from 'vitest'
import { extractCourseId } from '@/app/api/admin/dashboard-metrics/route'

describe('extractCourseId', () => {
  describe('string IDs', () => {
    it('returns string ID unchanged', () => {
      expect(extractCourseId('abc123')).toBe('abc123')
      expect(extractCourseId('64f1a2b3c4d5e6f7a8b9c0d1')).toBe('64f1a2b3c4d5e6f7a8b9c0d1')
    })

    it('returns empty string for empty string input', () => {
      // Empty string is falsy, but technically a string - we should handle it
      // However, our implementation treats it as a valid string
      expect(extractCourseId('')).toBe('')
    })
  })

  describe('plain objects with id property', () => {
    it('handles plain object with string id property', () => {
      expect(extractCourseId({ id: 'abc123' })).toBe('abc123')
      expect(extractCourseId({ id: '64f1a2b3c4d5e6f7a8b9c0d1' })).toBe('64f1a2b3c4d5e6f7a8b9c0d1')
    })

    it('handles plain object with numeric id property', () => {
      expect(extractCourseId({ id: 123 })).toBe('123')
      expect(extractCourseId({ id: 0 })).toBe('0')
    })

    it('handles plain object with other properties', () => {
      expect(extractCourseId({ id: 'abc123', name: 'Course' })).toBe('abc123')
    })
  })

  describe('MongoDB ObjectId instances', () => {
    // Simulate MongoDB ObjectId behavior
    class MockObjectId {
      private readonly _id: string

      constructor(id: string) {
        this._id = id
      }

      toString(): string {
        return `ObjectId('${this._id}')`
      }

      // No .id property - this is the key difference from plain objects
    }

    it('handles ObjectId instance via toString()', () => {
      const objectId = new MockObjectId('64f1a2b3c4d5e6f7a8b9c0d1')
      expect(extractCourseId(objectId)).toBe('64f1a2b3c4d5e6f7a8b9c0d1')
    })

    it('handles ObjectId with different ID formats', () => {
      const objectId = new MockObjectId('abc123')
      expect(extractCourseId(objectId)).toBe('abc123')
    })
  })

  describe('null/undefined handling', () => {
    it('returns null for undefined', () => {
      expect(extractCourseId(undefined)).toBeNull()
    })

    it('returns null for null', () => {
      expect(extractCourseId(null)).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('handles object without id property', () => {
      // This should return null since there's no id property and toString will be [object Object]
      expect(extractCourseId({ name: 'Course' })).toBeNull()
    })

    it('handles object with empty id property', () => {
      expect(extractCourseId({ id: '' })).toBe('')
    })

    it('handles object with null id property', () => {
      // String(null) = 'null', so it should return 'null' not null
      expect(extractCourseId({ id: null })).toBe('null')
    })

    it('handles object with undefined id property', () => {
      // String(undefined) = 'undefined', so it should return 'undefined' not null
      expect(extractCourseId({ id: undefined })).toBe('undefined')
    })
  })

  describe('fallback behavior', () => {
    it('handles unexpected types gracefully', () => {
      // Numbers should work via the string branch
      expect(extractCourseId(123)).toBe('123')
    })

    it('returns null for plain object that stringifies to [object Object]', () => {
      // This is the old bug - ObjectId instances would stringify to [object Object]
      // and get skipped. Now we handle them specially.
      const result = extractCourseId({})
      // {} has no 'id' property, and toString() returns '[object Object]'
      // which doesn't match the ObjectId pattern, so it should return null
      expect(result).toBeNull()
    })
  })
})
