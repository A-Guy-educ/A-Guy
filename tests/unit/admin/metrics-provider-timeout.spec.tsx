/**
 * Unit tests for Issue #2546: Dashboard widgets show Loading for many seconds
 *
 * The MetricsProvider should not stay in loading state forever when the
 * /api/admin/dashboard-metrics endpoint is slow or hangs. A timeout should
 * abort the request and transition to error state.
 *
 * Bug: fetch has no timeout - if the server is slow, loading state persists
 * for many seconds with no feedback to the user.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import React from 'react'

// Mock requestAnimationFrame
const mockRequestAnimationFrame = vi.fn((cb: (time: number) => void) => {
  cb(0)
  return 0
})
global.requestAnimationFrame = mockRequestAnimationFrame
global.cancelAnimationFrame = vi.fn()

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// Import MetricsProvider normally (after global mocks are set up)
import {
  default as MetricsProvider,
  useMetricsContext,
} from '@/ui/admin/ConversionTracking/MetricsProvider'

/**
 * Creates a fetch mock that simulates a hanging server but properly rejects
 * when the AbortController is aborted (as real fetch does).
 */
function createHungFetchMock(): typeof global.fetch {
  return vi.fn((_url: string, options?: RequestInit) => {
    return new Promise<Response>((_, reject) => {
      const signal = options?.signal as AbortSignal | undefined
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      if (signal) {
        const handler = () => reject(new DOMException('Aborted', 'AbortError'))
        signal.addEventListener('abort', handler, { once: true })
      }
      // Never resolve - simulates a hanging server
    })
  }) as unknown as typeof global.fetch
}

/**
 * This test verifies the bug: MetricsProvider's fetchMetrics has no timeout.
 * When the API endpoint hangs, the loading state persists forever.
 *
 * The fix: Add AbortController with a ~10s timeout to abort the fetch
 * and transition to error state instead of staying in loading forever.
 */
describe('MetricsProvider timeout behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', createHungFetchMock())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should transition from loading to error state when fetch times out', async () => {
    const TestComponent: React.FC = () => {
      const ctx = useMetricsContext()
      if (ctx.loading) return <div data-testid="loading">Loading...</div>
      if (ctx.error) return <div data-testid="error">{ctx.error}</div>
      return <div data-testid="data">Data loaded</div>
    }

    render(
      <MetricsProvider>
        <TestComponent />
      </MetricsProvider>,
    )

    // Assert: initially loading
    expect(screen.getByTestId('loading')).toBeTruthy()
    expect(screen.queryByTestId('error')).toBeNull()

    // Run all timers to trigger the 10s timeout
    // The setTimeout inside MetricsProvider fires and aborts the fetch
    // Wrap in act() to flush React state updates
    await act(async () => {
      vi.runAllTimers()
    })

    // After runAllTimers, the timeout should have fired and error should be shown
    expect(screen.queryByTestId('loading')).toBeNull()
    expect(screen.queryByTestId('error')).toBeTruthy()
  })
})
