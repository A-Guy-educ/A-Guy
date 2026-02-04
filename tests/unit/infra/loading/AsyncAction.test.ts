import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createAsyncAction } from '@/infra/loading/AsyncAction'
import { createLoadingManager } from '@/infra/loading/LoadingManager'

describe('AsyncAction', () => {
  let manager: ReturnType<typeof createLoadingManager>
  let asyncAction: ReturnType<typeof createAsyncAction>

  beforeEach(() => {
    manager = createLoadingManager()
    asyncAction = createAsyncAction(manager)
  })

  describe('basic functionality', () => {
    it('should wrap action and register loading state', async () => {
      const mockAction = vi.fn().mockResolvedValue({ success: true })

      expect(manager.isKeyBusy('test-key')).toBe(false)

      const promise = asyncAction(mockAction, { key: 'test-key' })

      // Should be busy during execution
      expect(manager.isKeyBusy('test-key')).toBe(true)

      await promise

      // Should not be busy after completion
      expect(manager.isKeyBusy('test-key')).toBe(false)
    })

    it('should return normalized success result', async () => {
      const mockAction = vi.fn().mockResolvedValue({ success: true, data: { id: '123' } })

      const result = await asyncAction(mockAction, { key: 'test-key' })

      expect(result).toEqual({
        success: true,
        data: { id: '123' },
      })
    })

    it('should wrap raw result without success field', async () => {
      const mockAction = vi.fn().mockResolvedValue({ id: '123', name: 'Test' })

      const result = await asyncAction(mockAction, { key: 'test-key' })

      expect(result).toEqual({
        success: true,
        data: { id: '123', name: 'Test' },
      })
    })

    it('should handle action errors', async () => {
      const mockAction = vi.fn().mockRejectedValue(new Error('Test error'))

      const result = await asyncAction(mockAction, { key: 'test-key' })

      expect(result).toEqual({
        success: false,
        error: 'Test error',
      })
    })
  })

  describe('duplicate prevention', () => {
    it('should prevent duplicate submissions by default', async () => {
      const mockAction = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100)),
        )

      // Start first action
      const promise1 = asyncAction(mockAction, { key: 'test-key' })

      // Try to start second action immediately
      const result2 = await asyncAction(mockAction, { key: 'test-key' })

      // Second action should be rejected
      expect(result2).toEqual({
        success: false,
        error: 'Action already in progress',
      })

      // First action should complete normally
      const result1 = await promise1
      expect(result1.success).toBe(true)

      // Should be called only once (first call)
      expect(mockAction).toHaveBeenCalledTimes(1)
    })

    it('should allow duplicate submissions when preventDuplicate is false', async () => {
      const mockAction = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 10)),
        )

      // Start first action
      const promise1 = asyncAction(mockAction, { key: 'test-key', preventDuplicate: false })

      // Start second action immediately
      const promise2 = asyncAction(mockAction, { key: 'test-key', preventDuplicate: false })

      const [result1, result2] = await Promise.all([promise1, promise2])

      // Both should succeed
      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)

      // Should be called twice
      expect(mockAction).toHaveBeenCalledTimes(2)
    })
  })

  describe('loading state lifecycle', () => {
    it('should unregister loading state after success', async () => {
      const mockAction = vi.fn().mockResolvedValue({ success: true })

      await asyncAction(mockAction, { key: 'test-key' })

      expect(manager.isKeyBusy('test-key')).toBe(false)
    })

    it('should unregister loading state after error', async () => {
      const mockAction = vi.fn().mockRejectedValue(new Error('Test error'))

      await asyncAction(mockAction, { key: 'test-key' })

      expect(manager.isKeyBusy('test-key')).toBe(false)
    })

    it('should use action type for registration', async () => {
      const mockAction = vi.fn().mockResolvedValue({ success: true })

      const promise = asyncAction(mockAction, { key: 'test-key' })

      // Check that it's registered with 'action' type
      const operations = manager.getActiveOperations()
      expect(operations).toHaveLength(1)
      expect(operations[0].type).toBe('action')
      expect(operations[0].key).toBe('test-key')

      await promise
    })
  })

  describe('server action result formats', () => {
    it('should pass through server action error format', async () => {
      const mockAction = vi.fn().mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      })

      const result = await asyncAction(mockAction, { key: 'test-key' })

      expect(result).toEqual({
        success: false,
        error: 'Invalid credentials',
      })
    })

    it('should pass through server action with errors object', async () => {
      const mockAction = vi.fn().mockResolvedValue({
        success: false,
        errors: { email: 'Invalid email', password: 'Too short' },
      })

      const result = await asyncAction(mockAction, { key: 'test-key' })

      expect(result).toEqual({
        success: false,
        errors: { email: 'Invalid email', password: 'Too short' },
      })
    })
  })

  describe('edge cases', () => {
    it('should handle non-Error rejections', async () => {
      const mockAction = vi.fn().mockRejectedValue('String error')

      const result = await asyncAction(mockAction, { key: 'test-key' })

      expect(result).toEqual({
        success: false,
        error: 'An error occurred',
      })
    })

    it('should handle null result', async () => {
      const mockAction = vi.fn().mockResolvedValue(null)

      const result = await asyncAction(mockAction, { key: 'test-key' })

      expect(result).toEqual({
        success: true,
        data: null,
      })
    })

    it('should handle undefined result', async () => {
      const mockAction = vi.fn().mockResolvedValue(undefined)

      const result = await asyncAction(mockAction, { key: 'test-key' })

      expect(result).toEqual({
        success: true,
        data: undefined,
      })
    })
  })
})
