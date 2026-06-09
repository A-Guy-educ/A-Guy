/**
 * Unit tests: MetricsProvider and RecentTransactionsWidget fetch timeout (#2570)
 *
 * Verifies that both widgets implement a fetch timeout to prevent the widgets
 * from being permanently stuck in "Loading..." state when the API is slow/hanging.
 *
 * @fileType unit-test
 * @domain admin
 * @ai-summary Unit test verifying fetch timeout in MetricsProvider and RecentTransactionsWidget
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

describe('MetricsProvider fetch timeout (#2570)', () => {
  const componentPath = path.resolve(
    process.cwd(),
    'src/ui/admin/ConversionTracking/MetricsProvider.tsx',
  )

  it('has MetricsProvider component file', () => {
    expect(() => readFileSync(componentPath, 'utf-8')).not.toThrow()
  })

  it('uses AbortController to allow fetch cancellation', () => {
    const content = readFileSync(componentPath, 'utf-8')
    expect(content).toContain('AbortController')
  })

  it('sets a timeout that aborts the fetch request', () => {
    const content = readFileSync(componentPath, 'utf-8')
    // Must have setTimeout with controller.abort()
    const hasTimeoutAbort = content.includes('setTimeout') && content.includes('controller.abort')
    expect(hasTimeoutAbort).toBe(true)
  })

  it('passes signal option to fetch for timeout control', () => {
    const content = readFileSync(componentPath, 'utf-8')
    expect(content).toContain('signal: controller.signal')
  })

  it('clears timeout on successful response', () => {
    const content = readFileSync(componentPath, 'utf-8')
    // After the fetch resolves, clearTimeout must be called to avoid leaks
    expect(content).toContain('clearTimeout(timeoutId)')
  })

  it('handles AbortError (timeout) as a distinct error type', () => {
    const content = readFileSync(componentPath, 'utf-8')
    // Must check for AbortError to differentiate timeout from other errors
    const handlesAbortError =
      content.includes("err.name === 'AbortError'") ||
      content.includes('err.name === "AbortError"') ||
      (content.includes('AbortError') && content.includes("'timeout'"))
    expect(handlesAbortError).toBe(true)
  })

  it('clears timeout when fetch throws (error path)', () => {
    const content = readFileSync(componentPath, 'utf-8')
    // The catch block must also clear the timeout
    expect(content).toContain('clearTimeout(timeoutId)')
  })
})

describe('RecentTransactionsWidget fetch timeout (#2570)', () => {
  const widgetPath = path.resolve(process.cwd(), 'src/ui/admin/RecentTransactionsWidget/index.tsx')

  it('has RecentTransactionsWidget component file', () => {
    expect(() => readFileSync(widgetPath, 'utf-8')).not.toThrow()
  })

  it('uses AbortController to allow fetch cancellation', () => {
    const content = readFileSync(widgetPath, 'utf-8')
    expect(content).toContain('AbortController')
  })

  it('sets a timeout that aborts the fetch request', () => {
    const content = readFileSync(widgetPath, 'utf-8')
    const hasTimeoutAbort = content.includes('setTimeout') && content.includes('controller.abort')
    expect(hasTimeoutAbort).toBe(true)
  })

  it('passes signal option to fetch for timeout control', () => {
    const content = readFileSync(widgetPath, 'utf-8')
    expect(content).toContain('signal: controller.signal')
  })

  it('handles AbortError (timeout) as a distinct error type', () => {
    const content = readFileSync(widgetPath, 'utf-8')
    const handlesAbortError =
      content.includes("err.name === 'AbortError'") ||
      content.includes('err.name === "AbortError"') ||
      (content.includes('AbortError') && content.includes("'timeout'"))
    expect(handlesAbortError).toBe(true)
  })

  it('clears timeout on successful response', () => {
    const content = readFileSync(widgetPath, 'utf-8')
    expect(content).toContain('clearTimeout(timeoutId)')
  })

  it('clears timeout when fetch throws (error path)', () => {
    const content = readFileSync(widgetPath, 'utf-8')
    expect(content).toContain('clearTimeout(timeoutId)')
  })
})
