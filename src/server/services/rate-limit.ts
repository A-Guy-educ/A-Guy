/**
 * Rate Limiting Service for Guest Sessions
 *
 * Provides in-memory rate limiting for anonymous users based on IP and User-Agent hash.
 * Uses a sliding window algorithm with TTL-based cleanup.
 *
 * Security:
 * - Uses IP hash and User-Agent hash for fingerprinting
 * - Sliding window prevents burst attacks
 * - Memory cleanup via periodic TTL expiration
 */
import { logger } from '@/infra/utils/logger'
import { getGuestChatConfig } from '@/server/config/guest-chat-config'

interface RateLimitEntry {
  count: number
  windowStart: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

const rateLimitCache = new Map<string, RateLimitEntry>()
const CLEANUP_INTERVAL_MS = 60 * 1000 // Cleanup every minute
let lastCleanup = Date.now()

/**
 * Get a rate limit key combining IP hash and User-Agent hash
 */
export function getRateLimitKey(ipHash: string, userAgentHash: string): string {
  return `${ipHash}:${userAgentHash}`
}

/**
 * Check if a request is within rate limits
 */
export async function checkRateLimit(
  ipHash: string,
  userAgentHash: string,
  maxRequests?: number,
  windowMs?: number,
): Promise<RateLimitResult> {
  if (maxRequests === undefined || windowMs === undefined) {
    const guestConfig = await getGuestChatConfig()
    maxRequests = maxRequests ?? guestConfig.rate_limit_max_requests
    windowMs = windowMs ?? guestConfig.rate_limit_window_ms
  }

  const key = getRateLimitKey(ipHash, userAgentHash)
  const now = Date.now()

  // Periodic cleanup of expired entries
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    await cleanupExpiredEntries(now, windowMs)
    lastCleanup = now
  }

  const entry = rateLimitCache.get(key)

  if (!entry) {
    // First request in window
    rateLimitCache.set(key, {
      count: 1,
      windowStart: now,
    })
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    }
  }

  // Check if window has expired
  if (now - entry.windowStart > windowMs) {
    // Reset the window
    rateLimitCache.set(key, {
      count: 1,
      windowStart: now,
    })
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    }
  }

  // Check if rate limited
  if (entry.count >= maxRequests) {
    logger.debug(
      { key: key.substring(0, 20) + '...', count: entry.count, maxRequests },
      'Rate limit exceeded',
    )
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowStart + windowMs,
    }
  }

  // Increment count
  entry.count++
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.windowStart + windowMs,
  }
}

/**
 * Get remaining requests for a key without incrementing
 */
export async function getRemainingRequests(
  ipHash: string,
  userAgentHash: string,
  maxRequests?: number,
  windowMs?: number,
): Promise<RateLimitResult> {
  if (maxRequests === undefined || windowMs === undefined) {
    const guestConfig = await getGuestChatConfig()
    maxRequests = maxRequests ?? guestConfig.rate_limit_max_requests
    windowMs = windowMs ?? guestConfig.rate_limit_window_ms
  }

  const key = getRateLimitKey(ipHash, userAgentHash)
  const now = Date.now()

  const entry = rateLimitCache.get(key)

  if (!entry || now - entry.windowStart > windowMs) {
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: now + windowMs,
    }
  }

  return {
    allowed: entry.count < maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.windowStart + windowMs,
  }
}

/**
 * Reset rate limit for a key (useful after successful auth)
 */
export function resetRateLimit(ipHash: string, userAgentHash: string): void {
  const key = getRateLimitKey(ipHash, userAgentHash)
  rateLimitCache.delete(key)
}

/**
 * Cleanup expired entries from the cache
 */
async function cleanupExpiredEntries(now: number, windowMs: number): Promise<void> {
  let cleaned = 0

  for (const [key, entry] of rateLimitCache.entries()) {
    if (now - entry.windowStart > windowMs) {
      rateLimitCache.delete(key)
      cleaned++
    }
  }

  if (cleaned > 0) {
    logger.debug(
      { cleanedEntries: cleaned, remainingEntries: rateLimitCache.size },
      'Rate limit cache cleaned',
    )
  }
}

/**
 * Get current cache statistics
 */
export async function getRateLimitStats(): Promise<{
  size: number
  maxRequests: number
  windowMs: number
}> {
  const guestConfig = await getGuestChatConfig()
  return {
    size: rateLimitCache.size,
    maxRequests: guestConfig.rate_limit_max_requests,
    windowMs: guestConfig.rate_limit_window_ms,
  }
}

/**
 * Clear all rate limits (admin use only)
 */
export function clearAllRateLimits(): void {
  rateLimitCache.clear()
  authenticatedRateLimitCache.clear()
  logger.info('All rate limits cleared')
}

// ============================================================
// Authenticated User Rate Limiting
// ============================================================
// Note: In-memory rate limiting has limitations in serverless environments
// (each instance has its own cache). For stricter enforcement, consider
// using a shared store (Redis, MongoDB) in the future.

interface AuthenticatedRateLimitConfig {
  /** Max requests per window */
  maxRequests: number
  /** Window duration in milliseconds */
  windowMs: number
}

/**
 * Default rate limits for authenticated endpoints.
 * LLM endpoints have stricter limits due to API cost.
 */
export const RATE_LIMIT_PRESETS = {
  /** Standard API endpoints: 60 requests per minute */
  standard: { maxRequests: 60, windowMs: 60_000 } as AuthenticatedRateLimitConfig,
  /** LLM chat endpoints: 20 requests per minute (cost-sensitive) */
  llmChat: { maxRequests: 20, windowMs: 60_000 } as AuthenticatedRateLimitConfig,
  /** LLM streaming endpoints: 10 requests per minute */
  llmStream: { maxRequests: 10, windowMs: 60_000 } as AuthenticatedRateLimitConfig,
} as const

const authenticatedRateLimitCache = new Map<string, RateLimitEntry>()

/**
 * Check rate limit for an authenticated user by user ID.
 * Returns rate limit result with Retry-After compatible resetAt.
 */
export function checkAuthenticatedRateLimit(
  userId: string,
  endpoint: string,
  config: AuthenticatedRateLimitConfig,
): RateLimitResult {
  const key = `auth:${userId}:${endpoint}`
  const now = Date.now()

  const entry = authenticatedRateLimitCache.get(key)

  if (!entry || now - entry.windowStart > config.windowMs) {
    authenticatedRateLimitCache.set(key, { count: 1, windowStart: now })
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    }
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowStart + config.windowMs,
    }
  }

  entry.count++
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.windowStart + config.windowMs,
  }
}

/**
 * Apply rate limit headers to a Response.
 * Adds X-RateLimit-* and Retry-After headers.
 */
export function applyRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult,
  maxRequests: number,
): void {
  headers.set('X-RateLimit-Limit', String(maxRequests))
  headers.set('X-RateLimit-Remaining', String(result.remaining))
  headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)))

  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil((result.resetAt - Date.now()) / 1000)
    headers.set('Retry-After', String(Math.max(1, retryAfterSeconds)))
  }
}
