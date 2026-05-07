import { describe, expect, it, vi, beforeEach } from 'vitest'
import { withConcurrencyLimit } from '@/infra/utils/concurrency'

describe('withConcurrencyLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('respects max concurrency', async () => {
    // Track max concurrent executions
    let concurrent = 0
    let maxConcurrent = 0
    const DELAY = 50

    const factory = vi.fn(async (item: number) => {
      concurrent++
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await new Promise((resolve) => setTimeout(resolve, DELAY))
      concurrent--
      return item * 2
    })

    const promise = withConcurrencyLimit([1, 2, 3, 4, 5], 2, factory)

    // Advance time in small increments to let tasks complete
    await vi.advanceTimersByTimeAsync(DELAY * 5)

    const results = await promise

    expect(maxConcurrent).toBeLessThanOrEqual(2)
    expect(results).toEqual([2, 4, 6, 8, 10])
  })

  it('returns results in original input order even when tasks complete out of order', async () => {
    const DELAY = 30

    // Items with random-ish delays to scramble completion order
    const factory = vi.fn(async (item: number) => {
      const delay = (item * 17) % DELAY // 0, 17, 4, 21, 8, 25, 12, ... (mod 30)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return item * 3
    })

    const promise = withConcurrencyLimit([1, 2, 3, 4, 5], 2, factory)
    await vi.advanceTimersByTimeAsync(100)
    const results = await promise

    // Despite completion order being scrambled, output must be in input order
    expect(results).toEqual([3, 6, 9, 12, 15])
  })

  it('propagates errors correctly', async () => {
    const factory = vi.fn(async (item: number) => {
      if (item === 3) {
        throw new Error('boom')
      }
      return item
    })

    const promise = withConcurrencyLimit([1, 2, 3, 4, 5], 2, factory)
    // Advance timers past all task delays so rejection callbacks run, then run
    // all pending microtasks so the rejection propagates synchronously before the
    // assertion checks it.
    vi.runAllTimers()
    await expect(promise).rejects.toThrow('boom')
  })

  it('returns empty array for empty input', async () => {
    const factory = vi.fn()
    const results = await withConcurrencyLimit([], 2, factory)
    expect(results).toEqual([])
    expect(factory).not.toHaveBeenCalled()
  })

  it('limit=1 executes sequentially', async () => {
    let concurrent = 0
    let maxConcurrent = 0

    const factory = vi.fn(async (item: number) => {
      concurrent++
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await new Promise((resolve) => setTimeout(resolve, 10))
      concurrent--
      return item
    })

    const promise = withConcurrencyLimit([1, 2, 3], 1, factory)
    await vi.advanceTimersByTimeAsync(50)
    const results = await promise

    expect(maxConcurrent).toBe(1)
    expect(results).toEqual([1, 2, 3])
  })

  it('limit >= items length starts all immediately', async () => {
    let starts = 0

    const factory = vi.fn(async (item: number) => {
      starts++
      await new Promise((resolve) => setTimeout(resolve, 10))
      return item
    })

    const promise = withConcurrencyLimit([1, 2, 3], 10, factory)
    // All should start synchronously (before any timer advancement)
    expect(factory).toHaveBeenCalledTimes(3)

    await vi.advanceTimersByTimeAsync(20)
    const results = await promise

    expect(results).toEqual([1, 2, 3])
  })

  it('throws when limit < 1', async () => {
    const factory = vi.fn()
    await expect(withConcurrencyLimit([1, 2, 3], 0, factory)).rejects.toThrow(
      'withConcurrencyLimit: limit must be >= 1',
    )
  })
})
