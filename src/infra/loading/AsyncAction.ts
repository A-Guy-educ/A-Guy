import { loadingManager, type LoadingManagerInstance } from './LoadingManager'

export interface ActionResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  errors?: Record<string, string>
}

export interface AsyncActionOptions {
  key: string
  preventDuplicate?: boolean // Default: true
}

/**
 * Factory function for creating asyncAction with custom manager (for testing)
 */
export function createAsyncAction(manager: LoadingManagerInstance) {
  return async function asyncAction<T>(
    action: () => Promise<T>,
    options: AsyncActionOptions,
  ): Promise<ActionResult<T>> {
    const { key, preventDuplicate = true } = options

    // Check for duplicate using generic key check
    if (preventDuplicate && manager.isKeyBusy(key)) {
      return { success: false, error: 'Action already in progress' }
    }

    try {
      manager.register(key, 'action')
      const result = await action()

      // Handle server action result format
      if (result && typeof result === 'object') {
        const actionResult = result as Record<string, unknown>

        // Already has success field (our server action format)
        if ('success' in actionResult && typeof actionResult.success === 'boolean') {
          return actionResult as unknown as ActionResult<T>
        }

        // Wrap raw result
        return { success: true, data: result }
      }

      return { success: true, data: result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      return { success: false, error: message }
    } finally {
      manager.unregister(key)
    }
  }
}

/**
 * Wraps an async action with loading state management
 * - Registers/unregisters loading state
 * - Prevents duplicate submissions (optional)
 * - Returns normalized result contract
 *
 * @example
 * const result = await asyncAction(
 *   () => loginAction(formData),
 *   { key: 'login' }
 * )
 */
export const asyncAction = createAsyncAction(loadingManager)
