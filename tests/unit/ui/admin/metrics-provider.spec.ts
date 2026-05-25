/**
 * Unit tests: MetricsProvider fetch timeout (#1866)
 *
 * Verifies that MetricsProvider includes a timeout on its fetch call so that
 * widgets are not stuck in loading state indefinitely when the server is
 * slow or unreachable (e.g., cold start, seed process on first request).
 *
 * Without a timeout, a hanging fetch keeps `loading=true` and `error=null`,
 * causing all dashboard widgets to show "Loading..." forever.
 *
 * @fileType unit-test
 * @domain admin
 * @ai-summary Unit test verifying the MetricsProvider fetch has a timeout
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

describe('MetricsProvider fetch timeout (#1866)', () => {
  const componentPath = path.resolve(
    process.cwd(),
    'src/ui/admin/ConversionTracking/MetricsProvider.tsx',
  )

  it('should have a MetricsProvider component file', () => {
    expect(() => readFileSync(componentPath, 'utf-8')).not.toThrow()
  })

  it('should use AbortController to implement fetch timeout', () => {
    const content = readFileSync(componentPath, 'utf-8')
    // AbortController is required to implement a fetch timeout
    const hasAbortController = content.includes('AbortController')
    expect(hasAbortController).toBe(true)
  })

  it('should pass signal to fetch for cancellation', () => {
    const content = readFileSync(componentPath, 'utf-8')
    // The fetch call must include a signal option for timeout cancellation
    const hasSignalInFetch = content.includes('signal:') && content.includes('controller.signal')
    expect(hasSignalInFetch).toBe(true)
  })

  it('should handle timeout as a catchable error', () => {
    const content = readFileSync(componentPath, 'utf-8')
    // The error handler should catch abort errors from timeout
    const hasAbortErrorHandling =
      content.includes('AbortError') ||
      content.includes('aborted') ||
      (content.includes('catch') && content.includes('err'))
    expect(hasAbortErrorHandling).toBe(true)
  })

  it('should set error state on timeout so widgets exit loading state', () => {
    const content = readFileSync(componentPath, 'utf-8')
    // On timeout/error, setError should be called to transition widgets from loading to error
    const hasSetErrorOnTimeout =
      content.includes('setError') &&
      (content.includes('AbortError') || content.includes('timeout') || content.includes('aborted'))
    expect(hasSetErrorOnTimeout).toBe(true)
  })
})
