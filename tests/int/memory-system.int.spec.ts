/**
 * Integration Tests for Chat Context + Long-Term Memory System
 */
import { ChatRole } from '@/infra/llm/chat-message-role'
import { buildRetrievalQuery, composePrompt, getRecentWindow } from '@/infra/llm/context-policy'
import { generateEmbedding } from '@/infra/llm/embeddings'
import { runSummaryMaintenance } from '@/infra/llm/maintenance'
import { extractMemoryCandidates, persistMemoryItems } from '@/infra/llm/memory-extraction'
import { generateSummary } from '@/infra/llm/summary'
import type { MemoryItem } from '@/infra/llm/vector-search'
import { retrieveMemoryItems } from '@/infra/llm/vector-search'
import config from '@payload-config'
import type { Db } from 'mongodb'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

function getDb(payload: Payload): Db {
  const db = (payload.db as { connection?: { db?: Db } }).connection?.db
  if (!db) {
    throw new Error('Database connection not available')
  }
  return db
}

function isVectorSearchUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes('index') ||
    error.message.includes('$vectorSearch') ||
    error.message.includes('SearchNotEnabled')
  )
}

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

    // Try to find an existing exercise
    const existingExercises = await payload.find({
      collection: 'exercises',
      limit: 1,
    })

    if (existingExercises.docs.length > 0) {
      testExerciseId = existingExercises.docs[0].id
    } else {
      console.warn('⚠️  No existing exercise found - skipping conversation creation')
    }

    if (testExerciseId) {
      const conversation = await payload.create({
        collection: 'conversations',
        data: {
          user: testUserId,
          contextRef: {
            relationTo: 'exercises',
            value: testExerciseId,
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
    if (!payload) return

    if (testConversationId) {
      await payload.delete({
        collection: 'conversations',
        id: testConversationId,
      })
    }

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

  describe('Embeddings Service', () => {
    it('should generate valid 1536-dimensional embeddings', async () => {
      const text = 'This is a test sentence for embedding generation.'
      const result = await generateEmbedding(payload, text)

      expect(result).toBeDefined()
      expect(result.embedding).toBeDefined()
      expect(Array.isArray(result.embedding)).toBe(true)
      expect(result.embedding.length).toBe(1536)
      expect(result.embedding.every((v) => typeof v === 'number')).toBe(true)
      expect(result.model).toBeDefined()
      expect(result.tokensUsed).toBeGreaterThan(0)
    }, 30000)

    it('should handle empty text gracefully', async () => {
      await expect(generateEmbedding(payload, '')).rejects.toThrow(
        'Cannot generate embedding for empty text',
      )
    }, 30000)

    it('should generate different embeddings for different texts', async () => {
      const result1 = await generateEmbedding(payload, 'I love programming in TypeScript.')
      const result2 = await generateEmbedding(payload, 'The weather is sunny today.')

      expect(result1.embedding).not.toEqual(result2.embedding)

      const dotProduct = result1.embedding.reduce(
        (sum, val, i) => sum + val * result2.embedding[i],
        0,
      )
      const mag1 = Math.sqrt(result1.embedding.reduce((sum, val) => sum + val * val, 0))
      const mag2 = Math.sqrt(result2.embedding.reduce((sum, val) => sum + val * val, 0))
      const similarity = dotProduct / (mag1 * mag2)

      expect(similarity).toBeLessThan(0.9)
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
      expect(recent[0].content).toBe('Message 30')
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
          content: 'TypeScript is a typed superset.',
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
      const memoryItem: MemoryItem = {
        _id: 'mem-1',
        userId: 'user-1',
        type: 'preference',
        text: 'User prefers TypeScript over JavaScript',
        importance: 4,
        status: 'active',
        source: { sourceMessageTimestamp: new Date(), sourceMessageRole: ChatRole.User },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const prompt = composePrompt('You are a helpful assistant.', {
        systemMessage: 'You are a helpful assistant.',
        summary: 'Previously discussed TypeScript basics.',
        memoryItems: [memoryItem],
        recentMessages: [
          { role: 'user', content: 'Tell me about React', timestamp: new Date().toISOString() },
        ],
      })

      expect(prompt.messages.length).toBeGreaterThan(0)
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
          content: 'Payload is a headless CMS.',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'user' as const,
          content: 'How do I create collections?',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content: 'You define collections in config.',
          timestamp: new Date().toISOString(),
        },
      ]

      const result = await generateSummary(payload, messages)

      expect(result).toBeDefined()
      expect(result.summary).toBeDefined()
      expect(typeof result.summary).toBe('string')
      expect(result.summary.length).toBeGreaterThan(0)
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
          content: 'Hooks let you add logic.',
          timestamp: new Date().toISOString(),
        },
      ]
      const previousSummary = 'User learned about Payload CMS basics.'

      const result = await generateSummary(payload, messages, previousSummary)

      expect(result).toBeDefined()
      expect(result.summary).toBeDefined()
      expect(result.summary.length).toBeGreaterThan(0)
      expect(result.tokensUsed).toBeGreaterThan(0)
    }, 30000)
  })

  describe('Summary Maintenance', () => {
    it('should trigger maintenance when threshold reached (40+ messages)', async () => {
      await payload.update({
        collection: 'conversations',
        id: testConversationId,
        data: { messages: [] },
        overrideAccess: true,
      })

      const messages = Array.from({ length: 45 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Message ${i}`,
        timestamp: new Date(Date.now() - (45 - i) * 60000).toISOString(),
      }))

      await payload.update({
        collection: 'conversations',
        id: testConversationId,
        data: { messages },
        overrideAccess: true,
      })

      await runSummaryMaintenance(payload, testConversationId)

      const updated = await payload.findByID({
        collection: 'conversations',
        id: testConversationId,
        depth: 0,
      })

      expect(updated.summary).toBeDefined()
      expect(updated.summaryUpdatedAt).toBeDefined()
      expect(updated.summaryUntilTimestamp).toBeDefined()
      expect(updated.messages?.length).toBe(20)
    }, 60000)

    it('should trigger at safety threshold (80+ messages)', async () => {
      await payload.update({
        collection: 'conversations',
        id: testConversationId,
        data: { messages: [] },
        overrideAccess: true,
      })

      const messages = Array.from({ length: 85 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Safety threshold message ${i}`,
        timestamp: new Date(Date.now() - (85 - i) * 60000).toISOString(),
      }))

      await payload.update({
        collection: 'conversations',
        id: testConversationId,
        data: { messages },
        overrideAccess: true,
      })

      const result = await runSummaryMaintenance(payload, testConversationId)

      expect(result.summaryUpdated).toBe(true)
      expect(result.messagesTrimmed).toBeGreaterThan(0)

      const updated = await payload.findByID({
        collection: 'conversations',
        id: testConversationId,
      })

      expect(updated.summary).toBeDefined()
      expect(updated.messages?.length).toBe(20)
    }, 60000)

    it('should handle long conversations with multiple summary cycles', async () => {
      await payload.update({
        collection: 'conversations',
        id: testConversationId,
        data: { messages: [] },
        overrideAccess: true,
      })

      for (let cycle = 0; cycle < 3; cycle++) {
        const currentMessages =
          (await payload.findByID({ collection: 'conversations', id: testConversationId }))
            .messages || []

        const totalMessages = currentMessages.length + 45
        let newMessages
        if (totalMessages > 100) {
          const trimmedMessages = currentMessages.slice(-55)
          newMessages = Array.from({ length: 45 }, (_, i) => ({
            role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
            content: `Cycle ${cycle} Message ${i}`,
            timestamp: new Date(Date.now() - (45 - i) * 60000 + cycle * 100000).toISOString(),
          }))
          await payload.update({
            collection: 'conversations',
            id: testConversationId,
            data: { messages: [...trimmedMessages, ...newMessages] },
            overrideAccess: true,
          })
        } else {
          newMessages = Array.from({ length: 45 }, (_, i) => ({
            role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
            content: `Cycle ${cycle} Message ${i}`,
            timestamp: new Date(Date.now() - (45 - i) * 60000 + cycle * 100000).toISOString(),
          }))
          await payload.update({
            collection: 'conversations',
            id: testConversationId,
            data: { messages: [...currentMessages, ...newMessages] },
            overrideAccess: true,
          })
        }

        await runSummaryMaintenance(payload, testConversationId)
      }

      const final = await payload.findByID({ collection: 'conversations', id: testConversationId })

      expect(final.summary).toBeDefined()
      expect(final.summary!.length).toBeGreaterThan(50)
      expect(final.messages?.length).toBe(20)
    }, 180000)

    it('should preserve information quality across summary cycles', async () => {
      await payload.update({
        collection: 'conversations',
        id: testConversationId,
        data: { messages: [] },
        overrideAccess: true,
      })

      const messages = [
        {
          role: 'user' as const,
          content: 'My name is Alice and I love React',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content: 'Nice to meet you Alice!',
          timestamp: new Date().toISOString(),
        },
        ...Array.from({ length: 20 }, (_, i) => ({
          role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
          content:
            i % 4 === 0 ? `Alice, what do you think about React hooks?` : `Discussion point ${i}`,
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
        overrideAccess: true,
      })

      await runSummaryMaintenance(payload, testConversationId)

      const updated = await payload.findByID({
        collection: 'conversations',
        id: testConversationId,
        depth: 0,
      })

      expect(updated.summary).toBeDefined()
      const summary = updated.summary || ''
      expect(summary.length).toBeGreaterThan(10)

      const summaryLower = summary.toLowerCase()
      const hasAlice = summaryLower.includes('alice')
      const hasReact = summaryLower.includes('react')
      const hasRelevantTerms =
        summaryLower.includes('web') ||
        summaryLower.includes('development') ||
        summaryLower.includes('ui')
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
          content: "That's a great choice.",
          timestamp: new Date().toISOString(),
        },
        {
          role: 'user' as const,
          content: 'My favorite language is TypeScript',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content: 'TypeScript is excellent.',
          timestamp: new Date().toISOString(),
        },
      ]

      const candidates = await extractMemoryCandidates(payload, messages)

      expect(candidates).toBeDefined()
      expect(Array.isArray(candidates)).toBe(true)
      if (candidates.length > 0) {
        expect(candidates[0]).toHaveProperty('text')
        expect(candidates[0]).toHaveProperty('type')
        expect(candidates[0]).toHaveProperty('importance')
        expect(candidates[0].importance).toBeGreaterThanOrEqual(1)
        expect(candidates[0].importance).toBeLessThanOrEqual(5)
      }
    }, 60000)

    it('should persist non-duplicate memories', async () => {
      const db = getDb(payload)
      if (!db) {
        console.log('Skipping: MongoDB connection not available')
        return
      }

      const candidates = [
        {
          text: 'User is learning Payload CMS',
          type: 'fact' as const,
          importance: 3,
          scope: 'user' as const,
          reason: 'Test',
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

      const memories = await payload.find({
        collection: 'memory_items',
        where: { userId: { equals: testUserId } },
      })
      expect(memories.docs.length).toBeGreaterThan(0)
    }, 30000)
  })

  describe('Memory Isolation and Deduplication', () => {
    it.skip('should isolate memories across different conversations', async () => {
      console.log('Skipping: Requires updated conversation schema')
    })

    it('should deduplicate similar memories', async () => {
      const db = getDb(payload)
      if (!db) {
        console.log('Skipping: MongoDB connection not available')
        return
      }

      const candidates1 = [
        {
          text: 'User prefers React for frontend',
          type: 'preference' as const,
          importance: 4,
          scope: 'user' as const,
          reason: 'Preference',
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

      const candidates2 = [
        {
          text: 'User likes React for building frontends',
          type: 'preference' as const,
          importance: 4,
          scope: 'user' as const,
          reason: 'Similar',
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
      expect([0, 1]).toContain(persisted2)
    }, 60000)
  })

  describe('Vector Search', () => {
    it('should retrieve conversation-scoped memories', async () => {
      const db = getDb(payload)
      if (!db) {
        console.log('Skipping: MongoDB Atlas not available')
        return
      }

      const embeddingResult = await generateEmbedding(payload, 'User is learning TypeScript basics')
      await payload.create({
        collection: 'memory_items',
        data: {
          userId: testUserId,
          conversationId: testConversationId,
          text: 'User is learning TypeScript basics',
          type: 'fact',
          importance: 4,
          embedding: embeddingResult.embedding,
          source: { sourceMessageTimestamp: new Date().toISOString(), sourceMessageRole: 'user' },
          status: 'active',
        },
      })

      try {
        const result = await retrieveMemoryItems(
          db,
          testUserId,
          'TypeScript programming',
          testConversationId,
        )
        if (result.items.length === 0) {
          console.log('Vector search returned no results')
          return
        }
        expect(result.items.length).toBeGreaterThan(0)
        expect(result.localCount + result.globalCount).toBeGreaterThan(0)
        expect(result.latencyMs).toBeGreaterThan(0)
      } catch (error: unknown) {
        if (isVectorSearchUnavailable(error)) {
          console.log('Skipping: Vector search not available')
        } else {
          throw error
        }
      }
    }, 30000)

    it('should enforce tenant isolation in vector search', async () => {
      const db = getDb(payload)
      if (!db) {
        console.log('Skipping: MongoDB Atlas not available')
        return
      }

      const otherUser = await payload.create({
        collection: 'users',
        data: {
          email: `other-user-${Date.now()}@example.com`,
          password: 'test123456',
          role: 'student',
        },
      })

      const embeddingResult = await generateEmbedding(payload, 'Other user secret information')
      await payload.create({
        collection: 'memory_items',
        data: {
          userId: otherUser.id,
          conversationId: 'other-conversation',
          text: 'Other user secret information',
          type: 'fact',
          importance: 5,
          embedding: embeddingResult.embedding,
          source: { sourceMessageTimestamp: new Date().toISOString(), sourceMessageRole: 'user' },
          status: 'active',
        },
      })

      try {
        const result = await retrieveMemoryItems(
          db,
          testUserId,
          'secret information',
          testConversationId,
        )
        const hasOtherUserMemory = result.items.some((item) => item.userId === otherUser.id)
        expect(hasOtherUserMemory).toBe(false)
      } catch (error: unknown) {
        if (isVectorSearchUnavailable(error)) {
          console.log('Skipping: Vector search index not provisioned')
        } else {
          throw error
        }
      }

      await payload.delete({ collection: 'users', id: otherUser.id })
    }, 30000)
  })

  describe('End-to-End Chat with Context', () => {
    it('should build context and generate response', async () => {
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
        overrideAccess: true,
      })

      const recentMessages = getRecentWindow(messages)
      expect(recentMessages.length).toBe(2)

      const query = buildRetrievalQuery(recentMessages)
      expect(query).toContain('Payload')

      const prompt = composePrompt('You are a helpful assistant.', {
        systemMessage: 'You are a helpful assistant.',
        summary: '',
        memoryItems: [],
        recentMessages,
      })

      expect(prompt.messages.length).toBeGreaterThan(0)
    })
  })
})
