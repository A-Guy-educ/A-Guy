import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createLoadingManager } from '@/infra/loading/LoadingManager'

describe('LoadingManager', () => {
  let manager: ReturnType<typeof createLoadingManager>

  beforeEach(() => {
    manager = createLoadingManager()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('register and unregister', () => {
    it('should register a loading operation', () => {
      manager.register('test-key', 'action')
      expect(manager.isKeyBusy('test-key')).toBe(true)
      expect(manager.isBusy()).toBe(true)
    })

    it('should unregister a loading operation', () => {
      manager.register('test-key', 'action')
      manager.unregister('test-key')
      expect(manager.isKeyBusy('test-key')).toBe(false)
      expect(manager.isBusy()).toBe(false)
    })

    it('should handle multiple operations', () => {
      manager.register('key1', 'action')
      manager.register('key2', 'screen')
      expect(manager.isKeyBusy('key1')).toBe(true)
      expect(manager.isKeyBusy('key2')).toBe(true)
      expect(manager.getActiveOperations()).toHaveLength(2)
    })
  })

  describe('selectors', () => {
    it('should return false when no operations are active', () => {
      expect(manager.isBusy()).toBe(false)
      expect(manager.isScreenBusy()).toBe(false)
      expect(manager.isRouteBusy()).toBe(false)
    })

    it('should detect screen-type operations', () => {
      manager.register('screen-key', 'screen')
      expect(manager.isScreenBusy()).toBe(true)
      expect(manager.isBusy()).toBe(true)
    })

    it('should detect route-type operations', () => {
      manager.register('route-key', 'route')
      expect(manager.isRouteBusy()).toBe(true)
      expect(manager.isBusy()).toBe(true)
    })

    it('should differentiate between operation types', () => {
      manager.register('action-key', 'action')
      expect(manager.isBusy()).toBe(true)
      expect(manager.isScreenBusy()).toBe(false)
      expect(manager.isRouteBusy()).toBe(false)
    })
  })

  describe('route safety timeout', () => {
    it('should auto-unregister route operations after timeout', () => {
      manager.register('route-key', 'route')
      expect(manager.isRouteBusy()).toBe(true)

      // Advance time past the safety timeout (15 seconds)
      vi.advanceTimersByTime(15_001)

      expect(manager.isRouteBusy()).toBe(false)
    })

    it('should not auto-unregister non-route operations', () => {
      manager.register('action-key', 'action')
      expect(manager.isKeyBusy('action-key')).toBe(true)

      vi.advanceTimersByTime(15_001)

      // Action should still be busy (no timeout)
      expect(manager.isKeyBusy('action-key')).toBe(true)
    })

    it('should clear timeout when manually unregistered', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
      manager.register('route-key', 'route')
      manager.unregister('route-key')

      expect(clearTimeoutSpy).toHaveBeenCalled()
      expect(manager.isRouteBusy()).toBe(false)
    })
  })

  describe('subscription', () => {
    it('should notify subscribers on register', () => {
      const listener = vi.fn()
      manager.subscribe(listener)

      manager.register('test-key', 'action')

      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('should notify subscribers on unregister', () => {
      const listener = vi.fn()
      manager.register('test-key', 'action')
      manager.subscribe(listener)

      manager.unregister('test-key')

      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('should allow unsubscribing', () => {
      const listener = vi.fn()
      const unsubscribe = manager.subscribe(listener)

      unsubscribe()
      manager.register('test-key', 'action')

      expect(listener).not.toHaveBeenCalled()
    })

    it('should support multiple subscribers', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      manager.subscribe(listener1)
      manager.subscribe(listener2)

      manager.register('test-key', 'action')

      expect(listener1).toHaveBeenCalled()
      expect(listener2).toHaveBeenCalled()
    })
  })

  describe('snapshots', () => {
    it('should increment version on state change', () => {
      const snapshot1 = manager.getSnapshot()
      manager.register('test-key', 'action')
      const snapshot2 = manager.getSnapshot()

      expect(snapshot2.version).toBeGreaterThan(snapshot1.version)
    })

    it('should track operation count', () => {
      const snapshot1 = manager.getSnapshot()
      expect(snapshot1.operationCount).toBe(0)

      manager.register('key1', 'action')
      manager.register('key2', 'action')
      const snapshot2 = manager.getSnapshot()

      expect(snapshot2.operationCount).toBe(2)
    })

    it('should return zero-state snapshot for SSR', () => {
      manager.register('test-key', 'action')
      const serverSnapshot = manager.getServerSnapshot()

      expect(serverSnapshot.version).toBe(0)
      expect(serverSnapshot.operationCount).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle unregistering non-existent key gracefully', () => {
      expect(() => manager.unregister('non-existent')).not.toThrow()
    })

    it('should replace existing operation with same key', () => {
      manager.register('test-key', 'action')
      const ops1 = manager.getActiveOperations()

      manager.register('test-key', 'screen') // Re-register with different type
      const ops2 = manager.getActiveOperations()

      // Should still have only 1 operation (replaced, not added)
      expect(ops1).toHaveLength(1)
      expect(ops2).toHaveLength(1)
      expect(ops2[0].type).toBe('screen')
    })
  })
})
