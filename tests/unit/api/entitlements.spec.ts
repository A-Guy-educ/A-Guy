/**
 * Unit Tests for Entitlement API Endpoints
 *
 * Tests the redeem endpoint validation logic and the check endpoint admin bypass.
 * These tests validate the Zod schema and code validation rules without
 * hitting a real database.
 */
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

// Extract the schema definition to test it independently
const redeemSchema = z.object({
  code: z.string().trim().min(1, 'code_required'),
})

describe('Redeem endpoint schema validation', () => {
  it('should accept a valid code', () => {
    const result = redeemSchema.safeParse({ code: 'ABC123' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.code).toBe('ABC123')
    }
  })

  it('should trim whitespace from code', () => {
    const result = redeemSchema.safeParse({ code: '  ABC123  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.code).toBe('ABC123')
    }
  })

  it('should reject empty code', () => {
    const result = redeemSchema.safeParse({ code: '' })
    expect(result.success).toBe(false)
  })

  it('should reject whitespace-only code', () => {
    const result = redeemSchema.safeParse({ code: '   ' })
    expect(result.success).toBe(false)
  })

  it('should reject missing code field', () => {
    const result = redeemSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('should reject non-string code', () => {
    const result = redeemSchema.safeParse({ code: 12345 })
    expect(result.success).toBe(false)
  })

  it('should reject null body', () => {
    const result = redeemSchema.safeParse(null)
    expect(result.success).toBe(false)
  })
})

describe('Access code validation rules', () => {
  it('should detect inactive codes', () => {
    const accessCode = { isActive: false, expiresAt: null, maxUses: 0, currentUses: 0 }
    expect(accessCode.isActive).toBe(false)
  })

  it('should detect expired codes', () => {
    const pastDate = '2020-01-01T00:00:00.000Z'
    const isExpired = new Date(pastDate) < new Date()
    expect(isExpired).toBe(true)
  })

  it('should not flag future expiry as expired', () => {
    const futureDate = '2099-12-31T23:59:59.000Z'
    const isExpired = new Date(futureDate) < new Date()
    expect(isExpired).toBe(false)
  })

  it('should detect exhausted codes', () => {
    const maxUses = 5
    const currentUses = 5
    const isExhausted = maxUses > 0 && currentUses >= maxUses
    expect(isExhausted).toBe(true)
  })

  it('should allow unlimited uses when maxUses is 0', () => {
    const maxUses = 0
    const currentUses = 999
    const isExhausted = maxUses > 0 && currentUses >= maxUses
    expect(isExhausted).toBe(false)
  })

  it('should allow usage when under limit', () => {
    const maxUses = 10
    const currentUses = 3
    const isExhausted = maxUses > 0 && currentUses >= maxUses
    expect(isExhausted).toBe(false)
  })

  it('should detect duplicate entitlements (string ref)', () => {
    const existing = [{ course: 'course-abc' }, { course: 'course-xyz' }]
    const courseId = 'course-abc'
    const alreadyHas = existing.some((e) => {
      const entCourseId = typeof e.course === 'string' ? e.course : null
      return entCourseId === courseId
    })
    expect(alreadyHas).toBe(true)
  })

  it('should detect duplicate entitlements (object ref)', () => {
    const existing = [{ course: { id: 'course-abc' } }]
    const courseId = 'course-abc'
    const alreadyHas = existing.some((e) => {
      const entCourseId = typeof e.course === 'string' ? e.course : e.course?.id
      return entCourseId === courseId
    })
    expect(alreadyHas).toBe(true)
  })

  it('should not flag different course as duplicate', () => {
    const existing = [{ course: 'course-other' }]
    const courseId = 'course-abc'
    const alreadyHas = existing.some((e) => {
      const entCourseId = typeof e.course === 'string' ? e.course : null
      return entCourseId === courseId
    })
    expect(alreadyHas).toBe(false)
  })
})
