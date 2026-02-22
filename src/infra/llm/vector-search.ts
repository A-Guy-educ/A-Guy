/**
 * Vector Search Service
 * Retrieves memory items using MongoDB Atlas Vector Search
 *
 * Key Features:
 * - Context-hierarchy policy (conversation → contextKey → parent keys → user-global)
 * - Tenant isolation (CRITICAL: always filter by userId)
 * - Graceful fallback on errors
 * - Deduplication of results with hierarchy priority
 *
 * @fileType service
 * @domain ai
 * @pattern vector-search, context-scoped
 */

import { logger } from '@/infra/utils/logger'
import { MongooseAdapter } from '@payloadcms/db-mongodb'
import type { Db } from 'mongodb'
import { Payload } from 'payload'
import { buildContextHierarchy } from '../../server/services/conversation-service'
import { ChatRole } from './chat-message-role'
import { generateEmbedding } from './embeddings'

const VECTOR_INDEX_NAME = 'memory_items_embedding_v1'
const NUM_CANDIDATES = 200
const TOP_K_TOTAL = 8

export interface MemoryItem {
  _id: string
  userId: string
  conversationId?: string
  contextKey?: string
  contextLevel?: string
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
  contextCount: number
  parentCount: number
  globalCount: number
  hierarchyKeys: string[]
  latencyMs: number
}

/**
 * Retrieve relevant memory items for a user query
 * Implements context-hierarchy policy:
 * 1. Conversation-scoped (conversationId match)
 * 2. Context-scoped (contextKey match)
 * 3. Parent contexts (lesson > chapter > course)
 * 4. User-global (userId match only)
 *
 * SECURITY: ALWAYS filters by userId for tenant isolation
 */
export async function retrieveMemoryItems(
  db: Db,
  userId: string,
  queryText: string,
  conversationId?: string,
  contextKey?: string,
  payload?: Payload,
): Promise<RetrievalResult> {
  const startTime = Date.now()

  try {
    // Generate query embedding (must happen first)
    const { embedding: queryVector } = await generateEmbedding(queryText)

    const collection = db.collection<MemoryItem>('memory_items')
    const results: MemoryItem[] = []
    let localCount = 0
    let contextCount = 0
    const _parentCount = 0 // Unused, calculated as contextCount - localCount if needed
    let globalCount = 0

    // Build hierarchy keys if contextKey is provided and payload is available
    let hierarchyKeys: string[] = []
    if (contextKey && payload) {
      hierarchyKeys = await buildContextHierarchy(contextKey, payload)
    } else if (contextKey) {
      // Fallback: just use the contextKey and 'global'
      hierarchyKeys = [contextKey, 'global']
    } else {
      hierarchyKeys = ['global']
    }

    logger.debug(
      { userId, conversationId, contextKey, hierarchyKeys },
      '[VectorSearch] Building retrieval queries',
    )

    // Prepare queries
    const queries: Promise<{ items: MemoryItem[]; count: number; scope: string }>[] = []

    // 1. Conversation-scoped query
    if (conversationId) {
      queries.push(
        (async () => {
          const convResults = await collection
            .aggregate([
              {
                $vectorSearch: {
                  index: VECTOR_INDEX_NAME,
                  path: 'embedding',
                  queryVector,
                  numCandidates: NUM_CANDIDATES,
                  limit: 4,
                  filter: {
                    userId: { $eq: userId },
                    conversationId: { $eq: conversationId },
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
          return {
            items: convResults as MemoryItem[],
            count: convResults.length,
            scope: 'conversation',
          }
        })(),
      )
    }

    // 2. Context-hierarchy query (contextKey + parent keys)
    if (hierarchyKeys.length > 0) {
      queries.push(
        (async () => {
          const ctxResults = await collection
            .aggregate([
              {
                $vectorSearch: {
                  index: VECTOR_INDEX_NAME,
                  path: 'embedding',
                  queryVector,
                  numCandidates: NUM_CANDIDATES,
                  limit: TOP_K_TOTAL * 2,
                  filter: {
                    userId: { $eq: userId },
                    contextKey: { $in: hierarchyKeys },
                    status: { $eq: 'active' },
                  },
                },
              },
              {
                $project: {
                  _id: 1,
                  userId: 1,
                  conversationId: 1,
                  contextKey: 1,
                  contextLevel: 1,
                  type: 1,
                  text: 1,
                  importance: 1,
                  status: 1,
                  source: 1,
                  createdAt: 1,
                  updatedAt: 1,
                  score: { $meta: 'vectorSearchScore' },
                },
              },
            ])
            .toArray()

          // Sort by hierarchy priority in JavaScript (narrower context first)
          const sortedResults = (ctxResults as MemoryItem[]).sort((a, b) => {
            const aIndex = a.contextKey ? hierarchyKeys.indexOf(a.contextKey) : Infinity
            const bIndex = b.contextKey ? hierarchyKeys.indexOf(b.contextKey) : Infinity
            // Prefer lower index (more specific context), then higher score
            if (aIndex !== bIndex) return aIndex - bIndex
            return 0 // Keep original order for same context level
          })

          return { items: sortedResults, count: sortedResults.length, scope: 'context' }
        })(),
      )
    }

    // 3. User-global query (contextKey = 'global' or missing)
    // Note: MongoDB Atlas Vector Search filters support $in but not $or or $exists
    // For missing contextKey, we rely on the context-hierarchy query or ensure contextKey is set
    queries.push(
      (async () => {
        const globalResults = await collection
          .aggregate([
            {
              $vectorSearch: {
                index: VECTOR_INDEX_NAME,
                path: 'embedding',
                queryVector,
                numCandidates: NUM_CANDIDATES,
                limit: 4,
                filter: {
                  userId: { $eq: userId },
                  contextKey: { $eq: 'global' },
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
        return {
          items: globalResults as MemoryItem[],
          count: globalResults.length,
          scope: 'global',
        }
      })(),
    )

    // Execute all queries in parallel (use allSettled so one failure doesn't break all)
    const querySettledResults = await Promise.allSettled(queries)

    // Process results with priority: conversation > context > global
    const seenIds = new Set<string>()

    for (const settledResult of querySettledResults) {
      if (settledResult.status === 'rejected') {
        // Log individual query failures but continue processing other queries
        logger.warn(
          { err: settledResult.reason },
          '[VectorSearch] One query failed, continuing with others',
        )
        continue
      }

      const queryResult = settledResult.value
      for (const item of queryResult.items) {
        const itemId = item._id.toString()
        if (!seenIds.has(itemId)) {
          seenIds.add(itemId)
          results.push(item)

          // Update scope-specific counts
          switch (queryResult.scope) {
            case 'conversation':
              localCount++
              break
            case 'context':
              contextCount++
              break
            case 'global':
              globalCount++
              break
          }
        }
      }
    }

    // Deduplicate across hierarchy levels (prefer narrower scope)
    // Already handled above by the priority order
    const finalResults = results.slice(0, TOP_K_TOTAL)

    const latencyMs = Date.now() - startTime

    logger.info(
      {
        userId,
        conversationId,
        contextKey,
        hierarchyKeys,
        localCount,
        contextCount,
        globalCount,
        totalCount: finalResults.length,
        latencyMs,
      },
      '[VectorSearch] Retrieved memories with hierarchy',
    )

    return {
      items: finalResults,
      localCount,
      contextCount,
      parentCount: contextCount - localCount, // Approximate parent context count
      globalCount,
      hierarchyKeys,
      latencyMs,
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    logger.error({ err: error, latencyMs }, '[VectorSearch] Retrieval failed')

    // Fallback: return empty (system continues without memory)
    return {
      items: [],
      localCount: 0,
      contextCount: 0,
      parentCount: 0,
      globalCount: 0,
      hierarchyKeys: [],
      latencyMs,
    }
  }
}

/**
 * Retrieve memories with context hierarchy using Payload
 * Convenience function that combines payload and db access
 */
export async function retrieveMemoriesWithContext(
  payload: Payload,
  userId: string,
  queryText: string,
  conversationId: string,
  contextKey: string,
): Promise<RetrievalResult> {
  const adapter = payload.db as MongooseAdapter
  const db = adapter.connection.db
  if (!db) {
    throw new Error('Database connection not available')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MongoDB driver version mismatch
  return retrieveMemoryItems(db as any, userId, queryText, conversationId, contextKey, payload)
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
