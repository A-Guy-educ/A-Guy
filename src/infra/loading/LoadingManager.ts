// Types
export type LoadingType = 'route' | 'screen' | 'inline' | 'action'

export interface LoadingOperation {
  type: LoadingType
  startTime: number
  key: string
  timeoutId?: ReturnType<typeof setTimeout>
}

export interface LoadingSnapshot {
  version: number
  operationCount: number
}

// Safety timeout for route transitions (prevents stuck state)
const ROUTE_SAFETY_TIMEOUT_MS = 15_000

// Store implementation with immutable snapshots for useSyncExternalStore
export function createLoadingManager() {
  const operations = new Map<string, LoadingOperation>()
  let version = 0
  const listeners = new Set<() => void>()

  function notify() {
    version++
    listeners.forEach((listener) => listener())
  }

  return {
    // Registration with optional safety timeout
    register(key: string, type: LoadingType): void {
      // Clear any existing timeout for this key
      const existing = operations.get(key)
      if (existing?.timeoutId) {
        clearTimeout(existing.timeoutId)
      }

      const operation: LoadingOperation = { type, startTime: Date.now(), key }

      // Add safety timeout for route transitions to auto-unregister
      if (type === 'route') {
        operation.timeoutId = setTimeout(() => {
          // Auto-unregister if still present (navigation hung)
          if (operations.has(key)) {
            operations.delete(key)
            notify()
            if (process.env.NODE_ENV === 'development') {
              console.warn(
                `[LoadingManager] Route transition "${key}" timed out after ${ROUTE_SAFETY_TIMEOUT_MS}ms`,
              )
            }
          }
        }, ROUTE_SAFETY_TIMEOUT_MS)
      }

      operations.set(key, operation)
      notify()
    },

    unregister(key: string): void {
      const operation = operations.get(key)
      if (operation) {
        // Clear safety timeout if exists
        if (operation.timeoutId) {
          clearTimeout(operation.timeoutId)
        }
        operations.delete(key)
        notify()
      }
    },

    // Selectors
    isBusy(): boolean {
      return operations.size > 0
    },

    isScreenBusy(): boolean {
      for (const op of operations.values()) {
        if (op.type === 'screen') return true
      }
      return false
    },

    isRouteBusy(): boolean {
      for (const op of operations.values()) {
        if (op.type === 'route') return true
      }
      return false
    },

    // Generic key check (works for any type)
    isKeyBusy(key: string): boolean {
      return operations.has(key)
    },

    getActiveOperations(): LoadingOperation[] {
      return Array.from(operations.values())
    },

    // Subscription
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    // For React useSyncExternalStore - returns new object on each change
    getSnapshot(): LoadingSnapshot {
      return { version, operationCount: operations.size }
    },

    // For SSR
    getServerSnapshot(): LoadingSnapshot {
      return { version: 0, operationCount: 0 }
    },
  }
}

// Type for the manager instance (for DI in tests)
export type LoadingManagerInstance = ReturnType<typeof createLoadingManager>

// Singleton instance
export const loadingManager = createLoadingManager()
