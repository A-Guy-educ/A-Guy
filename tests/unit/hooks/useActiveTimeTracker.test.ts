// @vitest-environment jsdom
/**
 * Unit tests for useActiveTimeTracker hook
 *
 * Tests the heartbeat mechanism with various scenarios including:
 * - Successful heartbeat
 * - Failed heartbeat (network error)
 * - Heartbeat timeout
 */
import { useActiveTimeTracker } from '@/client/hooks/useActiveTimeTracker'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useActiveTimeTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, totalTimeSpentSeconds: 30 }),
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should send heartbeat successfully when authenticated', async () => {
    const { result } = renderHook(() =>
      useActiveTimeTracker({ isAuthenticated: true, enabled: true }),
    )

    // Wait for the effect to set up the interval
    await act(async () => {
      vi.advanceTimersByTime(31000) // Advance past first heartbeat interval (30s)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/stats/heartbeat',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds: 30 }),
      }),
    )
  })

  it('should NOT send heartbeat when not authenticated', async () => {
    const { result } = renderHook(() =>
      useActiveTimeTracker({ isAuthenticated: false, enabled: true }),
    )

    // Advance time significantly
    await act(async () => {
      vi.advanceTimersByTime(60000) // 1 minute
    })

    // No heartbeat should be sent when not authenticated
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should NOT send heartbeat when disabled', async () => {
    const { result } = renderHook(() =>
      useActiveTimeTracker({ isAuthenticated: true, enabled: false }),
    )

    // Advance time significantly
    await act(async () => {
      vi.advanceTimersByTime(60000) // 1 minute
    })

    // No heartbeat should be sent when disabled
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should handle heartbeat failure gracefully without throwing', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() =>
      useActiveTimeTracker({ isAuthenticated: true, enabled: true }),
    )

    // Wait for the heartbeat to be sent and fail
    await act(async () => {
      vi.advanceTimersByTime(31000)
    })

    // The hook should have caught the error and logged it
    expect(mockFetch).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('Failed to send heartbeat:', expect.any(TypeError))

    consoleSpy.mockRestore()
  })

  it('should include lessonId in heartbeat when provided', async () => {
    const { result } = renderHook(() =>
      useActiveTimeTracker({
        isAuthenticated: true,
        enabled: true,
        getLessonId: () => 'lesson-123',
      }),
    )

    await act(async () => {
      vi.advanceTimersByTime(31000)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/stats/heartbeat',
      expect.objectContaining({
        body: JSON.stringify({ seconds: 30, lessonId: 'lesson-123' }),
      }),
    )
  })

  it('should NOT include lessonId when getLessonId returns null', async () => {
    const { result } = renderHook(() =>
      useActiveTimeTracker({
        isAuthenticated: true,
        enabled: true,
        getLessonId: () => null,
      }),
    )

    await act(async () => {
      vi.advanceTimersByTime(31000)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/stats/heartbeat',
      expect.objectContaining({
        body: JSON.stringify({ seconds: 30 }),
      }),
    )
  })

  it('should use null when getLessonId is not provided', async () => {
    const { result } = renderHook(() =>
      useActiveTimeTracker({ isAuthenticated: true, enabled: true }),
    )

    await act(async () => {
      vi.advanceTimersByTime(31000)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/stats/heartbeat',
      expect.objectContaining({
        body: JSON.stringify({ seconds: 30 }),
      }),
    )
  })

  it('should clean up interval on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useActiveTimeTracker({ isAuthenticated: true, enabled: true }),
    )

    // Trigger first heartbeat
    await act(async () => {
      vi.advanceTimersByTime(31000)
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Unmount the hook
    unmount()

    // Advance more time - no additional heartbeats should be sent
    await act(async () => {
      vi.advanceTimersByTime(30000)
    })

    // Should still only have 1 call (from before unmount)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('should pause heartbeat when tab is hidden', async () => {
    const { result } = renderHook(() =>
      useActiveTimeTracker({ isAuthenticated: true, enabled: true }),
    )

    // Tab becomes hidden
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Advance time while tab is hidden
    await act(async () => {
      vi.advanceTimersByTime(60000) // 1 minute
    })

    // No heartbeat should be sent while tab is hidden
    expect(mockFetch).not.toHaveBeenCalled()

    // Tab becomes visible again
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Advance time after tab becomes visible
    await act(async () => {
      vi.advanceTimersByTime(31000)
    })

    // Now heartbeat should be sent
    expect(mockFetch).toHaveBeenCalled()
  })
})
