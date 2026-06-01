/**
 * Integration tests for the /api/agent/learning-chat endpoint.
 * Reproduces issue #2294: Chat sends fail with 400 error — Learning Assistant completely broken
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { agentLearningChat } from '@/server/payload/endpoints/agent/learning-chat'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { createTestUser } from '../factories/user.factory'

vi.mock('@/infra/llm/services/exercise-chat-service', () => ({
  streamChatWithExerciseHelper: vi.fn(async () => {
    const stream = (async function* () {
      yield { text: 'Hello' }
      yield { text: ' there!' }
    })()
    return {
      stream,
      response: Promise.resolve({ text: 'Hello there!' }),
    }
  }),
}))

vi.mock('@/infra/llm/vector-index-check', () => ({
  isVectorIndexAvailable: vi.fn(async () => false),
}))

vi.mock('@/infra/llm/vector-search', () => ({
  retrieveMemoryItems: vi.fn(async () => ({
    items: [],
    latencyMs: 0,
    localCount: 0,
    globalCount: 0,
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

// Mock guest session and rate limit services
vi.mock('@/server/services/guest-session', () => ({
  getGuestSessionCookie: vi.fn(() => null),
  getGuestSessionByToken: vi.fn(async () => null),
  createGuestSession: vi.fn(async () => ({ session: null, token: '' })),
  buildGuestSessionCookieHeader: vi.fn(async () => ''),
  checkAndIncrementGuestMessageCount: vi.fn(async () => ({
    allowed: true,
    remaining: 5,
    current: 0,
    max: 5,
  })),
  hashIP: vi.fn(() => ''),
  hashUserAgent: vi.fn(() => ''),
  buildClearGuestSessionCookieHeader: vi.fn(async () => ''),
  clearGuestSessionCookie: vi.fn(),
  setGuestSessionCookie: vi.fn(),
  generateSessionToken: vi.fn(() => 'mock-token'),
  hashToken: vi.fn(() => 'mock-hash'),
  verifyTokenHash: vi.fn(() => false),
  revokeGuestSession: vi.fn(async () => null),
  updateGuestSessionActivity: vi.fn(async () => null),
  GUEST_SESSION_COOKIE_NAME: 'guest_session',
}))

vi.mock('@/server/services/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 10,
    resetAt: Date.now() + 60000,
  })),
  getRateLimitKey: vi.fn(() => 'mock:key'),
  getRemainingRequests: vi.fn(async () => ({
    allowed: true,
    remaining: 10,
    resetAt: Date.now() + 60000,
  })),
  resetRateLimit: vi.fn(),
  clearAllRateLimits: vi.fn(),
  getRateLimitStats: vi.fn(async () => ({ size: 0, maxRequests: 10, windowMs: 60000 })),
}))

let payload: Payload
let originalDatabaseUrl: string | undefined
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
}, 120000)

afterAll(async () => {
  if (payload && testUserId) {
    await payload.delete({ collection: 'users', id: testUserId, overrideAccess: true })
  }

  if (payload?.db?.destroy) {
    await payload.db.destroy()
  }

  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error - TypeScript doesn't allow delete on process.env, but it's safe here
    delete process.env.DATABASE_URL
  }
}, 120000)

describe('agentLearningChat validation', () => {
  it('returns 400 when message is missing', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        acknowledgment: 'Understood',
        conversationId: null,
        gradeLevel: '7',
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentLearningChat(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when acknowledgment is missing', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello',
        conversationId: null,
        gradeLevel: '7',
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentLearningChat(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when gradeLevel is missing', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'Understood',
        conversationId: null,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentLearningChat(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when conversationId is null (issue #2294)', async () => {
    // This test reproduces the bug where sending null for conversationId fails validation
    // The frontend sends conversationId: null when starting a new conversation
    // but the schema expects either undefined (omitted) or a string
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'Understood',
        conversationId: null, // This is the bug - null should be treated as "no conversation"
        gradeLevel: '7',
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentLearningChat(req)
    // This should NOT return 400 - it should handle null conversationId gracefully
    expect(res.status).not.toBe(400)
  })

  it('accepts valid request with string conversationId', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'Understood',
        conversationId: 'existing-conversation-id',
        gradeLevel: '7',
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentLearningChat(req)
    expect(res.status).toBe(200)
  })

  it('accepts valid request with undefined conversationId (first message)', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'Understood',
        gradeLevel: '7',
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentLearningChat(req)
    expect(res.status).toBe(200)
  })
})
