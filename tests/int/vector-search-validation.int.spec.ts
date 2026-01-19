/**
 * Integration Tests for Vector Search Index Validation
 *
 * Tests actual MongoDB Atlas vector search functionality including:
 * - Index existence and configuration
 * - Vector search operations
 * - Filter enforcement (tenant isolation)
 * - Search quality and relevance
 * - Performance and latency
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- MongoDB cursor results use any type */
import { generateEmbedding } from '@/lib/ai/embeddings'
import { retrieveMemoryItems } from '@/lib/ai/vector-search'
import config from '@payload-config'
import type { Db } from 'mongodb'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// When USE_ATLAS=true, use DATABASE_URL_ATLAS for vector search tests
// This allows tests to connect to the Atlas cluster with vector search enabled
const useAtlas = process.env.USE_ATLAS === 'true'
const atlasDatabaseUrl = process.env.DATABASE_URL_ATLAS

const INDEX_NAME = 'memory_items_embedding_v1'
const COLLECTION_NAME = 'memory_items'

let payload: Payload
let db: Db | undefined
let testUserId: string
let testConversationId: string
let hasVectorSearch: boolean = false

// Helper to check if vector search is available

async function checkVectorSearchAvailable(): Promise<boolean> {
  if (!db) return false

  try {
    const collection = db.collection(COLLECTION_NAME)
    const indexes = await collection.listSearchIndexes().toArray()

    const vectorIndex = indexes.find((idx: any) => (idx as any).name === INDEX_NAME) as
      | {
          name: string
          status?: string
          queryable?: boolean
        }
      | undefined

    return !!vectorIndex && (vectorIndex.status === 'READY' || vectorIndex.queryable === true)
  } catch (error: any) {
    // $listSearchIndexes is only available on MongoDB Atlas
    if (
      error.message?.includes('not supported') ||
      error.message?.includes('SearchNotEnabled') ||
      error.message?.includes('$listSearchIndexes stage is only allowed on MongoDB Atlas')
    ) {
      return false
    }
    throw error
  }
}

// Skip all tests if OPENAI_API_KEY is not set or DATABASE_URL_ATLAS is not configured
// Vector search requires MongoDB Atlas with search enabled
const hasOpenAIKey = !!process.env.OPENAI_API_KEY
const hasAtlasUrl = !!process.env.DATABASE_URL_ATLAS

describe.skipIf(!hasOpenAIKey || !hasAtlasUrl)('Vector Search Validation Integration Tests', () => {
  beforeAll(async () => {
    // When USE_ATLAS is true, we need to temporarily override DATABASE_URL
    // to use the Atlas URL for vector search tests
    if (useAtlas && atlasDatabaseUrl) {
      const originalDbUrl = process.env.DATABASE_URL
      process.env.DATABASE_URL = atlasDatabaseUrl
      payload = await getPayload({ config })
      process.env.DATABASE_URL = originalDbUrl
    } else {
      payload = await getPayload({ config })
    }
    db = (payload.db as any).connection?.db

    if (!db) {
      console.log('⚠️  Database connection not available - skipping all tests')
      return
    }

    // Check if vector search is available
    hasVectorSearch = await checkVectorSearchAvailable()

    if (!hasVectorSearch) {
      console.log('⚠️  Vector search not available - tests will be skipped')
      console.log('   This is expected on local MongoDB or M0 clusters')
      return
    }

    // Create test user
    const user = await payload.create({
      collection: 'users',
      data: {
        email: `test-vector-${Date.now()}@example.com`,
        password: 'test123456',
        role: 'student',
      },
    })
    testUserId = user.id

    // Create test conversation
    const exercises = await payload.find({
      collection: 'exercises',
      limit: 1,
    })

    if (exercises.docs.length > 0) {
      const conversation = await payload.create({
        collection: 'conversations',
        data: {
          user: testUserId,
          contextRef: {
            relationTo: 'exercises',
            value: exercises.docs[0].id,
          },
          messages: [],
          lastMessageAt: new Date().toISOString(),
          contextPolicyVersion: 'v1',
        },
        draft: false,
      })
      testConversationId = conversation.id
    }
  }, 30000)

  afterAll(async () => {
    if (!payload || !hasVectorSearch) return

    // Cleanup test data
    if (testConversationId) {
      await payload.delete({
        collection: 'conversations',
        id: testConversationId,
      })
    }

    // Delete test memory items
    const memories = await payload.find({
      collection: 'memory_items',
      where: { userId: { equals: testUserId } },
    })
    for (const mem of memories.docs) {
      await payload.delete({
        collection: 'memory_items',
        id: mem.id,
      })
    }

    if (testUserId) {
      await payload.delete({
        collection: 'users',
        id: testUserId,
      })
    }
  }, 30000)

  describe('Index Existence and Configuration', () => {
    it('should have vector search index configured', async () => {
      if (!db || !hasVectorSearch) {
        console.log('Skipping: Vector search not available')
        return
      }

      const collection = db.collection(COLLECTION_NAME)
      const indexes = await collection.listSearchIndexes().toArray()

      expect(indexes.length).toBeGreaterThan(0)

      const vectorIndex = indexes.find((idx: any) => idx.name === INDEX_NAME)
      expect(vectorIndex).toBeDefined()
    })

    it('should have correct vector field configuration', async () => {
      if (!db || !hasVectorSearch) {
        console.log('Skipping: Vector search not available')
        return
      }

      const collection = db.collection(COLLECTION_NAME)
      const indexes = await collection.listSearchIndexes().toArray()
      const vectorIndex = indexes.find((idx: any) => idx.name === INDEX_NAME) as any

      expect(vectorIndex).toBeDefined()

      const fields = vectorIndex.latestDefinition?.fields || []
      const vectorField = fields.find((f: any) => f.type === 'vector')

      expect(vectorField).toBeDefined()
      expect(vectorField.path).toBe('embedding')
      expect(vectorField.numDimensions).toBe(1536)
      expect(vectorField.similarity).toBe('cosine')
    })

    it('should have required filter fields configured', async () => {
      if (!db || !hasVectorSearch) {
        console.log('Skipping: Vector search not available')
        return
      }

      const collection = db.collection(COLLECTION_NAME)
      const indexes = await collection.listSearchIndexes().toArray()
      const vectorIndex = indexes.find((idx: any) => idx.name === INDEX_NAME) as any

      const fields = vectorIndex.latestDefinition?.fields || []
      const filterFields = fields.filter((f: any) => f.type === 'filter').map((f: any) => f.path)

      expect(filterFields).toContain('userId')
      expect(filterFields).toContain('conversationId')
      expect(filterFields).toContain('status')
    })

    it('should be in READY status', async () => {
      if (!db || !hasVectorSearch) {
        console.log('Skipping: Vector search not available')
        return
      }

      const collection = db.collection(COLLECTION_NAME)
      const indexes = await collection.listSearchIndexes().toArray()
      const vectorIndex = indexes.find((idx: any) => idx.name === INDEX_NAME) as any

      const status = vectorIndex.status || (vectorIndex.queryable ? 'READY' : 'UNKNOWN')
      expect(status === 'READY' || vectorIndex.queryable === true).toBe(true)
    })
  })

  describe('Vector Search Operations', () => {
    let memoryId1: string
    let memoryId2: string
    let memoryId3: string

    beforeAll(async () => {
      if (!payload || !hasVectorSearch || !testUserId || !testConversationId) {
        return
      }

      // Create test memories with different content
      // Note: contextKey is set to 'global' so they can be found by global query
      // In real usage, contextKey would be set based on the conversation context
      const embedding1 = await generateEmbedding('User prefers TypeScript for type safety')
      const memory1 = await payload.create({
        collection: 'memory_items',
        data: {
          userId: testUserId,
          conversationId: testConversationId,
          contextKey: 'global',
          text: 'User prefers TypeScript for type safety',
          type: 'preference',
          importance: 4,
          embedding: embedding1.embedding,
          source: {
            sourceMessageTimestamp: new Date().toISOString(),
            sourceMessageRole: 'user',
          },
          status: 'active',
        },
      })
      memoryId1 = memory1.id

      const embedding2 = await generateEmbedding('User enjoys functional programming patterns')
      const memory2 = await payload.create({
        collection: 'memory_items',
        data: {
          userId: testUserId,
          conversationId: testConversationId,
          contextKey: 'global',
          text: 'User enjoys functional programming patterns',
          type: 'preference',
          importance: 3,
          embedding: embedding2.embedding,
          source: {
            sourceMessageTimestamp: new Date().toISOString(),
            sourceMessageRole: 'user',
          },
          status: 'active',
        },
      })
      memoryId2 = memory2.id

      const embedding3 = await generateEmbedding('User is learning about databases')
      const memory3 = await payload.create({
        collection: 'memory_items',
        data: {
          userId: testUserId,
          conversationId: testConversationId,
          contextKey: 'global',
          text: 'User is learning about databases',
          type: 'fact',
          importance: 3,
          embedding: embedding3.embedding,
          source: {
            sourceMessageTimestamp: new Date().toISOString(),
            sourceMessageRole: 'user',
          },
          status: 'active',
        },
      })
      memoryId3 = memory3.id

      // Wait for vector search index to update (can take 10-30 seconds on Atlas)
      // Poll until documents are searchable or timeout after 60 seconds
      if (db && testUserId && testConversationId) {
        const maxWaitTime = 60000 // 60 seconds
        const pollInterval = 2000 // 2 seconds
        const startTime = Date.now()

        while (Date.now() - startTime < maxWaitTime) {
          // Try a simple search to see if documents are indexed
          const testResult = await retrieveMemoryItems(
            db,
            testUserId,
            'TypeScript',
            testConversationId,
          )

          if (testResult.items.length > 0) {
            // Documents are indexed, we can proceed
            break
          }

          // Wait before next poll
          await new Promise((resolve) => setTimeout(resolve, pollInterval))
        }

        // Additional short wait to ensure all documents are fully indexed
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } else {
        // Fallback: wait a fixed amount if polling isn't possible
        await new Promise((resolve) => setTimeout(resolve, 10000))
      }
    }, 120000)

    afterAll(async () => {
      if (!payload || !hasVectorSearch) return

      // Cleanup test memories
      if (memoryId1) await payload.delete({ collection: 'memory_items', id: memoryId1 })
      if (memoryId2) await payload.delete({ collection: 'memory_items', id: memoryId2 })
      if (memoryId3) await payload.delete({ collection: 'memory_items', id: memoryId3 })
    })

    it('should perform semantic search and return relevant results', async () => {
      if (!db || !hasVectorSearch || !testUserId || !testConversationId) {
        console.log('Skipping: Vector search not available or test data missing')
        return
      }

      const result = await retrieveMemoryItems(
        db,
        testUserId,
        'programming languages with static typing',
        testConversationId,
      )

      expect(result).toBeDefined()
      expect(result.items.length).toBeGreaterThan(0)
      expect(result.latencyMs).toBeGreaterThan(0)

      // Should find TypeScript-related memory
      const hasTypescriptMemory = result.items.some((item) =>
        item.text.toLowerCase().includes('typescript'),
      )
      expect(hasTypescriptMemory).toBe(true)
    }, 30000)

    type MemoryItemWithScore = {
      // Minimal shape needed for score assertions in tests
      score?: number
      [key: string]: unknown
    }

    it('should respect similarity threshold', async () => {
      if (!db || !hasVectorSearch || !testUserId || !testConversationId) {
        console.log('Skipping: Vector search not available or test data missing')
        return
      }

      const result = await retrieveMemoryItems(
        db,
        testUserId,
        'TypeScript static typing',
        testConversationId,
      )

      expect(result.items.length).toBeGreaterThan(0)

      // All results should have reasonable similarity scores
      const itemsWithScore = result.items as unknown as MemoryItemWithScore[]
      itemsWithScore.forEach((item) => {
        const score = typeof item.score === 'number' ? item.score : 0
        expect(score).toBeGreaterThan(0)
        expect(score).toBeLessThanOrEqual(1)
      })
    }, 30000)

    it('should rank results by relevance', async () => {
      if (!db || !hasVectorSearch || !testUserId || !testConversationId) {
        console.log('Skipping: Vector search not available or test data missing')
        return
      }

      const result = await retrieveMemoryItems(
        db,
        testUserId,
        'TypeScript type safety',
        testConversationId,
      )

      if (result.items.length < 2) {
        console.log('Not enough results to test ranking')
        return
      }

      // Results should be sorted by score (descending)
      const itemsWithScore = result.items as unknown as MemoryItemWithScore[]
      for (let i = 0; i < itemsWithScore.length - 1; i++) {
        const current = typeof itemsWithScore[i].score === 'number' ? itemsWithScore[i].score! : 0
        const next =
          typeof itemsWithScore[i + 1].score === 'number' ? itemsWithScore[i + 1].score! : 0
        expect(current).toBeGreaterThanOrEqual(next)
      }
    }, 30000)

    it('should return conversation-scoped results (local + global)', async () => {
      if (!db || !hasVectorSearch || !testUserId || !testConversationId) {
        console.log('Skipping: Vector search not available or test data missing')
        return
      }

      const result = await retrieveMemoryItems(
        db,
        testUserId,
        'programming preferences',
        testConversationId,
      )

      expect(result).toBeDefined()
      expect(result.localCount).toBeDefined()
      expect(result.globalCount).toBeDefined()

      // Should have at least local results (from same conversation)
      expect(result.localCount).toBeGreaterThan(0)
    }, 30000)

    it('should handle queries with no matching results gracefully', async () => {
      if (!db || !hasVectorSearch || !testUserId || !testConversationId) {
        console.log('Skipping: Vector search not available or test data missing')
        return
      }

      const result = await retrieveMemoryItems(
        db,
        testUserId,
        'quantum mechanics and particle physics advanced topics',
        testConversationId,
      )

      expect(result).toBeDefined()
      expect(result.items).toBeDefined()
      expect(Array.isArray(result.items)).toBe(true)
      // May be empty or have low-score results
    }, 30000)
  })

  describe('Tenant Isolation', () => {
    let otherUserId: string
    let otherMemoryId: string

    beforeAll(async () => {
      if (!payload || !hasVectorSearch) return

      // Create another user with a memory
      const otherUser = await payload.create({
        collection: 'users',
        data: {
          email: `other-vector-${Date.now()}@example.com`,
          password: 'test123456',
          role: 'student',
        },
      })
      otherUserId = otherUser.id

      const embedding = await generateEmbedding('Other user confidential information')
      const memory = await payload.create({
        collection: 'memory_items',
        data: {
          userId: otherUserId,
          conversationId: 'other-conversation',
          contextKey: 'global',
          text: 'Other user confidential information',
          type: 'fact',
          importance: 5,
          embedding: embedding.embedding,
          source: {
            sourceMessageTimestamp: new Date().toISOString(),
            sourceMessageRole: 'user',
          },
          status: 'active',
        },
      })
      otherMemoryId = memory.id

      // Wait for indexing
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }, 60000)

    afterAll(async () => {
      if (!payload || !hasVectorSearch) return

      if (otherMemoryId) {
        await payload.delete({ collection: 'memory_items', id: otherMemoryId })
      }
      if (otherUserId) {
        await payload.delete({ collection: 'users', id: otherUserId })
      }
    })

    it('should not return other users memories in search results', async () => {
      if (!db || !hasVectorSearch || !testUserId || !testConversationId) {
        console.log('Skipping: Vector search not available or test data missing')
        return
      }

      const result = await retrieveMemoryItems(
        db,
        testUserId,
        'confidential information',
        testConversationId,
      )

      // Should not contain other user's memory
      const hasOtherUserMemory = result.items.some((item) => item.userId === otherUserId)
      expect(hasOtherUserMemory).toBe(false)
    }, 30000)

    it('should enforce userId filter in vector search', async () => {
      if (!db || !hasVectorSearch || !testUserId || !testConversationId) {
        console.log('Skipping: Vector search not available or test data missing')
        return
      }

      const result = await retrieveMemoryItems(db, testUserId, 'information', testConversationId)

      // All results should belong to testUserId
      result.items.forEach((item) => {
        expect(item.userId).toBe(testUserId)
      })
    }, 30000)
  })

  describe('Performance and Latency', () => {
    it('should complete vector search within reasonable time', async () => {
      if (!db || !hasVectorSearch || !testUserId || !testConversationId) {
        console.log('Skipping: Vector search not available or test data missing')
        return
      }

      const startTime = Date.now()
      const result = await retrieveMemoryItems(
        db,
        testUserId,
        'programming languages',
        testConversationId,
      )
      const endTime = Date.now()

      const totalLatency = endTime - startTime

      // Vector search should complete in < 5 seconds
      expect(totalLatency).toBeLessThan(5000)
      expect(result.latencyMs).toBeLessThan(5000)
    }, 30000)

    it('should report accurate latency metrics', async () => {
      if (!db || !hasVectorSearch || !testUserId || !testConversationId) {
        console.log('Skipping: Vector search not available or test data missing')
        return
      }

      const result = await retrieveMemoryItems(db, testUserId, 'test query', testConversationId)

      expect(result.latencyMs).toBeGreaterThan(0)
      expect(typeof result.latencyMs).toBe('number')
    }, 30000)
  })

  describe('Status Filter Enforcement', () => {
    let deprecatedMemoryId: string

    beforeAll(async () => {
      if (!payload || !hasVectorSearch || !testUserId || !testConversationId) return

      // Create a deprecated memory
      const embedding = await generateEmbedding('This is deprecated information')
      const memory = await payload.create({
        collection: 'memory_items',
        data: {
          userId: testUserId,
          conversationId: testConversationId,
          contextKey: 'global',
          text: 'This is deprecated information',
          type: 'fact',
          importance: 3,
          embedding: embedding.embedding,
          source: {
            sourceMessageTimestamp: new Date().toISOString(),
            sourceMessageRole: 'user',
          },
          status: 'deprecated',
        },
      })
      deprecatedMemoryId = memory.id

      await new Promise((resolve) => setTimeout(resolve, 5000))
    }, 60000)

    afterAll(async () => {
      if (!payload || !hasVectorSearch || !deprecatedMemoryId) return

      await payload.delete({ collection: 'memory_items', id: deprecatedMemoryId })
    })

    it('should only return active memories by default', async () => {
      if (!db || !hasVectorSearch || !testUserId || !testConversationId) {
        console.log('Skipping: Vector search not available or test data missing')
        return
      }

      const result = await retrieveMemoryItems(
        db,
        testUserId,
        'deprecated information',
        testConversationId,
      )

      // Should not include deprecated memories
      result.items.forEach((item) => {
        expect(item.status).toBe('active')
      })
    }, 30000)
  })

  describe('Error Handling', () => {
    it('should handle invalid userId gracefully', async () => {
      if (!db || !hasVectorSearch) {
        console.log('Skipping: Vector search not available')
        return
      }

      const result = await retrieveMemoryItems(
        db,
        'non-existent-user-id',
        'test query',
        'non-existent-conversation',
      )

      expect(result).toBeDefined()
      expect(result.items.length).toBe(0)
    }, 30000)

    it('should handle empty query gracefully', async () => {
      if (!db || !hasVectorSearch || !testUserId || !testConversationId) {
        console.log('Skipping: Vector search not available or test data missing')
        return
      }

      // Empty query will fail at embedding generation, caught by retrieveMemoryItems
      const result = await retrieveMemoryItems(db, testUserId, '', testConversationId)

      // Should return empty results (graceful fallback)
      expect(result).toBeDefined()
      expect(result.items.length).toBe(0)
    }, 30000)
  })
})
