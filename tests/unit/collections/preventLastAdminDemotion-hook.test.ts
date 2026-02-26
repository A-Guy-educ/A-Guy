import { describe, expect, it, vi, beforeEach } from 'vitest'

import { ValidationError } from 'payload'

import { preventLastAdminDemotion } from '@/server/payload/collections/Users/hooks/preventLastAdminDemotion-hook'
import { AccountRole } from '@/server/payload/collections/Users/roles'

describe('preventLastAdminDemotion Hook', () => {
  let mockCount: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockCount = vi.fn()
  })

  // Helper to create minimal CollectionBeforeChangeHook args
  const createHookArgs = (overrides: Record<string, unknown> = {}) => {
    return {
      data: {},
      req: {
        payload: {
          count: mockCount,
        },
      },
      operation: 'update' as const,
      originalDoc: undefined,
      collection: { config: { slug: 'users' } },
      context: {},
      ...overrides,
    }
  }

  describe('Test 1: should call count with overrideAccess: true (system-level check)', () => {
    it('should call count with overrideAccess: true', async () => {
      // Setup: Admin being demoted to student, only 1 admin exists
      mockCount.mockResolvedValue({ totalDocs: 1 })

      const hookArgs = createHookArgs({
        operation: 'update',
        data: { role: AccountRole.Student },
        originalDoc: { role: AccountRole.Admin },
      })

      // Execute - expect to throw due to last admin
      await expect(preventLastAdminDemotion(hookArgs as any)).rejects.toThrow(ValidationError)

      // Assert: This will FAIL because current code uses overrideAccess: false
      expect(mockCount).toHaveBeenCalledWith(expect.objectContaining({ overrideAccess: true }))
    })
  })

  describe('Test 2: should throw ValidationError when demoting the last admin', () => {
    it('should throw ValidationError when there is only one admin', async () => {
      // Setup: Only 1 admin exists
      mockCount.mockResolvedValue({ totalDocs: 1 })

      const hookArgs = createHookArgs({
        operation: 'update',
        data: { role: AccountRole.Student },
        originalDoc: { role: AccountRole.Admin },
      })

      // Execute & Assert
      await expect(preventLastAdminDemotion(hookArgs as any)).rejects.toThrow(ValidationError)
    })
  })

  describe('Test 3: should allow demotion when multiple admins exist', () => {
    it('should allow demotion when there are multiple admins', async () => {
      // Setup: 3 admins exist
      mockCount.mockResolvedValue({ totalDocs: 3 })

      const hookArgs = createHookArgs({
        operation: 'update',
        data: { role: AccountRole.Student },
        originalDoc: { role: AccountRole.Admin },
      })

      // Execute
      const result = await preventLastAdminDemotion(hookArgs as any)

      // Assert: Should return data without throwing
      expect(result).toEqual({ role: AccountRole.Student })
      expect(mockCount).toHaveBeenCalled()
    })
  })

  describe('Test 4: should skip check on create operations', () => {
    it('should not call count on create operations', async () => {
      const hookArgs = createHookArgs({
        operation: 'create',
        data: { role: AccountRole.Student },
        originalDoc: undefined,
      })

      await preventLastAdminDemotion(hookArgs as any)

      expect(mockCount).not.toHaveBeenCalled()
    })
  })

  describe('Test 5: should skip check when role is not changing to student', () => {
    it('should not call count when role is admin', async () => {
      const hookArgs = createHookArgs({
        operation: 'update',
        data: { role: AccountRole.Admin },
        originalDoc: { role: AccountRole.Admin },
      })

      await preventLastAdminDemotion(hookArgs as any)

      expect(mockCount).not.toHaveBeenCalled()
    })
  })

  describe('Test 6: should skip check when original role is not admin', () => {
    it('should not call count when original role is student', async () => {
      const hookArgs = createHookArgs({
        operation: 'update',
        data: { role: AccountRole.Student },
        originalDoc: { role: AccountRole.Student },
      })

      await preventLastAdminDemotion(hookArgs as any)

      expect(mockCount).not.toHaveBeenCalled()
    })
  })
})
