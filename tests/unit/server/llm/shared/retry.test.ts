/**
 * Unit Tests for LLM Shared Utilities - Retry
 *
 * @fileType test
 * @domain ai
 */
import { sleep, withRetry } from '@/infra/llm/providers/shared/retry'
import { describe, expect, it, vi } from 'vitest'

describe('withRetry', () => {
  it('retries on retryable errors with exponential backoff', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('success')

    const result = await withRetry(operation, {
      maxRetries: 2,
      delayMs: 10,
      isRetryable: () => true,
      wrapError: (e: Error) => e,
      logPrefix: '[Test]',
    })

    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('does not retry non-retryable errors', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('invalid api key'))

    await expect(
      withRetry(operation, {
        maxRetries: 2,
        delayMs: 10,
        isRetryable: (e) => !e.message.includes('api key'),
        wrapError: (e: Error) => e,
        logPrefix: '[Test]',
      }),
    ).rejects.toThrow('invalid api key')

    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('succeeds on first attempt', async () => {
    const operation = vi.fn().mockResolvedValue('success')

    const result = await withRetry(operation, {
      maxRetries: 2,
      delayMs: 10,
      isRetryable: () => true,
      wrapError: (e: Error) => e,
      logPrefix: '[Test]',
    })

    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('exhausts all retries and throws', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('persistent error'))

    await expect(
      withRetry(operation, {
        maxRetries: 2,
        delayMs: 10,
        isRetryable: () => true,
        wrapError: (e: Error) => e,
        logPrefix: '[Test]',
      }),
    ).rejects.toThrow('persistent error')

    expect(operation).toHaveBeenCalledTimes(3) // Initial + 2 retries
  })

  it('calls onRetry callback before each retry', async () => {
    const onRetry = vi.fn()
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('error 1'))
      .mockResolvedValueOnce('success')

    await withRetry(operation, {
      maxRetries: 2,
      delayMs: 10,
      isRetryable: () => true,
      wrapError: (e: Error) => e,
      logPrefix: '[Test]',
      onRetry,
    })

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1)
  })

  it('uses default values when options not provided', async () => {
    const operation = vi.fn().mockResolvedValue('success')

    const result = await withRetry(operation, {})

    expect(result).toBe('success')
  })
})

describe('sleep', () => {
  it('resolves after specified delay', async () => {
    const start = Date.now()
    await sleep(20)
    const elapsed = Date.now() - start

    expect(elapsed).toBeGreaterThanOrEqual(15)
  })
})
