/**
 * Integration tests for the /api/agent/learning-chat endpoint.
 *
 * Tests focus on:
 * - 400 error when conversationId is sent as null (the bug: null fails Zod optional validation)
 * - 400 error when gradeLevel is missing
 * - 400 error when message is missing
 * - 200 when conversationId is omitted (correct first-message behavior)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { agentLearningChat } from '@/server/payload/endpoints/agent/learning-chat'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { createTestUser } from '../factories/user.factory'

// Mock AI services
vi.mock('@/infra/llm/services/exercise-chat-service', () => ({
  streamChatWithExerciseHelper: vi.fn(async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('Mock response'))
        controller.close()
      },
    })
    return { stream, response: Promise.resolve({ text: 'Mock response' }) }
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

vi.mock('@/server/services/agent-behavior-prompt-resolver', () => ({
  resolveAgentBehaviorPrompt: vi.fn(async () => ({
    profileSlug: 'default',
    resolvedFrom: 'fallback',
    promptText: 'You are a helpful assistant.',
  })),
  buildAgentBehaviorBlock: vi.fn(() => '## Agent Behavior\nYou are helpful.'),
}))

vi.mock('@/server/services/user-learning-context', () => ({
  fetchUserLearningContext: vi.fn(async () => ({
    activeCourses: [],
    completedLessons: 0,
    currentStreak: 0,
    recommendedLessons: [],
  })),
  buildUserContextBlock: vi.fn(() => '## User Context\nUser is logged in.'),
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
  clearRateLimits: vi.fn(),
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
  it('returns 400 when conversationId is sent as null (the bug: null fails Zod optional validation)', async () => {
    // This is the exact request body that AgentChatWindow sends when conversationId is null
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello, what can you help me with?',
        acknowledgment: 'Understood',
        conversationId: null as unknown as string | undefined,
        gradeLevel: '7',
      }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentLearningChat(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toMatch(/invalid request body/i)
    // The specific Zod error about conversationId receiving null
    expect(body.details).toBeDefined()
    const conversationIdError = body.details?.find(
      (e: { path: string[]; message: string }) =>
        e.path.includes('conversationId') && e.message.includes('null'),
    )
    expect(conversationIdError).toBeDefined()
  })

  it('returns 200 when conversationId is omitted (correct first-message behavior)', async () => {
    // This is the fixed request body: conversationId is not sent at all
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello, what can you help me with?',
        acknowledgment: 'Understood',
        gradeLevel: '7',
      }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentLearningChat(req)
    // Should succeed - creates a new conversation
    expect(res.status).toBe(200)
  })

  it('returns 400 when gradeLevel is missing', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'Understood',
      }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentLearningChat(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when message is missing', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        acknowledgment: 'Understood',
        gradeLevel: '7',
      }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentLearningChat(req)
    expect(res.status).toBe(400)
  })

  it('returns 401 when user is not authenticated', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: null,
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'Understood',
        gradeLevel: '7',
      }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentLearningChat(req)
    expect(res.status).toBe(401)
  })
})
