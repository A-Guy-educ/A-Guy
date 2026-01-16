import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/utilities/test/mongodb-container'
import { createContextHierarchy } from '../factories/context.factory'
import { createTestUser } from '../factories/user.factory'
import { buildFeatureFlags } from '../mocks/feature-flags.mock'

type FlagCombo = {
  SUMMARY_MAINTENANCE_ENABLED: boolean
  MEMORY_EXTRACTION_ENABLED: boolean
  MEMORY_RETRIEVAL_ENABLED: boolean
}

async function loadAgentChatWithFlags(flags: FlagCombo) {
  vi.resetModules()

  const maintenance = {
    runSummaryMaintenance: vi.fn(async () => ({
      summaryUpdated: false,
      messagesTrimmed: 0,
      tokensUsed: 0,
    })),
  }

  const memoryExtraction = {
    extractMemoryCandidates: vi.fn(async () => [
      {
        type: 'preference',
        text: 'User prefers concise answers',
        importance: 3,
        scope: 'user',
        reason: 'User preference stated',
      },
    ]),
    persistMemoryItems: vi.fn(async () => 1),
  }

  const vectorSearch = {
    retrieveMemoryItems: vi.fn(async () => ({
      items: [],
      localCount: 0,
      contextCount: 0,
      parentCount: 0,
      globalCount: 0,
      hierarchyKeys: [],
      latencyMs: 0,
    })),
  }

  const vectorIndex = {
    isVectorIndexAvailable: vi.fn(async () => true),
  }

  const exerciseChat = {
    chatWithExerciseHelper: vi.fn(async () => ({
      success: true,
      message: 'Mock assistant response',
    })),
    getSystemPrompt: vi.fn(() => 'System prompt'),
  }

  vi.doMock('@/lib/feature-flags', () => ({
    featureFlags: buildFeatureFlags(flags),
  }))
  vi.doMock('@/lib/ai/maintenance', () => maintenance)
  vi.doMock('@/lib/ai/memory-extraction', () => memoryExtraction)
  vi.doMock('@/lib/ai/vector-search', () => vectorSearch)
  vi.doMock('@/lib/ai/vector-index-check', () => vectorIndex)
  vi.doMock('@/lib/ai/services/exercise-chat-service', () => exerciseChat)

  const { agentChat } = await import('@/endpoints/agent/chat')

  return { agentChat, maintenance, memoryExtraction, vectorSearch, vectorIndex, exerciseChat }
}

let payload: Payload
let originalDatabaseUrl: string | undefined
let context: Awaited<ReturnType<typeof createContextHierarchy>>
let testUserId: string

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error - TypeScript doesn't allow delete on process.env, but it's safe here
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  const user = await createTestUser(payload)
  testUserId = user.id

  context = await createContextHierarchy(payload)
}, 120000)

beforeEach(async () => {
  if (!payload) return

  const conversations = await payload.find({
    collection: 'conversations',
    where: {
      user: { equals: testUserId },
    },
    limit: 1000,
    overrideAccess: true,
  })

  for (const conv of conversations.docs) {
    await payload.delete({
      collection: 'conversations',
      id: conv.id,
      overrideAccess: true,
    })
  }
})

afterAll(async () => {
  if (context?.cleanup) {
    await context.cleanup()
  }

  if (payload && testUserId) {
    await payload.delete({ collection: 'users', id: testUserId, overrideAccess: true })
  }

  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error - TypeScript doesn't allow delete on process.env, but it's safe here
    delete process.env.DATABASE_URL
  }
}, 120000)

describe('feature flag combinations', () => {
  const combinations: FlagCombo[] = [
    { SUMMARY_MAINTENANCE_ENABLED: false, MEMORY_EXTRACTION_ENABLED: false, MEMORY_RETRIEVAL_ENABLED: false },
    { SUMMARY_MAINTENANCE_ENABLED: true, MEMORY_EXTRACTION_ENABLED: false, MEMORY_RETRIEVAL_ENABLED: false },
    { SUMMARY_MAINTENANCE_ENABLED: false, MEMORY_EXTRACTION_ENABLED: true, MEMORY_RETRIEVAL_ENABLED: false },
    { SUMMARY_MAINTENANCE_ENABLED: false, MEMORY_EXTRACTION_ENABLED: false, MEMORY_RETRIEVAL_ENABLED: true },
    { SUMMARY_MAINTENANCE_ENABLED: true, MEMORY_EXTRACTION_ENABLED: true, MEMORY_RETRIEVAL_ENABLED: false },
    { SUMMARY_MAINTENANCE_ENABLED: true, MEMORY_EXTRACTION_ENABLED: false, MEMORY_RETRIEVAL_ENABLED: true },
    { SUMMARY_MAINTENANCE_ENABLED: false, MEMORY_EXTRACTION_ENABLED: true, MEMORY_RETRIEVAL_ENABLED: true },
    { SUMMARY_MAINTENANCE_ENABLED: true, MEMORY_EXTRACTION_ENABLED: true, MEMORY_RETRIEVAL_ENABLED: true },
  ]

  it.each(combinations)(
    'respects flag combination: %o',
    async ({ SUMMARY_MAINTENANCE_ENABLED, MEMORY_EXTRACTION_ENABLED, MEMORY_RETRIEVAL_ENABLED }) => {
      const { agentChat, maintenance, memoryExtraction, vectorSearch, vectorIndex } =
        await loadAgentChatWithFlags({
          SUMMARY_MAINTENANCE_ENABLED,
          MEMORY_EXTRACTION_ENABLED,
          MEMORY_RETRIEVAL_ENABLED,
        })

      const req = {
        payload,
        user: { id: testUserId, role: 'student' } as any,
        json: async () => ({
          message: 'Hello there',
          acknowledgment: 'ack',
          exerciseId: context.exerciseId,
        }),
      } as PayloadRequest & { json: () => Promise<unknown> }

      const res = await agentChat(req)
      expect(res.status).toBe(200)

      expect(maintenance.runSummaryMaintenance).toHaveBeenCalledTimes(
        SUMMARY_MAINTENANCE_ENABLED ? 1 : 0,
      )

      expect(vectorIndex.isVectorIndexAvailable).toHaveBeenCalledTimes(
        MEMORY_RETRIEVAL_ENABLED ? 1 : 0,
      )
      expect(vectorSearch.retrieveMemoryItems).toHaveBeenCalledTimes(
        MEMORY_RETRIEVAL_ENABLED ? 1 : 0,
      )

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(memoryExtraction.extractMemoryCandidates).toHaveBeenCalledTimes(
        MEMORY_EXTRACTION_ENABLED ? 1 : 0,
      )
      expect(memoryExtraction.persistMemoryItems).toHaveBeenCalledTimes(
        MEMORY_EXTRACTION_ENABLED ? 1 : 0,
      )
    },
    60000,
  )
})
