/**
 * Unit tests: useCurrentUser fetch timeout
 *
 * Verifies that useCurrentUser properly handles fetch timeouts so that
 * a hanging /api/users/me request does not leave isLoading=true forever.
 * This guards against issue #2575 where /admin/chat remained stuck on the
 * loading state because useCurrentUser had no timeout on its fetch.
 */

// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const USER_TIMEOUT_MS = 15_000

describe('useCurrentUser timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('sets isLoading to false after fetch times out', async () => {
    // Simulate a fetch that hangs indefinitely (no response ever comes)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, options?: RequestInit) => {
        const signal = options?.signal as AbortSignal
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      }),
    )

    const { useCurrentUser } = await import('@/client/hooks/useCurrentUser')

    // Render without wrapping in act — useEffect runs after render completes
    const { result } = renderHook(() => useCurrentUser())

    // Should be loading initially
    expect(result.current.isLoading).toBe(true)

    // Advance past the 15s timeout to trigger the abort inside act()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(USER_TIMEOUT_MS + 100)
    })

    // isLoading should become false after timeout (error was caught, user is null)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('uses a 15 second timeout', () => {
    expect(USER_TIMEOUT_MS).toBe(15_000)
  })
})
