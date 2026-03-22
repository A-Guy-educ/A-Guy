/**
 * Unit Tests for checkPaidAccess utility
 *
 * Tests:
 * - Admins always bypass (requiresEntitlement: false)
 * - Unauthenticated users are always blocked
 * - Entitled users get access
 * - Non-entitled users are blocked
 */
import { describe, expect, it, vi } from 'vitest'

// Mock dependencies before importing the module under test
vi.mock('@/server/utils/access-gate-server', () => ({
  getAuthenticatedUserServer: vi.fn(),
}))

vi.mock('@/server/services/entitlement_check', () => ({
  hasEntitlement: vi.fn(),
}))

import { checkPaidAccess } from '@/server/utils/check-paid-access'
import { getAuthenticatedUserServer } from '@/server/utils/access-gate-server'
import { hasEntitlement } from '@/server/services/entitlement_check'

const mockGetAuth = vi.mocked(getAuthenticatedUserServer)
const mockHasEntitlement = vi.mocked(hasEntitlement)

describe('checkPaidAccess', () => {
  const courseId = 'course-abc'
  const mockPayload = {} as Parameters<typeof hasEntitlement>[0]['payload']

  it('should bypass for admin users', async () => {
    mockGetAuth.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
      payload: mockPayload,
    } as ReturnType<typeof mockGetAuth> extends Promise<infer T> ? T : never)

    const result = await checkPaidAccess(courseId)

    expect(result).toEqual({ requiresEntitlement: false, isAuthenticated: true })
    expect(mockHasEntitlement).not.toHaveBeenCalled()
  })

  it('should block unauthenticated users', async () => {
    mockGetAuth.mockResolvedValue({
      user: null,
      payload: mockPayload,
    } as ReturnType<typeof mockGetAuth> extends Promise<infer T> ? T : never)

    const result = await checkPaidAccess(courseId)

    expect(result).toEqual({ requiresEntitlement: true, isAuthenticated: false })
    expect(mockHasEntitlement).not.toHaveBeenCalled()
  })

  it('should allow entitled users', async () => {
    mockGetAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'student' },
      payload: mockPayload,
    } as ReturnType<typeof mockGetAuth> extends Promise<infer T> ? T : never)
    mockHasEntitlement.mockResolvedValue(true)

    const result = await checkPaidAccess(courseId)

    expect(result).toEqual({ requiresEntitlement: false, isAuthenticated: true })
  })

  it('should block non-entitled users', async () => {
    mockGetAuth.mockResolvedValue({
      user: { id: 'user-2', role: 'student' },
      payload: mockPayload,
    } as ReturnType<typeof mockGetAuth> extends Promise<infer T> ? T : never)
    mockHasEntitlement.mockResolvedValue(false)

    const result = await checkPaidAccess(courseId)

    expect(result).toEqual({ requiresEntitlement: true, isAuthenticated: true })
  })

  it('should pass correct params to hasEntitlement', async () => {
    mockGetAuth.mockResolvedValue({
      user: { id: 'user-3', role: 'student' },
      payload: mockPayload,
    } as ReturnType<typeof mockGetAuth> extends Promise<infer T> ? T : never)
    mockHasEntitlement.mockResolvedValue(false)

    await checkPaidAccess(courseId)

    expect(mockHasEntitlement).toHaveBeenCalledWith({
      payload: mockPayload,
      userId: 'user-3',
      courseId,
    })
  })
})
