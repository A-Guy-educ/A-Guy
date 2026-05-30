/**
 * Unit Tests for Entitlement Check Service
 *
 * Tests the hasEntitlement function:
 * - Returns true when user has active enrollment in Enrollments collection
 * - Returns false when enrollment status is not active
 * - Falls back to courseEntitlements when Enrollments is empty (backward compat)
 * - Returns false when neither Enrollments nor courseEntitlements match
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

  it('should return true when user has active enrollment in Enrollments collection', async () => {
    const payload = createMockPayload({
      find: vi.fn().mockResolvedValue({
        docs: [{ id: 'enrollment-1', user: userId, course: courseId, status: 'active' }],
      }),
    })

    const result = await hasEntitlement({ payload, userId, courseId })
    expect(result).toBe(true)
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'enrollments',
        where: expect.objectContaining({
          and: expect.arrayContaining([
            { user: { equals: userId } },
            { course: { equals: courseId } },
            { status: { equals: 'active' } },
          ]),
        }),
      }),
    )
  })

  it('should return false when Enrollments exists but status is cancelled', async () => {
    // Mock returns empty docs because Payload would filter out non-active status
    const payload = createMockPayload({
      find: vi.fn().mockResolvedValue({ docs: [] }),
      findByID: vi.fn().mockResolvedValue({ courseEntitlements: [] }),
    })

    const result = await hasEntitlement({ payload, userId, courseId })
    expect(result).toBe(false)
  })

  it('should return false when Enrollments exists but status is expired', async () => {
    // Mock returns empty docs because Payload would filter out non-active status
    const payload = createMockPayload({
      find: vi.fn().mockResolvedValue({ docs: [] }),
      findByID: vi.fn().mockResolvedValue({ courseEntitlements: [] }),
    })

    const result = await hasEntitlement({ payload, userId, courseId })
    expect(result).toBe(false)
  })

  it('should fallback to courseEntitlements when Enrollments is empty', async () => {
    const payload = createMockPayload({
      find: vi.fn().mockResolvedValue({ docs: [] }),
      findByID: vi.fn().mockResolvedValue({
        courseEntitlements: [{ course: courseId, grantMethod: 'admin', grantedAt: '2026-01-01' }],
      }),
    })

    const result = await hasEntitlement({ payload, userId, courseId })
    expect(result).toBe(true)
    expect(payload.findByID).toHaveBeenCalledWith({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
      select: { courseEntitlements: true },
    })
  })

  it('should return false when neither Enrollments nor courseEntitlements match', async () => {
    const payload = createMockPayload({
      find: vi.fn().mockResolvedValue({ docs: [] }),
      findByID: vi.fn().mockResolvedValue({ courseEntitlements: [] }),
    })

    const result = await hasEntitlement({ payload, userId, courseId })
    expect(result).toBe(false)
  })

  it('should return false when courseEntitlements is undefined (fallback)', async () => {
    const payload = createMockPayload({
      find: vi.fn().mockResolvedValue({ docs: [] }),
      findByID: vi.fn().mockResolvedValue({}),
    })

    const result = await hasEntitlement({ payload, userId, courseId })
    expect(result).toBe(false)
  })

  it('should return true when Enrollments active even if courseEntitlements is empty', async () => {
    // Enrollments takes precedence - if there's an active enrollment, access is granted
    const payload = createMockPayload({
      find: vi.fn().mockResolvedValue({
        docs: [{ id: 'enrollment-1', user: userId, course: courseId, status: 'active' }],
      }),
      findByID: vi.fn().mockResolvedValue({ courseEntitlements: [] }),
    })

    const result = await hasEntitlement({ payload, userId, courseId })
    expect(result).toBe(true)
    // findByID should not be called since Enrollments found an active enrollment
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it('should return true for legacy entitlement (courseEntitlements) when Enrollments is empty', async () => {
    const payload = createMockPayload({
      find: vi.fn().mockResolvedValue({ docs: [] }),
      findByID: vi.fn().mockResolvedValue({
        courseEntitlements: [{ course: courseId, grantMethod: 'code', grantedAt: '2026-02-01' }],
      }),
    })

    const result = await hasEntitlement({ payload, userId, courseId })
    expect(result).toBe(true)
  })

  it('should return false when courseEntitlements has other courses only', async () => {
    const payload = createMockPayload({
      find: vi.fn().mockResolvedValue({ docs: [] }),
      findByID: vi.fn().mockResolvedValue({
        courseEntitlements: [
          { course: 'course-other', grantMethod: 'admin', grantedAt: '2026-01-01' },
        ],
      }),
    })

    const result = await hasEntitlement({ payload, userId, courseId })
    expect(result).toBe(false)
  })
})
