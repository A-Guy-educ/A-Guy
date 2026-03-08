/**
 * Circuit Breaker for LLM API Calls
 *
 * Prevents cascading failures when an LLM provider goes down.
 * After N consecutive failures, the circuit opens and fails fast
 * for a cooldown period before allowing a single probe request.
 *
 * @fileType utility
 * @domain ai
 * @pattern circuit-breaker, resilience
 */

export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold?: number
  /** How long (ms) the circuit stays open before allowing a probe */
  cooldownMs?: number
  /** Optional name for logging */
  name?: string
}

export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failureCount = 0
  private lastFailureTime = 0
  private readonly failureThreshold: number
  private readonly cooldownMs: number
  private readonly name: string

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5
    this.cooldownMs = options.cooldownMs ?? 60_000
    this.name = options.name ?? 'LLM'
  }

  /**
   * Execute an operation through the circuit breaker.
   * Throws CircuitOpenError if the circuit is open.
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new CircuitOpenError(
        `${this.name} circuit breaker is open. AI service temporarily unavailable. ` +
          `Try again in ${Math.ceil(this.remainingCooldownMs() / 1000)}s.`,
      )
    }

    const _isProbe = this.state === 'half-open'

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  /**
   * Check if the circuit is currently blocking requests
   */
  private isOpen(): boolean {
    if (this.state === 'closed') return false

    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureTime
      if (elapsed >= this.cooldownMs) {
        this.state = 'half-open'
        return false
      }
      return true
    }

    // half-open: allow one probe
    return false
  }

  private remainingCooldownMs(): number {
    if (this.state !== 'open') return 0
    const elapsed = Date.now() - this.lastFailureTime
    return Math.max(0, this.cooldownMs - elapsed)
  }

  private onSuccess(): void {
    this.failureCount = 0
    this.state = 'closed'
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.failureCount >= this.failureThreshold || this.state === 'half-open') {
      this.state = 'open'
    }
  }

  /** Get current circuit state (for monitoring/logging) */
  getState(): CircuitState {
    // Re-evaluate in case cooldown expired
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureTime
      if (elapsed >= this.cooldownMs) {
        this.state = 'half-open'
      }
    }
    return this.state
  }

  /** Get current failure count */
  getFailureCount(): number {
    return this.failureCount
  }

  /** Reset the circuit breaker to closed state */
  reset(): void {
    this.state = 'closed'
    this.failureCount = 0
    this.lastFailureTime = 0
  }
}

/**
 * Error thrown when the circuit is open
 */
export class CircuitOpenError extends Error {
  readonly code = 'CIRCUIT_OPEN'

  constructor(message: string) {
    super(message)
    this.name = 'CircuitOpenError'
  }
}

/**
 * Singleton circuit breakers per provider
 */
const circuitBreakers = new Map<string, CircuitBreaker>()

/**
 * Get or create a circuit breaker for a given provider key
 */
export function getCircuitBreaker(
  providerKey: string,
  options?: CircuitBreakerOptions,
): CircuitBreaker {
  let breaker = circuitBreakers.get(providerKey)
  if (!breaker) {
    breaker = new CircuitBreaker({ name: providerKey, ...options })
    circuitBreakers.set(providerKey, breaker)
  }
  return breaker
}
