import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { ObjectId } from 'mongodb'
import { agentChat } from '@/endpoints/agent/chat'
import { startMongoContainer, stopMongoContainer } from '@/utilities/test/mongodb-container'
import { createContextHierarchy } from '../factories/context.factory'
import { createTestUser } from '../factories/user.factory'

vi.mock('@/infra/llm/services/exercise-chat-service', () => ({
  chatWithExerciseHelper: vi.fn(async () => ({
    success: true,
    message: 'Mock assistant response',
  })),
  getSystemPrompt: vi.fn(() => 'You are a helpful assistant.'),
}))

vi.mock('@/infra/llm/vector-index-check', () => ({
  isVectorIndexAvailable: vi.fn(async () => false),
}))

vi.mock('@/infra/llm/vector-search', () => ({
  retrieveMemoryItems: vi.fn(async () => ({
    items: [],
    latencyMs: 0,
    localCount: 0,
    contextCount: 0,
    globalCount: 0,
    hierarchyKeys: [],
  })),
}))

vi.mock('@/infra/llm/memory-extraction', () => ({
  extractMemoryCandidates: vi.fn(async () => []),
  persistMemoryItems: vi.fn(async () => 0),
}))

vi.mock('@/infra/llm/maintenance', () => ({
  runSummaryMaintenance: vi.fn(async () => ({
    summaryUpdated: false,
    messagesTrimmed: 0,
  })),
}))

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

describe('agentChat validation', () => {
  it('returns 400 for missing message', async () => {
    const req = {
      payload,
      user: { id: testUserId, role: 'student' } as PayloadRequest['user'],
      json: async () => ({
        message: '',
        acknowledgment: 'ack',
        exerciseId: context.exerciseId,
      }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for message length over 1000 chars', async () => {
    const req = {
      payload,
      user: { id: testUserId, role: 'student' } as PayloadRequest['user'],
      json: async () => ({
        message: 'a'.repeat(1001),
        acknowledgment: 'ack',
        exerciseId: context.exerciseId,
      }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when acknowledgment is missing', async () => {
    const req = {
      payload,
      user: { id: testUserId, role: 'student' } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello',
        exerciseId: context.exerciseId,
      }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when no context IDs are provided', async () => {
    const req = {
      payload,
      user: { id: testUserId, role: 'student' } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'ack',
      }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 404 for non-existent context IDs', async () => {
    const req = {
      payload,
      user: { id: testUserId, role: 'student' } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'ack',
        exerciseId: new ObjectId().toHexString(),
      }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)
    expect(res.status).toBe(404)

    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})
