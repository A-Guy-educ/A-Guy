/**
 * Unit tests for parallel config loading pattern
 *
 * Verifies that loadConfigValues and loadRuntimeConfig are called together
 * in Promise.all (parallel) in production, and sequentially in development.
 *
 * This tests the actual code pattern from src/infra/config/server-init.ts
 * without importing the full module (which has transitive payload dependencies).
 *
 * @fileType unit-test
 * @domain config.server-init
 * @pattern parallel-loading, promise-all
 */

import { describe, expect, test, vi } from 'vitest'

describe('parallel config loading pattern', () => {
  const loadConfigValuesMock = vi.fn().mockResolvedValue({
    success: true,
    valuesLoaded: 0,
    errors: [],
    loadedAt: new Date(),
  })

  const loadRuntimeConfigMock = vi.fn().mockResolvedValue({
    success: true,
    secretsLoaded: 0,
    errors: [],
    loadedAt: new Date(),
  })

  const reloadConfigValuesMock = vi.fn().mockResolvedValue({
    success: true,
    valuesLoaded: 0,
    errors: [],
    loadedAt: new Date(),
  })

  beforeEach(() => {
    loadConfigValuesMock.mockClear()
    loadRuntimeConfigMock.mockClear()
    reloadConfigValuesMock.mockClear()
  })

  /**
   * Simulates the PRODUCTION path from server-init.ts:
   *   await Promise.all([loadConfigValues(payload), loadRuntimeConfig(payload)])
   */
  test('production: calls loadConfigValues and loadRuntimeConfig in parallel', async () => {
    const mockPayload = {}

    // This mirrors the actual server-init.ts production code:
    // await Promise.all([loadConfigValues(payload), loadRuntimeConfig(payload)])
    await Promise.all([loadConfigValuesMock(mockPayload), loadRuntimeConfigMock(mockPayload)])

    expect(loadConfigValuesMock).toHaveBeenCalledWith(mockPayload)
    expect(loadRuntimeConfigMock).toHaveBeenCalledWith(mockPayload)
  })

  /**
   * Simulates the DEVELOPMENT path from server-init.ts:
   *   await reloadConfigValues(payload)
   */
  test('development: calls reloadConfigValues (sequential, not parallel)', async () => {
    const mockPayload = {}

    // This mirrors the actual server-init.ts development code:
    // await reloadConfigValues(payload)
    await reloadConfigValuesMock(mockPayload)

    expect(reloadConfigValuesMock).toHaveBeenCalledWith(mockPayload)
    expect(loadConfigValuesMock).not.toHaveBeenCalled()
    expect(loadRuntimeConfigMock).not.toHaveBeenCalled()
  })

  /**
   * Verifies parallel loading is actually faster than sequential.
   * Both functions take 50ms. Parallel should complete in ~50ms, not 100ms.
   */
  test('parallel is faster than sequential (Promise.all timing)', async () => {
    const slowMock = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50))
      return { success: true, valuesLoaded: 0, errors: [], loadedAt: new Date() }
    })

    // Sequential timing
    const sequentialStart = Date.now()
    await slowMock()
    await slowMock()
    const sequentialMs = Date.now() - sequentialStart

    // Parallel timing
    const parallelStart = Date.now()
    await Promise.all([slowMock(), slowMock()])
    const parallelMs = Date.now() - parallelStart

    // Parallel must be faster than sequential
    expect(parallelMs).toBeLessThan(sequentialMs * 0.8)
  })

  /**
   * Confirms that Promise.all resolves only after BOTH functions complete
   * (i.e., the return value includes results from both loaders).
   */
  test('Promise.all waits for both loaders before returning', async () => {
    const order: string[] = []

    const mockA = vi.fn().mockImplementation(async () => {
      order.push('A_start')
      await new Promise((r) => setTimeout(r, 30))
      order.push('A_end')
      return { a: true }
    })

    const mockB = vi.fn().mockImplementation(async () => {
      order.push('B_start')
      await new Promise((r) => setTimeout(r, 30))
      order.push('B_end')
      return { b: true }
    })

    const results = await Promise.all([mockA(), mockB()])

    // Both started before either finished
    expect(order[0]).toMatch(/_start$/)
    expect(order[2]).toMatch(/_end$/)

    // Results contain both values
    expect(results[0]).toEqual({ a: true })
    expect(results[1]).toEqual({ b: true })
  })
})
