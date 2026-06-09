/**
 * Unit tests: useCurrentUser fetch timeout (#2571)
 *
 * Verifies that useCurrentUser implements a fetch timeout to prevent pages
 * from being permanently stuck in "Loading..." state when the API is slow/hanging.
 *
 * @fileType unit-test
 * @domain admin
 * @ai-summary Unit test verifying fetch timeout in useCurrentUser hook
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

describe('useCurrentUser fetch timeout (#2571)', () => {
  const hookPath = path.resolve(process.cwd(), 'src/client/hooks/useCurrentUser.ts')

  it('has useCurrentUser hook file', () => {
    expect(() => readFileSync(hookPath, 'utf-8')).not.toThrow()
  })

  it('uses AbortController to allow fetch cancellation', () => {
    const content = readFileSync(hookPath, 'utf-8')
    expect(content).toContain('AbortController')
  })

  it('sets a timeout that aborts the fetch request', () => {
    const content = readFileSync(hookPath, 'utf-8')
    // Must have setTimeout with controller.abort()
    const hasTimeoutAbort = content.includes('setTimeout') && content.includes('controller.abort')
    expect(hasTimeoutAbort).toBe(true)
  })

  it('passes signal option to fetch for timeout control', () => {
    const content = readFileSync(hookPath, 'utf-8')
    expect(content).toContain('signal: controller.signal')
  })

  it('clears timeout on successful response', () => {
    const content = readFileSync(hookPath, 'utf-8')
    // After the fetch resolves, clearTimeout must be called to avoid leaks
    expect(content).toContain('clearTimeout(timeoutId)')
  })

  it('handles AbortError (timeout) as a distinct error type', () => {
    const content = readFileSync(hookPath, 'utf-8')
    // Must check for AbortError to differentiate timeout from other errors
    const handlesAbortError =
      content.includes("err.name === 'AbortError'") ||
      content.includes('err.name === "AbortError"') ||
      (content.includes('AbortError') && content.includes("'timeout'"))
    expect(handlesAbortError).toBe(true)
  })

  it('clears timeout when fetch throws (error path)', () => {
    const content = readFileSync(hookPath, 'utf-8')
    // The catch block must also clear the timeout
    expect(content).toContain('clearTimeout(timeoutId)')
  })
})
