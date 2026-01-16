/**
 * Integration tests for the /api/agent/chat endpoint logic (agentChat).
 *
 * These tests focus on:
 * - Authentication behavior (401 when unauthenticated)
 * - Happy-path chat flow with a real Payload instance
 *   (AI calls and vector search are mocked to avoid external dependencies).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'
import type { Exercise } from '@/payload-types'
import { agentChat } from '@/endpoints/agent/chat'

// Skip tests if DATABASE_URL is not set (e.g., in CI without MongoDB service)
const hasDatabaseUrl = !!process.env.DATABASE_URL

// Mock AI and vector-related services to keep tests deterministic and offline.
vi.mock('@/lib/ai/services/exercise-chat-service', () => ({
  chatWithExerciseHelper: vi.fn(async () => ({
    success: true,
    message: 'Mock assistant response',
  })),
  getSystemPrompt: vi.fn(() => 'You are a helpful assistant.'),
}))

vi.mock('@/lib/ai/vector-index-check', () => ({
  isVectorIndexAvailable: vi.fn(async () => false),
}))

vi.mock('@/lib/ai/vector-search', () => ({
  retrieveMemoryItems: vi.fn(async () => ({
    items: [],
    latencyMs: 0,
    localCount: 0,
    globalCount: 0,
  })),
}))

vi.mock('@/lib/ai/memory-extraction', () => ({
  extractMemoryCandidates: vi.fn(async () => []),
  persistMemoryItems: vi.fn(async () => 0),
}))

vi.mock('@/lib/ai/maintenance', () => ({
  runSummaryMaintenance: vi.fn(async () => ({
    summaryUpdated: false,
    messagesTrimmed: 0,
  })),
}))

let payload: Payload
let testUserId: string
let testExerciseId: string | undefined

beforeAll(
  async () => {
    payload = await getPayload({ config })

    const user = await payload.create({
      collection: 'users',
      data: {
        email: `agent-chat-int-${Date.now()}@example.com`,
        password: 'test123456',
        role: 'student',
      },
    })
    testUserId = user.id

    // Reuse an existing exercise if available; otherwise create a minimal one.
    const existingExercises = await payload.find({
      collection: 'exercises',
      limit: 1,
    })

    if (existingExercises.docs.length > 0) {
      testExerciseId = existingExercises.docs[0].id
    } else {
      const exercise = await payload.create({
        collection: 'exercises',
        data: {
          title: 'Agent Chat Integration Test Exercise',
        } satisfies Partial<Exercise>,
        draft: true,
      })
      testExerciseId = exercise.id
    }
  },
  60000, // Increased timeout for Payload initialization
)

afterAll(async () => {
  if (!payload) return

  if (testUserId) {
    await payload.delete({
      collection: 'users',
      id: testUserId,
    })
  }
}, 30000)

describe.skipIf(!hasDatabaseUrl)('agentChat endpoint', () => {
  it('returns 401 when user is not authenticated', async () => {
    const req = {
      payload,
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'ack-1',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)
    expect(res.status).toBe(401)
  })

  it('processes chat request successfully for authenticated user', async () => {
    if (!testExerciseId) {
      throw new Error('testExerciseId was not initialized')
    }

    const req = {
      payload,
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello, can you help me with this exercise?',
        acknowledgment: 'ack-1',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(typeof body.message).toBe('string')
    expect(body.message).toBe('Mock assistant response')
    expect(body.conversationId).toBeDefined()

    // Verify conversation was created and contains both user and assistant messages.
    const conversation = await payload.findByID({
      collection: 'conversations',
      id: body.conversationId,
    })

    expect(conversation).toBeDefined()
    expect(Array.isArray(conversation.messages)).toBe(true)
    expect(conversation.messages!.length).toBeGreaterThanOrEqual(2)
  }, 60000)
})
