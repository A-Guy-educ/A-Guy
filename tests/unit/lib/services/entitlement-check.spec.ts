/**
 * Unit Tests for Entitlement Check Service
 *
 * Tests the hasEntitlement function:
 * - Returns true when user has matching course entitlement
 * - Returns false when user has no entitlements
 * - Returns false when user has entitlements for other courses
 * - Handles both string and object course references
 */
import { hasEntitlement } from '@/server/services/entitlement_check'
import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

const createMockPayload = (overrides = {}): Payload =>
  ({
    find: vi.fn(),
    findByID: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  }) as unknown as Payload

describe('hasEntitlement', () => {
  const userId = 'user-123'
  const courseId = 'course-abc'

  it('should return true when user has entitlement for the course (string ref)', async () => {
    const payload = createMockPayload({
      findByID: vi.fn().mockResolvedValue({
        courseEntitlements: [{ course: courseId, grantMethod: 'admin', grantedAt: '2026-01-01' }],
      }),
    })

    const result = await hasEntitlement({ payload, userId, courseId })
    expect(result).toBe(true)
  })

  it('should return true when user has entitlement for the course (object ref)', async () => {
    const payload = createMockPayload({
      findByID: vi.fn().mockResolvedValue({
        courseEntitlements: [
          { course: { id: courseId }, grantMethod: 'code', grantedAt: '2026-01-01' },
        ],
      }),
    })

    const result = await hasEntitlement({ payload, userId, courseId })
    expect(result).toBe(true)
  })

  it('should return false when user has no entitlements', async () => {
    const payload = createMockPayload({
      findByID: vi.fn().mockResolvedValue({ courseEntitlements: [] }),
    })

    const result = await hasEntitlement({ payload, userId, courseId })
    expect(result).toBe(false)
  })

  it('should return false when courseEntitlements is undefined', async () => {
    const payload = createMockPayload({
      findByID: vi.fn().mockResolvedValue({}),
    })

    const result = await hasEntitlement({ payload, userId, courseId })
    expect(result).toBe(false)
  })

  it('should return false when user has entitlements for other courses only', async () => {
    const payload = createMockPayload({
      findByID: vi.fn().mockResolvedValue({
        courseEntitlements: [
          { course: 'course-other', grantMethod: 'admin', grantedAt: '2026-01-01' },
        ],
      }),
    })

    const result = await hasEntitlement({ payload, userId, courseId })
    expect(result).toBe(false)
  })

  it('should query with correct params', async () => {
    const findByID = vi.fn().mockResolvedValue({ courseEntitlements: [] })
    const payload = createMockPayload({ findByID })

    await hasEntitlement({ payload, userId, courseId })

    expect(findByID).toHaveBeenCalledWith({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
      select: { courseEntitlements: true },
    })
  })
})
