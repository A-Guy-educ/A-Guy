import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  CircuitBreaker,
  CircuitOpenError,
  getCircuitBreaker,
} from '@/infra/llm/providers/shared/circuit-breaker'

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    breaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 1000, name: 'test' })
  })

  it('should start in closed state', () => {
    expect(breaker.getState()).toBe('closed')
    expect(breaker.getFailureCount()).toBe(0)
  })

  it('should pass through successful operations', async () => {
    const result = await breaker.execute(async () => 'success')
    expect(result).toBe('success')
    expect(breaker.getState()).toBe('closed')
  })

  it('should count failures but stay closed below threshold', async () => {
    const failOp = async () => {
      throw new Error('fail')
    }

    await expect(breaker.execute(failOp)).rejects.toThrow('fail')
    expect(breaker.getFailureCount()).toBe(1)
    expect(breaker.getState()).toBe('closed')

    await expect(breaker.execute(failOp)).rejects.toThrow('fail')
    expect(breaker.getFailureCount()).toBe(2)
    expect(breaker.getState()).toBe('closed')
  })

  it('should open after reaching failure threshold', async () => {
    const failOp = async () => {
      throw new Error('fail')
    }

    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failOp)).rejects.toThrow('fail')
    }

    expect(breaker.getState()).toBe('open')
    expect(breaker.getFailureCount()).toBe(3)
  })

  it('should throw CircuitOpenError when circuit is open', async () => {
    const failOp = async () => {
      throw new Error('fail')
    }

    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failOp)).rejects.toThrow('fail')
    }

    // Next call should fail fast with CircuitOpenError
    await expect(breaker.execute(async () => 'ok')).rejects.toThrow(CircuitOpenError)
    await expect(breaker.execute(async () => 'ok')).rejects.toThrow(/circuit breaker is open/)
  })

  it('should transition to half-open after cooldown', async () => {
    vi.useFakeTimers()

    const failOp = async () => {
      throw new Error('fail')
    }

    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failOp)).rejects.toThrow('fail')
    }

    expect(breaker.getState()).toBe('open')

    // Advance past cooldown
    vi.advanceTimersByTime(1100)

    expect(breaker.getState()).toBe('half-open')

    vi.useRealTimers()
  })

  it('should close circuit on successful probe in half-open state', async () => {
    vi.useFakeTimers()

    const failOp = async () => {
      throw new Error('fail')
    }

    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failOp)).rejects.toThrow('fail')
    }

    vi.advanceTimersByTime(1100)

    // Successful probe
    const result = await breaker.execute(async () => 'recovered')
    expect(result).toBe('recovered')
    expect(breaker.getState()).toBe('closed')
    expect(breaker.getFailureCount()).toBe(0)

    vi.useRealTimers()
  })

  it('should re-open circuit on failed probe in half-open state', async () => {
    vi.useFakeTimers()

    const failOp = async () => {
      throw new Error('fail')
    }

    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failOp)).rejects.toThrow('fail')
    }

    vi.advanceTimersByTime(1100)
    expect(breaker.getState()).toBe('half-open')

    // Failed probe
    await expect(breaker.execute(failOp)).rejects.toThrow('fail')
    expect(breaker.getState()).toBe('open')

    vi.useRealTimers()
  })

  it('should reset failure count on success', async () => {
    const failOp = async () => {
      throw new Error('fail')
    }

    await expect(breaker.execute(failOp)).rejects.toThrow('fail')
    await expect(breaker.execute(failOp)).rejects.toThrow('fail')
    expect(breaker.getFailureCount()).toBe(2)

    // Success resets count
    await breaker.execute(async () => 'ok')
    expect(breaker.getFailureCount()).toBe(0)
    expect(breaker.getState()).toBe('closed')
  })

  it('should support manual reset', async () => {
    const failOp = async () => {
      throw new Error('fail')
    }

    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failOp)).rejects.toThrow('fail')
    }

    expect(breaker.getState()).toBe('open')

    breaker.reset()
    expect(breaker.getState()).toBe('closed')
    expect(breaker.getFailureCount()).toBe(0)
  })
})

describe('getCircuitBreaker', () => {
  it('should return same instance for same key', () => {
    const a = getCircuitBreaker('test-provider-a')
    const b = getCircuitBreaker('test-provider-a')
    expect(a).toBe(b)
  })

  it('should return different instances for different keys', () => {
    const a = getCircuitBreaker('test-provider-x')
    const b = getCircuitBreaker('test-provider-y')
    expect(a).not.toBe(b)
  })
})
