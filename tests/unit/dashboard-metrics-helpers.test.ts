/**
 * Unit tests for dashboard-metrics route helper functions
 *
 * @fileType unit-test
 */

import { describe, expect, it } from 'vitest'
import { extractCourseId, extractProductId } from '@/app/api/admin/dashboard-metrics/route'

describe('extractCourseId', () => {
  it('returns null for undefined', () => {
    expect(extractCourseId(undefined)).toBeNull()
  })

  it('returns null for null', () => {
    expect(extractCourseId(null)).toBeNull()
  })

  it('returns string ID as-is', () => {
    expect(extractCourseId('abc123')).toBe('abc123')
  })

  it('extracts ID from object with id property', () => {
    expect(extractCourseId({ id: 'obj123' })).toBe('obj123')
  })

  it('extracts ID from MongoDB ObjectId-like toString', () => {
    const mockObjectId = {
      toString: () => "ObjectId('obj456')",
    }
    expect(extractCourseId(mockObjectId as unknown as unknown)).toBe('obj456')
  })
})

describe('extractProductId', () => {
  it('returns null for undefined', () => {
    expect(extractProductId(undefined)).toBeNull()
  })

  it('returns null for null', () => {
    expect(extractProductId(null)).toBeNull()
  })

  it('returns string ID as-is', () => {
    expect(extractProductId('prod123')).toBe('prod123')
  })

  it('extracts ID from object with id property', () => {
    expect(extractProductId({ id: 'prod456' })).toBe('prod456')
  })

  it('extracts ID from MongoDB ObjectId-like toString', () => {
    const mockObjectId = {
      toString: () => "ObjectId('prod789')",
    }
    expect(extractProductId(mockObjectId as unknown as unknown)).toBe('prod789')
  })
})
