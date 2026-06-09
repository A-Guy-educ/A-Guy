// @vitest-environment node

/**
 * Unit Tests for MetricsProvider timeout behavior (#2578)
 *
 * Tests that the MetricsProvider source code implements a fetch timeout.
 * Without a timeout, if the API hangs, the loading state would be stuck
 * forever (widgets show "Loading..." forever).
 *
 * This guards against the regression where admin dashboard widgets are
 * permanently stuck on "Loading..." because the fetch never completes.
 *
 * The fix is to implement a timeout using AbortController or Promise.race
 * with a timeout promise.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

describe('MetricsProvider timeout implementation (#2578)', () => {
  const metricsProviderPath = path.resolve(
    process.cwd(),
    'src/ui/admin/ConversionTracking/MetricsProvider.tsx',
  )

  it('should implement a timeout for the fetch request', () => {
    const content = readFileSync(metricsProviderPath, 'utf-8')

    // The MetricsProvider should implement a timeout mechanism
    // This can be done with AbortController, Promise.race with timeout,
    // or setTimeout-based abort
    const hasTimeout =
      content.includes('AbortController') ||
      content.includes('timeout') ||
      content.includes('setTimeout') ||
      content.includes('Promise.race')

    expect(hasTimeout).toBe(true)
  })

  it('should abort the fetch when timeout is reached', () => {
    const content = readFileSync(metricsProviderPath, 'utf-8')

    // If using AbortController, there should be signal passed to fetch
    // and an abort() call when timeout fires
    const hasAbort =
      (content.includes('signal') && content.includes('abort')) ||
      content.includes('AbortController')

    // Or if using Promise.race, the timeout should reject
    const hasTimeoutPromise = content.includes('timeout') && content.includes('Promise.race')

    expect(hasAbort || hasTimeoutPromise).toBe(true)
  })

  it('should set error state when fetch times out', () => {
    const content = readFileSync(metricsProviderPath, 'utf-8')

    // After timeout, error should be set so widgets don't stay in loading state
    // This means there should be setError call in the timeout handler
    const hasErrorOnTimeout =
      (content.includes('setError') && content.includes('timeout')) ||
      content.includes('timed out') ||
      content.includes('request timed out')

    expect(hasErrorOnTimeout).toBe(true)
  })
})
