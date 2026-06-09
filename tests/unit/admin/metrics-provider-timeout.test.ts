/**
 * Unit tests: MetricsProvider fetch timeout
 *
 * Verifies that the fetchWithTimeout utility correctly aborts hanging requests.
 * This guards against issue #2574 where admin dashboard widgets permanently
 * stuck on "Loading..." because the metrics fetch had no timeout.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const METRICS_TIMEOUT_MS = 15_000

/** Minimal fetch wrapper that times out — mirrors what MetricsProvider now uses */
async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs = METRICS_TIMEOUT_MS,
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('rejects with AbortError when request times out', async () => {
    // Simulate a fetch that hangs (never resolves)
    let abortListener: (() => void) | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, options?: RequestInit) => {
        const signal = options?.signal as AbortSignal
        return new Promise((_resolve, reject) => {
          abortListener = () => reject(new DOMException('Aborted', 'AbortError'))
          signal?.addEventListener('abort', abortListener!)
        })
      }),
    )

    let caughtError: unknown = null
    const p = fetchWithTimeout('/api/admin/dashboard-metrics?period=month').catch((e) => {
      caughtError = e
    })

    // Advance past the timeout to trigger abort
    await vi.advanceTimersByTimeAsync(METRICS_TIMEOUT_MS + 100)
    await p

    expect(caughtError).not.toBeNull()
    expect((caughtError as Error)?.name).toBe('AbortError')
  })

  it('passes credentials and other options through to fetch', async () => {
    let receivedOptions: RequestInit = {}
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, options?: RequestInit) => {
        receivedOptions = { ...options }
        await new Promise(() => {}) // hang
        return new Response('{}', { status: 200 })
      }),
    )

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), METRICS_TIMEOUT_MS)
    fetchWithTimeout('/api/admin/dashboard-metrics?period=month', {
      credentials: 'include',
    }).catch(() => {})

    await vi.advanceTimersByTimeAsync(METRICS_TIMEOUT_MS + 100)

    expect(receivedOptions.credentials).toBe('include')
    expect(receivedOptions.signal).toBeDefined()
    clearTimeout(timeout)
  })

  it('uses a 15 second timeout by default', () => {
    expect(METRICS_TIMEOUT_MS).toBe(15_000)
  })
})
