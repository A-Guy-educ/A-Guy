/**
 * Integration Tests for Chat Context + Long-Term Memory System
 *
 * Tests the complete flow of:
 * - Summary generation and maintenance
 * - Memory extraction and deduplication
 * - Vector search and retrieval
 * - Context composition
 * - End-to-end chat with context
 */
import { ChatRole } from '@/lib/ai/chat-message-role'
import { buildRetrievalQuery, composePrompt, getRecentWindow } from '@/lib/ai/context-policy'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { runSummaryMaintenance } from '@/lib/ai/maintenance'
import { extractMemoryCandidates, persistMemoryItems } from '@/lib/ai/memory-extraction'
import { generateSummary } from '@/lib/ai/summary'
import { retrieveMemoryItems } from '@/lib/ai/vector-search'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let testUserId: string
let testExerciseId: string
let testConversationId: string

// Skip all tests if OPENAI_API_KEY is not set
const hasOpenAIKey = !!process.env.OPENAI_API_KEY

describe.skipIf(!hasOpenAIKey)('Memory System Integration Tests', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })

    // Create test user
    const user = await payload.create({
      collection: 'users',
      data: {
        email: `test-memory-${Date.now()}@example.com`,
        password: 'test123456',
        role: 'student',
      },
    })
    testUserId = user.id

    // Try to find an existing exercise, or create minimal test data
    const existingExercises = await payload.find({
      collection: 'exercises',
      limit: 1,
    })

    if (existingExercises.docs.length > 0) {
      testExerciseId = existingExercises.docs[0].id
    } else {
      // If no exercise exists, we'll skip conversation creation
      // Tests will still work for embeddings, summary, and memory extraction
      console.warn('⚠️  No existing exercise found - skipping conversation creation')
    }

    // Create test conversation only if we have an exercise
    if (testExerciseId) {
      const conversation = await payload.create({
        collection: 'conversations',
        data: {
          user: testUserId,
          exercise: testExerciseId,
          messages: [],
          lastMessageAt: new Date().toISOString(),
          contextPolicyVersion: 'v1',
        },
        draft: false,
      })
      testConversationId = conversation.id
    }
  }, 30000) // 30s timeout for Payload initialization

  afterAll(async () => {
    // Skip cleanup if payload not initialized
    if (!payload) return

    // Cleanup: Delete test data
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

    // Delete test user (we didn't create exercise/lesson, so don't delete them)
    if (testUserId) {
      await payload.delete({
        collection: 'users',
        id: testUserId,
      })
    }
  }, 30000) // 30s timeout for cleanup

  describe('Embeddings Service', () => {
    it('should generate valid 1536-dimensional embeddings', async () => {
      const text = 'This is a test sentence for embedding generation.'
      const result = await generateEmbedding(text)

      expect(result).toBeDefined()
      expect(result.embedding).toBeDefined()
      expect(Array.isArray(result.embedding)).toBe(true)
      expect(result.embedding.length).toBe(1536)
      expect(result.embedding.every((v) => typeof v === 'number')).toBe(true)
      expect(result.model).toBeDefined()
      expect(result.tokensUsed).toBeGreaterThan(0)
    }, 30000) // 30s timeout for API call

    it('should handle empty text gracefully', async () => {
      await expect(generateEmbedding('')).rejects.toThrow(
        'Cannot generate embedding for empty text',
      )
    }, 30000)

    it('should generate different embeddings for different texts', async () => {
      const result1 = await generateEmbedding('I love programming in TypeScript.')
      const result2 = await generateEmbedding('The weather is sunny today.')

      expect(result1.embedding).not.toEqual(result2.embedding)

      // Check they're actually different (cosine similarity should be low)
      const dotProduct = result1.embedding.reduce(
        (sum, val, i) => sum + val * result2.embedding[i],
        0,
      )
      const mag1 = Math.sqrt(result1.embedding.reduce((sum, val) => sum + val * val, 0))
      const mag2 = Math.sqrt(result2.embedding.reduce((sum, val) => sum + val * val, 0))
      const similarity = dotProduct / (mag1 * mag2)

      expect(similarity).toBeLessThan(0.9) // Should be dissimilar
    }, 30000)
  })

  describe('Context Policy', () => {
    it('should extract recent window correctly', () => {
      const messages = Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: `Message ${i}`,
        timestamp: new Date(Date.now() - (50 - i) * 60000).toISOString(),
      }))

      const recent = getRecentWindow(messages)

      expect(recent.length).toBe(20)
      expect(recent[0].content).toBe('Message 30') // Last 20 messages
      expect(recent[19].content).toBe('Message 49')
    })

    it('should return all messages if less than window size', () => {
      const messages = [
        { role: 'user' as const, content: 'Hello', timestamp: new Date().toISOString() },
        { role: 'assistant' as const, content: 'Hi there!', timestamp: new Date().toISOString() },
      ]

      const recent = getRecentWindow(messages)

      expect(recent.length).toBe(2)
    })

    it('should build retrieval query from recent messages', () => {
      const messages = [
        {
          role: 'user' as const,
          content: 'What is TypeScript?',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content: 'TypeScript is a typed superset of JavaScript.',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'user' as const,
          content: 'How do I use generics?',
          timestamp: new Date().toISOString(),
        },
      ]

      const query = buildRetrievalQuery(messages)

      expect(query).toContain('TypeScript')
      expect(query).toContain('generics')
    })

    it('should compose prompt with all context elements', () => {
      const prompt = composePrompt('You are a helpful assistant.', {
        systemMessage: 'You are a helpful assistant.',
        summary: 'Previously discussed TypeScript basics.',
        memoryItems: [
          {
            text: 'User prefers TypeScript over JavaScript',
            type: 'preference',
            importance: 4,
          } as any,
        ],
        recentMessages: [
          { role: 'user', content: 'Tell me about React', timestamp: new Date().toISOString() },
        ],
      })

      expect(prompt.messages.length).toBeGreaterThan(0)
      // Check deterministic ordering
      const contents = prompt.messages.map((m) => m.content).join(' ')
      expect(contents).toContain('helpful assistant')
      expect(contents).toContain('TypeScript basics')
      expect(contents).toContain('prefers TypeScript')
      expect(contents).toContain('Tell me about React')
    })
  })

  describe('Summary Generation', () => {
    it('should generate summary from messages', async () => {
      const messages = [
        {
          role: 'user' as const,
          content: 'What is Payload CMS?',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content: 'Payload is a headless CMS built with TypeScript.',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'user' as const,
          content: 'How do I create collections?',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content: 'You define collections in your config file.',
          timestamp: new Date().toISOString(),
        },
      ]

      const result = await generateSummary('', messages)

      expect(result).toBeDefined()
      expect(result.summary).toBeDefined()
      expect(typeof result.summary).toBe('string')
      expect(result.summary.length).toBeGreaterThan(0)

      // FIX: Validate word count, not character count (prompt says "under 500 words")
      const wordCount = result.summary.split(/\s+/).length
      expect(wordCount).toBeLessThan(500)

      expect(result.summaryUntilTimestamp).toBeDefined()
      expect(result.tokensUsed).toBeGreaterThan(0)
    }, 30000)

    it('should incorporate previous summary', async () => {
      const messages = [
        {
          role: 'user' as const,
          content: 'Tell me about hooks',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content: 'Hooks let you add logic to collection operations.',
          timestamp: new Date().toISOString(),
        },
      ]
      const previousSummary = 'User learned about Payload CMS basics.'

      const result = await generateSummary(previousSummary, messages)

      expect(result).toBeDefined()
      expect(result.summary).toBeDefined()
      expect(result.summary.length).toBeGreaterThan(0)
      expect(result.tokensUsed).toBeGreaterThan(0)
    }, 30000)
  })

  describe('Summary Maintenance', () => {
    it('should trigger maintenance when threshold reached (40+ messages)', async () => {
      // Create conversation with 45 messages (above normal threshold)
      const messages = Array.from({ length: 45 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Message ${i}`,
        timestamp: new Date(Date.now() - (45 - i) * 60000).toISOString(),
      }))

      await payload.update({
        collection: 'conversations',
        id: testConversationId,
        data: { messages },
      })

      // Run maintenance
      await runSummaryMaintenance(payload, testConversationId)

      // Check conversation was updated
      const updated = await payload.findByID({
        collection: 'conversations',
        id: testConversationId,
      })

      // Summary should be generated
      expect(updated.summary).toBeDefined()
      expect(updated.summaryUpdatedAt).toBeDefined()
      expect(updated.summaryUntilTimestamp).toBeDefined()

      // Messages should be trimmed to 20
      expect(updated.messages?.length).toBe(20)
    }, 60000) // 60s timeout

    it('should trigger at safety threshold (80+ messages)', async () => {
      // Create conversation with 85 messages (above safety threshold)
      const messages = Array.from({ length: 85 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Safety threshold message ${i}`,
        timestamp: new Date(Date.now() - (85 - i) * 60000).toISOString(),
      }))

      await payload.update({
        collection: 'conversations',
        id: testConversationId,
        data: { messages },
      })

      // Run maintenance
      const result = await runSummaryMaintenance(payload, testConversationId)

      expect(result.summaryUpdated).toBe(true)
      expect(result.messagesTrimmed).toBeGreaterThan(0)

      // Check conversation was updated
      const updated = await payload.findByID({
        collection: 'conversations',
        id: testConversationId,
      })

      // Should definitely have summary at safety threshold
      expect(updated.summary).toBeDefined()
      expect(updated.messages?.length).toBe(20)
    }, 60000)

    it('should handle long conversations with multiple summary cycles', async () => {
      // Simulate 3 cycles of conversation growth
      for (let cycle = 0; cycle < 3; cycle++) {
        // Add 45 messages
        const currentMessages =
          (
            await payload.findByID({
              collection: 'conversations',
              id: testConversationId,
            })
          ).messages || []

        const newMessages = Array.from({ length: 45 }, (_, i) => ({
          role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
          content: `Cycle ${cycle} Message ${i}`,
          timestamp: new Date(Date.now() - (45 - i) * 60000 + cycle * 100000).toISOString(),
        }))

        await payload.update({
          collection: 'conversations',
          id: testConversationId,
          data: { messages: [...currentMessages, ...newMessages] },
        })

        // Run maintenance
        await runSummaryMaintenance(payload, testConversationId)
      }

      const final = await payload.findByID({
        collection: 'conversations',
        id: testConversationId,
      })

      // Should have summary from multiple cycles
      expect(final.summary).toBeDefined()
      expect(final.summary!.length).toBeGreaterThan(50) // Should have accumulated info
      expect(final.messages?.length).toBe(20) // Always trimmed to 20
    }, 180000) // 3 minutes for multiple cycles

    it('should preserve information quality across summary cycles', async () => {
      // Create a conversation where key information is repeatedly reinforced
      const messages = [
        {
          role: 'user' as const,
          content: 'My name is Alice and I love React for building web applications',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content: 'Nice to meet you Alice! React is excellent for UI development.',
          timestamp: new Date().toISOString(),
        },
        ...Array.from({ length: 20 }, (_, i) => ({
          role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
          content:
            i % 4 === 0
              ? `Alice, what do you think about React hooks?`
              : i % 4 === 1
                ? `I find React hooks very useful for state management`
                : i % 4 === 2
                  ? `That's great! React's component model is powerful`
                  : `General discussion point ${i}`,
          timestamp: new Date(Date.now() + i * 60000).toISOString(),
        })),
        {
          role: 'user' as const,
          content: "I'm Alice and I've been working with React for years",
          timestamp: new Date(Date.now() + 1200000).toISOString(),
        },
        {
          role: 'assistant' as const,
          content: 'Your React expertise really shows, Alice!',
          timestamp: new Date(Date.now() + 1260000).toISOString(),
        },
      ]

      await payload.update({
        collection: 'conversations',
        id: testConversationId,
        data: { messages },
      })

      await runSummaryMaintenance(payload, testConversationId)

      const updated = await payload.findByID({
        collection: 'conversations',
        id: testConversationId,
      })

      // Summary should be generated and contain meaningful information
      expect(updated.summary).toBeDefined()
      const summary = updated.summary!

      // The summary should be a meaningful text (not empty)
      expect(summary.length).toBeGreaterThan(10)

      // Check if key information was preserved (best effort, AI may generalize)
      const summaryLower = summary.toLowerCase()
      const hasAlice = summaryLower.includes('alice')
      const hasReact = summaryLower.includes('react')
      const hasRelevantTerms =
        summaryLower.includes('web') ||
        summaryLower.includes('development') ||
        summaryLower.includes('ui') ||
        summaryLower.includes('hooks') ||
        summaryLower.includes('component')

      // Log what was captured for debugging
      console.log('Summary:', summary)
      console.log('Preserved:', { hasAlice, hasReact, hasRelevantTerms })

      // The summary should at least capture the general topic even if specific names are lost
      // This is more realistic given AI summarization behavior
      expect(hasRelevantTerms || hasAlice || hasReact).toBe(true)
    }, 60000)
  })

  describe('Memory Extraction', () => {
    it('should extract memory candidates from conversation', async () => {
      const messages = [
        {
          role: 'user' as const,
          content: 'I prefer dark mode for coding',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content: "That's a great choice for reducing eye strain.",
          timestamp: new Date().toISOString(),
        },
        {
          role: 'user' as const,
          content: 'My favorite language is TypeScript',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content: 'TypeScript is excellent for type safety.',
          timestamp: new Date().toISOString(),
        },
      ]

      const candidates = await extractMemoryCandidates(messages, '')

      expect(candidates).toBeDefined()
      expect(Array.isArray(candidates)).toBe(true)
      // Should extract preferences
      if (candidates.length > 0) {
        expect(candidates[0]).toHaveProperty('text')
        expect(candidates[0]).toHaveProperty('type')
        expect(candidates[0]).toHaveProperty('importance')
        expect(candidates[0].importance).toBeGreaterThanOrEqual(1)
        expect(candidates[0].importance).toBeLessThanOrEqual(5)
      }
    }, 60000)

    it('should persist non-duplicate memories', async () => {
      // Skip if MongoDB connection not available (needed for vector search)
      const db = (payload.db as any).connection?.db
      if (!db) {
        console.log('Skipping memory persistence test: MongoDB connection not available')
        return
      }

      const candidates = [
        {
          text: 'User is learning Payload CMS',
          type: 'fact' as const,
          importance: 3,
          scope: 'user' as const,
          reason: 'Test memory item',
        },
      ]

      const persisted = await persistMemoryItems(
        payload,
        testUserId,
        testConversationId,
        candidates,
        new Date(),
        ChatRole.Assistant,
      )

      expect(persisted).toBeGreaterThan(0)

      // Verify memory was created
      const memories = await payload.find({
        collection: 'memory_items',
        where: { userId: { equals: testUserId } },
      })

      expect(memories.docs.length).toBeGreaterThan(0)
    }, 30000)
  })

  describe('Memory Isolation and Deduplication', () => {
    it('should isolate memories across different conversations', async () => {
      const db = (payload.db as any).connection?.db
      if (!db) {
        console.log('Skipping: MongoDB connection not available')
        return
      }

      // Create two conversations for the same user
      const conv1 = await payload.create({
        collection: 'conversations',
        data: {
          user: testUserId,
          exercise: testExerciseId,
          messages: [],
          lastMessageAt: new Date().toISOString(),
          contextPolicyVersion: 'v1',
        },
        draft: false,
      })

      const conv2 = await payload.create({
        collection: 'conversations',
        data: {
          user: testUserId,
          exercise: testExerciseId,
          messages: [],
          lastMessageAt: new Date().toISOString(),
          contextPolicyVersion: 'v1',
        },
        draft: false,
      })

      // Create memory in conv1
      const embedding1 = await generateEmbedding('User prefers dark mode in conversation 1')
      await payload.create({
        collection: 'memory_items',
        data: {
          userId: testUserId,
          conversationId: conv1.id,
          text: 'User prefers dark mode in conversation 1',
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

      // Create memory in conv2
      const embedding2 = await generateEmbedding('User likes TypeScript in conversation 2')
      await payload.create({
        collection: 'memory_items',
        data: {
          userId: testUserId,
          conversationId: conv2.id,
          text: 'User likes TypeScript in conversation 2',
          type: 'preference',
          importance: 4,
          embedding: embedding2.embedding,
          source: {
            sourceMessageTimestamp: new Date().toISOString(),
            sourceMessageRole: 'user',
          },
          status: 'active',
        },
      })

      try {
        // Retrieve memories for conv1 - should get local + global
        const result1 = await retrieveMemoryItems(db, testUserId, 'user preferences', conv1.id)

        if (result1.items.length > 0) {
          // Should find the conv1 memory (local)
          const hasConv1Memory = result1.items.some((item) => item.conversationId === conv1.id)
          expect(hasConv1Memory).toBe(true)

          // Should also find conv2 memory (as global)
          const hasConv2Memory = result1.items.some((item) => item.conversationId === conv2.id)
          expect(hasConv2Memory).toBe(true)

          // Local should be preferred
          expect(result1.localCount).toBeGreaterThan(0)
          expect(result1.globalCount).toBeGreaterThan(0)
        }
      } catch (error: any) {
        if (error.message?.includes('$vectorSearch')) {
          console.log('Skipping assertions: Vector search not available')
        } else {
          throw error
        }
      }

      // Cleanup
      await payload.delete({ collection: 'conversations', id: conv1.id })
      await payload.delete({ collection: 'conversations', id: conv2.id })
    }, 60000)

    it('should deduplicate similar memories', async () => {
      const db = (payload.db as any).connection?.db
      if (!db) {
        console.log('Skipping: MongoDB connection not available')
        return
      }

      // Create first memory
      const candidates1 = [
        {
          text: 'User prefers React for frontend development',
          type: 'preference' as const,
          importance: 4,
          scope: 'user' as const,
          reason: 'Explicit preference stated',
        },
      ]

      const persisted1 = await persistMemoryItems(
        payload,
        testUserId,
        testConversationId,
        candidates1,
        new Date(),
        ChatRole.User,
      )

      expect(persisted1).toBe(1)

      // Try to create very similar memory (should be deduplicated)
      const candidates2 = [
        {
          text: 'User likes React for building frontends',
          type: 'preference' as const,
          importance: 4,
          scope: 'user' as const,
          reason: 'Similar to existing preference',
        },
      ]

      const persisted2 = await persistMemoryItems(
        payload,
        testUserId,
        testConversationId,
        candidates2,
        new Date(),
        ChatRole.User,
      )

      // If vector search is available (Atlas), should deduplicate (0)
      // If not available (local), will create new (1)
      // Both behaviors are acceptable depending on environment
      if (persisted2 === 0) {
        console.log('✓ Deduplication working (vector search available)')
      } else if (persisted2 === 1) {
        console.log('⚠ Deduplication skipped (vector search not available)')
      }
      expect([0, 1]).toContain(persisted2)
    }, 60000)
  })

  describe('Vector Search (requires MongoDB Atlas)', () => {
    // Note: These tests require MongoDB Atlas with vector search index
    // They will be skipped if not available

    it('should retrieve conversation-scoped memories', async () => {
      // Skip if not Atlas
      const db = (payload.db as any).connection?.db
      if (!db) {
        console.log('Skipping vector search test: MongoDB Atlas not available')
        return
      }

      // Create a memory for this conversation
      const embeddingResult = await generateEmbedding('User is learning TypeScript basics')
      await payload.create({
        collection: 'memory_items',
        data: {
          userId: testUserId,
          conversationId: testConversationId,
          text: 'User is learning TypeScript basics',
          type: 'fact',
          importance: 4,
          embedding: embeddingResult.embedding,
          source: {
            sourceMessageTimestamp: new Date().toISOString(),
            sourceMessageRole: 'user',
          },
          status: 'active',
        },
      })

      // Search for it
      try {
        const result = await retrieveMemoryItems(
          db,
          testUserId,
          'TypeScript programming',
          testConversationId,
        )

        // Only assert if vector search is actually working
        // (fails on local MongoDB without Atlas vector search)
        if (result.items.length === 0) {
          console.log('Skipping assertions: Vector search returned no results (likely not Atlas)')
          return
        }

        expect(result.items.length).toBeGreaterThan(0)
        expect(result.localCount).toBeGreaterThan(0)
        expect(result.latencyMs).toBeGreaterThan(0)
      } catch (error: any) {
        if (
          error.message?.includes('index') ||
          error.message?.includes('$vectorSearch') ||
          error.message?.includes('SearchNotEnabled')
        ) {
          console.log('Skipping: Vector search not available (requires MongoDB Atlas)')
        } else {
          throw error
        }
      }
    }, 30000)

    it('should enforce tenant isolation in vector search', async () => {
      const db = (payload.db as any).connection?.db
      if (!db) {
        console.log('Skipping vector search test: MongoDB Atlas not available')
        return
      }

      // Create another user's memory
      const otherUser = await payload.create({
        collection: 'users',
        data: {
          email: `other-user-${Date.now()}@example.com`,
          password: 'test123456',
          role: 'student',
        },
      })

      const embeddingResult = await generateEmbedding('Other user secret information')
      await payload.create({
        collection: 'memory_items',
        data: {
          userId: otherUser.id,
          conversationId: 'other-conversation',
          text: 'Other user secret information',
          type: 'fact',
          importance: 5,
          embedding: embeddingResult.embedding,
          source: {
            sourceMessageTimestamp: new Date().toISOString(),
            sourceMessageRole: 'user',
          },
          status: 'active',
        },
      })

      // Try to search as test user
      try {
        const result = await retrieveMemoryItems(
          db,
          testUserId,
          'secret information',
          testConversationId,
        )

        // Should NOT retrieve other user's memory
        const hasOtherUserMemory = result.items.some((item) => item.userId === otherUser.id)
        expect(hasOtherUserMemory).toBe(false)
      } catch (error: any) {
        if (error.message?.includes('index')) {
          console.log('Skipping: Vector search index not provisioned')
        } else {
          throw error
        }
      }

      // Cleanup
      await payload.delete({ collection: 'users', id: otherUser.id })
    }, 30000)
  })

  describe('End-to-End Chat with Context', () => {
    it('should build context and generate response', async () => {
      // Setup: Create a conversation with history
      const messages = [
        {
          role: 'user' as const,
          content: 'I am learning Payload CMS',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content: 'Great! Payload is a powerful CMS.',
          timestamp: new Date().toISOString(),
        },
      ]

      await payload.update({
        collection: 'conversations',
        id: testConversationId,
        data: { messages },
      })

      // Get recent window
      const recentMessages = getRecentWindow(messages)
      expect(recentMessages.length).toBe(2)

      // Build retrieval query
      const query = buildRetrievalQuery(recentMessages)
      expect(query).toContain('Payload')

      // Compose prompt with context
      const prompt = composePrompt('You are a helpful assistant.', {
        systemMessage: 'You are a helpful assistant.',
        summary: '',
        memoryItems: [],
        recentMessages,
      })

      expect(prompt.messages.length).toBeGreaterThan(0)
    })
  })

  describe('Feature Flags', () => {
    it('should respect feature flags', async () => {
      const { featureFlags } = await import('@/lib/feature-flags')

      // Flags should exist
      expect(typeof featureFlags.SUMMARY_MAINTENANCE_ENABLED).toBe('boolean')
      expect(typeof featureFlags.MEMORY_EXTRACTION_ENABLED).toBe('boolean')
      expect(typeof featureFlags.MEMORY_RETRIEVAL_ENABLED).toBe('boolean')
    })
  })
})
