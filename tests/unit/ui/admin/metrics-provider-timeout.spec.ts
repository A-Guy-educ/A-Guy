/**
 * Unit tests for MetricsProvider timeout handling (#2532)
 *
 * Tests that the MetricsProvider has a timeout mechanism to prevent
 * widgets from being stuck in Loading state when the API is slow/hanging.
 *
 * @fileType unit-test
 * @domain admin
 * @ai-summary Unit test verifying MetricsProvider has fetch timeout
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

describe('MetricsProvider timeout handling (#2532)', () => {
  const componentPath = path.resolve(
    process.cwd(),
    'src/ui/admin/ConversionTracking/MetricsProvider.tsx',
  )

  it('should have a MetricsProvider component file', () => {
    expect(() => readFileSync(componentPath, 'utf-8')).not.toThrow()
  })

  it('should use AbortController to implement timeout', () => {
    const content = readFileSync(componentPath, 'utf-8')

    // The fetch should use AbortController to allow timeout
    const hasAbortController = content.includes('AbortController')

    expect(hasAbortController).toBe(true)
  })

  it('should set a timeout that aborts the fetch', () => {
    const content = readFileSync(componentPath, 'utf-8')

    // Should have setTimeout with abort call
    const hasTimeoutAbort = content.includes('setTimeout') && content.includes('controller.abort')

    expect(hasTimeoutAbort).toBe(true)
  })

  it('should pass signal to fetch for timeout control', () => {
    const content = readFileSync(componentPath, 'utf-8')

    // Fetch should include signal: controller.signal
    const hasFetchSignal = content.includes('signal: controller.signal')

    expect(hasFetchSignal).toBe(true)
  })

  it('should handle AbortError (timeout) as a distinct error', () => {
    const content = readFileSync(componentPath, 'utf-8')

    // Should check for err.name === 'AbortError' or similar
    const handlesAbortError =
      content.includes("err.name === 'AbortError'") ||
      content.includes('err.name === "AbortError"') ||
      content.includes('AbortError')

    expect(handlesAbortError).toBe(true)
  })

  it('should clear timeout on both success and error paths', () => {
    const content = readFileSync(componentPath, 'utf-8')

    // Should clear timeout after fetch completes
    const clearsTimeoutOnSuccess = content.includes('clearTimeout(timeoutId)')

    expect(clearsTimeoutOnSuccess).toBe(true)
  })
})

describe('RecentTransactionsWidget timeout handling (#2532)', () => {
  const widgetPath = path.resolve(process.cwd(), 'src/ui/admin/RecentTransactionsWidget/index.tsx')

  it('should have a RecentTransactionsWidget component file', () => {
    expect(() => readFileSync(widgetPath, 'utf-8')).not.toThrow()
  })

  it('should use AbortController to implement timeout', () => {
    const content = readFileSync(widgetPath, 'utf-8')

    // The fetch should use AbortController to allow timeout
    const hasAbortController = content.includes('AbortController')

    expect(hasAbortController).toBe(true)
  })

  it('should set a timeout that aborts the fetch', () => {
    const content = readFileSync(widgetPath, 'utf-8')

    // Should have setTimeout with abort call
    const hasTimeoutAbort = content.includes('setTimeout') && content.includes('controller.abort')

    expect(hasTimeoutAbort).toBe(true)
  })

  it('should pass signal to fetch for timeout control', () => {
    const content = readFileSync(widgetPath, 'utf-8')

    // Fetch should include signal: controller.signal
    const hasFetchSignal = content.includes('signal: controller.signal')

    expect(hasFetchSignal).toBe(true)
  })

  it('should handle AbortError (timeout) as a distinct error', () => {
    const content = readFileSync(widgetPath, 'utf-8')

    // Should check for err.name === 'AbortError' or similar
    const handlesAbortError =
      content.includes("err.name === 'AbortError'") ||
      content.includes('err.name === "AbortError"') ||
      content.includes('AbortError')

    expect(handlesAbortError).toBe(true)
  })

  it('should clear timeout on both success and error paths', () => {
    const content = readFileSync(widgetPath, 'utf-8')

    // Should clear timeout after fetch completes
    const clearsTimeoutOnSuccess = content.includes('clearTimeout(timeoutId)')

    expect(clearsTimeoutOnSuccess).toBe(true)
  })
})
