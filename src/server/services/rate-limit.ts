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
  logger.info('All rate limits cleared')
}
