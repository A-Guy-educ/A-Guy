/**
 * Vector Index Runtime Guardrails
 *
 * Ensures the MongoDB Atlas vector search index exists and is ready
 * before allowing memory retrieval operations.
 *
 * Strategy: Fail fast in production if index is missing
 */

import { logger } from '@/utilities/logger'
import type { Db } from 'mongodb'

const INDEX_NAME = 'memory_items_embedding_v1'
const COLLECTION_NAME = 'memory_items'

interface IndexCheckResult {
  exists: boolean
  ready: boolean
  error?: string
}

/**
 * Check if the vector search index exists and is ready
 * This is a runtime safety check to prevent silent failures
 */
export async function checkVectorIndexReady(db: Db): Promise<IndexCheckResult> {
  try {
    // List all search indexes on the collection
    const collection = db.collection(COLLECTION_NAME)

    // MongoDB Atlas provides listSearchIndexes() method
    const indexes = await collection.listSearchIndexes().toArray()

    // Find our specific vector index
    // Type is from MongoDB Atlas API which doesn't have TypeScript definitions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vectorIndex = indexes.find((idx: any) => idx.name === INDEX_NAME) as
      | { name: string; status?: string; queryable?: boolean }
      | undefined

    if (!vectorIndex) {
      return {
        exists: false,
        ready: false,
        error: `Vector search index "${INDEX_NAME}" not found on collection "${COLLECTION_NAME}"`,
      }
    }

    // Check if index is ready (not building/failed)
    const status = vectorIndex.status || vectorIndex.queryable
    const isReady = status === 'READY' || status === true

    if (!isReady) {
      return {
        exists: true,
        ready: false,
        error: `Vector search index "${INDEX_NAME}" exists but is not ready (status: ${status})`,
      }
    }

    return {
      exists: true,
      ready: true,
    }
  } catch (error) {
    // If listSearchIndexes fails, it might be because:
    // 1. Not using MongoDB Atlas
    // 2. Atlas cluster tier doesn't support search indexes (< M10)
    // 3. Network/auth issues

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return {
      exists: false,
      ready: false,
      error: `Failed to check vector index: ${errorMessage}`,
    }
  }
}

/**
 * Enforce vector index requirement
 *
 * Fails fast if index is missing or not ready.
 * This prevents silent degradation and makes the problem obvious.
 */
export async function enforceVectorIndexRequirement(db: Db): Promise<void> {
  const result = await checkVectorIndexReady(db)

  if (!result.ready) {
    const errorMsg = [
      '❌ MEMORY RETRIEVAL STARTUP CHECK FAILED',
      '',
      'Vector search index is not ready',
      '',
      `Error: ${result.error}`,
      '',
      'Required index configuration:',
      `  - Collection: ${COLLECTION_NAME}`,
      `  - Index name: ${INDEX_NAME}`,
      '  - Type: vectorSearch',
      '  - Vector path: embedding',
      '  - Dimensions: 1536',
      '  - Similarity: cosine',
      '  - Filter fields: userId, conversationId, status',
      '',
      'To fix:',
      '  1. Create the index manually in MongoDB Atlas UI',
      '  2. Use the definition in: infra/atlas/vector-index.memory_items.v1.json',
      '  3. Wait for index to reach READY status (5-10 minutes)',
      '',
      'MongoDB Atlas M10+ cluster is required for vector search.',
    ].join('\n')

    logger.error(errorMsg)

    // Fail fast: refuse to start
    throw new Error(
      'Vector search index not ready. See logs for details. Create the index in Atlas UI.',
    )
  }

  logger.info(
    {
      indexName: INDEX_NAME,
      collection: COLLECTION_NAME,
      status: 'READY',
    },
    '✅ Vector search index ready',
  )
}

interface IndexCacheEntry {
  ready: boolean
  timestamp: number
  error?: string
}

let indexCache: IndexCacheEntry | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Graceful check for runtime - returns boolean instead of throwing
 * Use this in request handlers to handle missing index gracefully
 * Caches result for 5 minutes to avoid expensive Atlas API calls
 */
export async function isVectorIndexAvailable(db: Db): Promise<boolean> {
  const now = Date.now()

  // Return cached result if still valid
  if (indexCache && now - indexCache.timestamp < CACHE_TTL_MS) {
    if (!indexCache.ready) {
      logger.debug({ cached: true, error: indexCache.error }, 'Vector index not available (cached)')
    }
    return indexCache.ready
  }

  // Check index and cache result
  const result = await checkVectorIndexReady(db)

  indexCache = {
    ready: result.ready,
    timestamp: now,
    error: result.error,
  }

  if (!result.ready) {
    logger.warn(
      {
        error: result.error,
        indexName: INDEX_NAME,
      },
      'Vector search index not available, memory retrieval will be skipped',
    )
  }

  return result.ready
}

/**
 * Invalidate the index cache (useful for testing or manual refresh)
 */
export function invalidateIndexCache(): void {
  indexCache = null
}
