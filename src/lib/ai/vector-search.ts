/**
 * Vector Search Service
 * Retrieves memory items using MongoDB Atlas Vector Search
 *
 * Key Features:
 * - Prefer-local policy (conversation-scoped first, then user-global)
 * - Tenant isolation (CRITICAL: always filter by userId)
 * - Graceful fallback on errors
 * - Deduplication of results
 */

import { logger } from '@/utilities/logger'
import type { Db } from 'mongodb'
import { ChatRole } from './chat-message-role'
import { generateEmbedding } from './embeddings'

const VECTOR_INDEX_NAME = 'memory_items_embedding_v1'
const NUM_CANDIDATES = 200
const TOP_K_LOCAL = 4
const TOP_K_GLOBAL = 4

export interface MemoryItem {
  _id: string
  userId: string
  conversationId?: string
  type: string
  text: string
  importance: number
  status: string
  source: {
    sourceConversationId?: string
    sourceMessageTimestamp: Date
    sourceMessageRole: ChatRole
  }
  createdAt: Date
  updatedAt: Date
}

export interface RetrievalResult {
  items: MemoryItem[]
  localCount: number
  globalCount: number
  latencyMs: number
}

/**
 * Retrieve relevant memory items for a user query
 * Implements prefer-local policy: 4 conversation-scoped + 4 global
 *
 * SECURITY: ALWAYS filters by userId for tenant isolation
 */
export async function retrieveMemoryItems(
  db: Db,
  userId: string,
  queryText: string,
  conversationId?: string,
): Promise<RetrievalResult> {
  const startTime = Date.now()

  try {
    // Generate query embedding (must happen first)
    const { embedding: queryVector } = await generateEmbedding(queryText)

    const collection = db.collection<MemoryItem>('memory_items')
    const results: MemoryItem[] = []
    let localCount = 0
    let globalCount = 0

    // Prepare both queries
    const localQuery = conversationId
      ? collection
          .aggregate([
            {
              $vectorSearch: {
                index: VECTOR_INDEX_NAME,
                path: 'embedding',
                queryVector,
                numCandidates: NUM_CANDIDATES,
                limit: TOP_K_LOCAL,
                filter: {
                  userId: { $eq: userId },
                  conversationId: { $eq: conversationId },
                  status: { $eq: 'active' },
                },
              },
            },
            {
              $project: {
                embedding: 0, // Don't return embeddings (large)
                score: { $meta: 'vectorSearchScore' },
              },
            },
          ])
          .toArray()
      : Promise.resolve([])

    const globalQuery = collection
      .aggregate([
        {
          $vectorSearch: {
            index: VECTOR_INDEX_NAME,
            path: 'embedding',
            queryVector,
            numCandidates: NUM_CANDIDATES,
            limit: TOP_K_GLOBAL,
            filter: {
              userId: { $eq: userId },
              status: { $eq: 'active' },
            },
          },
        },
        {
          $project: {
            embedding: 0,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ])
      .toArray()

    // Execute both queries in parallel
    const [localResults, globalResults] = await Promise.all([localQuery, globalQuery])

    // Process results
    results.push(...(localResults as MemoryItem[]))
    localCount = localResults.length

    // Deduplicate: prefer local results over global
    const seenIds = new Set(results.map((r) => r._id.toString()))
    for (const item of globalResults as MemoryItem[]) {
      if (!seenIds.has(item._id.toString())) {
        results.push(item)
        globalCount++
      }
    }

    // Enforce total limit
    const finalResults = results.slice(0, TOP_K_LOCAL + TOP_K_GLOBAL)

    const latencyMs = Date.now() - startTime

    logger.info(
      {
        userId,
        conversationId,
        localCount,
        globalCount,
        totalCount: finalResults.length,
        latencyMs,
      },
      '[VectorSearch] Retrieved memories',
    )

    return {
      items: finalResults,
      localCount,
      globalCount,
      latencyMs,
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    logger.error({ err: error, latencyMs }, '[VectorSearch] Retrieval failed')

    // Fallback: return empty (system continues without memory)
    return {
      items: [],
      localCount: 0,
      globalCount: 0,
      latencyMs,
    }
  }
}

/**
 * Find similar memory items (for deduplication during extraction)
 * Returns the most similar item if similarity >= threshold
 *
 * SECURITY: ALWAYS filters by userId
 */
export async function findSimilarMemoryItem(
  db: Db,
  userId: string,
  queryEmbedding: number[],
  similarityThreshold: number = 0.9,
): Promise<MemoryItem | null> {
  try {
    const collection = db.collection<MemoryItem>('memory_items')

    const results = await collection
      .aggregate([
        {
          $vectorSearch: {
            index: VECTOR_INDEX_NAME,
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 50,
            limit: 1,
            filter: {
              userId: { $eq: userId },
              status: { $eq: 'active' },
            },
          },
        },
        {
          $project: {
            embedding: 0,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ])
      .toArray()

    if (results.length === 0) {
      return null
    }

    const topResult = results[0] as MemoryItem & { score: number }

    // Check if similarity meets threshold
    if (topResult.score >= similarityThreshold) {
      return topResult
    }

    return null
  } catch (error) {
    logger.error({ err: error }, '[VectorSearch] Similar item search failed')
    return null
  }
}
