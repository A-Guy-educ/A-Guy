/**
 * Extraction Cache
 * In-memory cache for AI extraction results to avoid duplicate API calls
 *
 * Cache Strategy:
 * - Key: File hash (SHA-256 of file content)
 * - TTL: 1 hour (3600 seconds)
 * - Storage: In-memory Map (simple, no Redis dependency)
 *
 * Future: Can be migrated to Redis for multi-instance deployments
 */

import { createHash } from 'crypto'
import { logger } from '@/utilities/logger'

interface CacheEntry {
  structuredContent: string
  timestamp: number
}

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const cache = new Map<string, CacheEntry>()

/**
 * Generate cache key from file buffer (SHA-256 hash)
 */
export function getFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer as any).digest('hex')
}

/**
 * Get cached extraction result if available and not expired
 */
export function getCachedExtraction(fileHash: string): string | null {
  const entry = cache.get(fileHash)

  if (!entry) {
    return null
  }

  const age = Date.now() - entry.timestamp
  if (age > CACHE_TTL_MS) {
    cache.delete(fileHash)
    logger.debug({ fileHash, ageMs: age }, 'Cache entry expired')
    return null
  }

  logger.debug({ fileHash, ageMs: age }, 'Cache hit')
  return entry.structuredContent
}

/**
 * Store extraction result in cache
 */
export function setCachedExtraction(fileHash: string, structuredContent: string): void {
  cache.set(fileHash, {
    structuredContent,
    timestamp: Date.now(),
  })
  logger.debug({ fileHash }, 'Cache entry stored')
}

/**
 * Clear expired entries (can be called periodically)
 */
export function clearExpiredEntries(): number {
  const now = Date.now()
  let cleared = 0

  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      cache.delete(key)
      cleared++
    }
  }

  if (cleared > 0) {
    logger.debug({ cleared }, 'Cleared expired cache entries')
  }

  return cleared
}

/**
 * Clear all cache entries (for testing)
 */
export function clearCache(): void {
  cache.clear()
  logger.debug('Cache cleared')
}

/**
 * Get cache statistics (for monitoring)
 */
export function getCacheStats(): { size: number; entries: Array<{ key: string; ageMs: number }> } {
  const now = Date.now()
  const entries = Array.from(cache.entries()).map(([key, entry]) => ({
    key,
    ageMs: now - entry.timestamp,
  }))

  return {
    size: cache.size,
    entries,
  }
}
