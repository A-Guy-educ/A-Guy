/**
 * Unit tests for useCurrentUser timeout behavior
 *
 * Tests the fix for: #2579 - Admin chat page stuck on Loading
 *
 * The useCurrentUser hook had no timeout on its fetch request to /api/users/me.
 * If that endpoint hangs, isLoading stays true forever, causing pages that
 * depend on it (like /admin/chat) to show "Loading..." indefinitely.
 *
 * The fix adds an AbortController with a 15s timeout, mirroring the pattern
 * already used in useStudyPlan.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Mock the logger
vi.mock('@/infra/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}))

// Mock fetch at module level
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('useCurrentUser timeout behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should transition isLoading to false even when fetch times out (15s)', async () => {
    // Track setTimeout calls to verify timeout is set up correctly
    const originalSetTimeout = globalThis.setTimeout
    let capturedTimeoutCb: () => void = () => {}
    let capturedTimeoutDelay: number | undefined

    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((cb: () => void, delay?: number) => {
      capturedTimeoutCb = cb
      capturedTimeoutDelay = delay
      return originalSetTimeout(cb, delay ?? 0)
    }) as typeof setTimeout)

    // Mock fetch that respects AbortSignal: rejects with AbortError when aborted
    mockFetch.mockImplementation(
      (_url: string, _init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = _init?.signal as AbortSignal | undefined
          if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'))
            return
          }
          signal?.addEventListener(
            'abort',
            () => {
              reject(new DOMException('Aborted', 'AbortError'))
            },
            { once: true },
          )
        }),
    )

    const { useCurrentUser } = await import('@/client/hooks/useCurrentUser')

    const { result } = renderHook(() => useCurrentUser())

    // Immediately after mount, isLoading should be true
    expect(result.current.isLoading).toBe(true)
    // Verify 15s timeout was set
    expect(capturedTimeoutDelay).toBe(15000)

    // Manually trigger the timeout callback (simulates 15s passing)
    capturedTimeoutCb!()

    // After timeout fires and abort is triggered, isLoading should be false
    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false)
      },
      { timeout: 2000 },
    )
  })

  it('should successfully load user when API responds before timeout', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' }
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ user: mockUser }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { useCurrentUser } = await import('@/client/hooks/useCurrentUser')

    const { result } = renderHook(() => useCurrentUser())

    expect(result.current.isLoading).toBe(true)

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false)
      },
      { timeout: 2000 },
    )

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.error).toBeNull()
  })

  it('should set user to null and isLoading to false on 401 response', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 401 }))

    const { useCurrentUser } = await import('@/client/hooks/useCurrentUser')

    const { result } = renderHook(() => useCurrentUser())

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false)
      },
      { timeout: 2000 },
    )

    expect(result.current.user).toBeNull()
    expect(result.current.error).toBeNull()
  })
})
