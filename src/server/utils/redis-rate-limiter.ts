/**
 * Redis Rate Limiter Utility
 * Uses Vercel KV (Redis) for distributed rate limiting across serverless instances
 */

import { kv } from '@vercel/kv'

interface RedisRateLimitEntry {
  count: number
  resetAt: number
}

export function createRedisSlidingWindowLimiter(config: {
  windowMs: number
  maxRequests: number
  prefix: string
}): {
  check: (key: string) => Promise<boolean>
  getRemaining: (key: string) => Promise<number>
  reset: (key: string) => Promise<void>
} {
  const { windowMs, maxRequests, prefix } = config

  return {
    check: async (key: string): Promise<boolean> => {
      const now = Date.now()
      const fullKey = `${prefix}:ratelimit:${key}`

      try {
        const entry = await kv.get<RedisRateLimitEntry>(fullKey)

        if (!entry) {
          await kv.set(fullKey, { count: 1, resetAt: now + windowMs })
          return true
        }

        if (now >= entry.resetAt) {
          await kv.set(fullKey, { count: 1, resetAt: now + windowMs })
          return true
        }

        if (entry.count >= maxRequests) {
          return false
        }

        await kv.set(fullKey, { count: entry.count + 1, resetAt: entry.resetAt })
        return true
      } catch {
        return true
      }
    },

    getRemaining: async (key: string): Promise<number> => {
      const now = Date.now()
      const fullKey = `${prefix}:ratelimit:${key}`

      try {
        const entry = await kv.get<RedisRateLimitEntry>(fullKey)

        if (!entry || now >= entry.resetAt) {
          return maxRequests
        }

        return Math.max(0, maxRequests - entry.count)
      } catch {
        return maxRequests
      }
    },

    reset: async (key: string): Promise<void> => {
      const fullKey = `${prefix}:ratelimit:${key}`
      await kv.del(fullKey)
    },
  }
}

export const TOKEN_ROUTE_LIMITER = createRedisSlidingWindowLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  prefix: 'chat-assets',
})

export const FINALIZE_ROUTE_LIMITER = createRedisSlidingWindowLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  prefix: 'chat-assets',
})
