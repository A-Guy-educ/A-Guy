import { describe, expect, it, beforeEach } from 'vitest'
import {
  checkAuthenticatedRateLimit,
  applyRateLimitHeaders,
  clearAllRateLimits,
  RATE_LIMIT_PRESETS,
} from '@/server/services/rate-limit'

describe('Authenticated Rate Limiting', () => {
  beforeEach(() => {
    clearAllRateLimits()
  })

  describe('checkAuthenticatedRateLimit', () => {
    const config = { maxRequests: 3, windowMs: 60_000 }

    it('should allow first request', () => {
      const result = checkAuthenticatedRateLimit('user-1', '/api/chat', config)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2)
    })

    it('should track requests per user', () => {
      checkAuthenticatedRateLimit('user-1', '/api/chat', config)
      checkAuthenticatedRateLimit('user-1', '/api/chat', config)
      const result = checkAuthenticatedRateLimit('user-1', '/api/chat', config)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(0)
    })

    it('should block after exceeding limit', () => {
      for (let i = 0; i < 3; i++) {
        checkAuthenticatedRateLimit('user-1', '/api/chat', config)
      }

      const result = checkAuthenticatedRateLimit('user-1', '/api/chat', config)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should isolate users', () => {
      for (let i = 0; i < 3; i++) {
        checkAuthenticatedRateLimit('user-1', '/api/chat', config)
      }

      // user-2 should still be allowed
      const result = checkAuthenticatedRateLimit('user-2', '/api/chat', config)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2)
    })

    it('should isolate endpoints', () => {
      for (let i = 0; i < 3; i++) {
        checkAuthenticatedRateLimit('user-1', '/api/chat', config)
      }

      // Same user, different endpoint should be allowed
      const result = checkAuthenticatedRateLimit('user-1', '/api/study-plan', config)
      expect(result.allowed).toBe(true)
    })

    it('should include resetAt timestamp', () => {
      const before = Date.now()
      const result = checkAuthenticatedRateLimit('user-1', '/api/chat', config)
      const after = Date.now()

      expect(result.resetAt).toBeGreaterThanOrEqual(before + config.windowMs)
      expect(result.resetAt).toBeLessThanOrEqual(after + config.windowMs)
    })
  })

  describe('RATE_LIMIT_PRESETS', () => {
    it('should have standard preset', () => {
      expect(RATE_LIMIT_PRESETS.standard.maxRequests).toBe(60)
      expect(RATE_LIMIT_PRESETS.standard.windowMs).toBe(60_000)
    })

    it('should have stricter LLM presets', () => {
      expect(RATE_LIMIT_PRESETS.llmChat.maxRequests).toBeLessThan(
        RATE_LIMIT_PRESETS.standard.maxRequests,
      )
      expect(RATE_LIMIT_PRESETS.llmStream.maxRequests).toBeLessThan(
        RATE_LIMIT_PRESETS.llmChat.maxRequests,
      )
    })
  })

  describe('applyRateLimitHeaders', () => {
    it('should set rate limit headers', () => {
      const headers = new Headers()
      const result = { allowed: true, remaining: 5, resetAt: Date.now() + 60000 }

      applyRateLimitHeaders(headers, result, 10)

      expect(headers.get('X-RateLimit-Limit')).toBe('10')
      expect(headers.get('X-RateLimit-Remaining')).toBe('5')
      expect(headers.get('X-RateLimit-Reset')).toBeTruthy()
      expect(headers.get('Retry-After')).toBeNull()
    })

    it('should set Retry-After when rate limited', () => {
      const headers = new Headers()
      const result = { allowed: false, remaining: 0, resetAt: Date.now() + 30000 }

      applyRateLimitHeaders(headers, result, 10)

      expect(headers.get('Retry-After')).toBeTruthy()
      const retryAfter = Number(headers.get('Retry-After'))
      expect(retryAfter).toBeGreaterThan(0)
      expect(retryAfter).toBeLessThanOrEqual(30)
    })
  })
})
