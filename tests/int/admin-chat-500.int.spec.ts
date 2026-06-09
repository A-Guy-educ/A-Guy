/**
 * Repro test for issue #2563: Admin AI chat returns HTTP 500 on message submit.
 *
 * Root cause: handleAdminModeChat calls getMCPClient().listTools() which makes
 * a real HTTP request to /api/mcp. In test environments without a working MCP
 * endpoint, this throws and causes a 500.
 *
 * The fix should ensure the MCP client is properly mocked or that the error
 * is handled gracefully when MCP is unavailable.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { agentChat } from '@/server/payload/endpoints/agent/chat'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import config from '@payload-config'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// Mock AI and vector-related services to keep tests deterministic and offline.
vi.mock('@/infra/llm/services/exercise-chat-service', () => ({
  chatWithExerciseHelper: vi.fn(async () => ({
    success: true,
    message: 'Mock assistant response',
  })),
}))

// Mock Genkit instance to avoid real LLM API calls
vi.mock('@/infra/llm/genkit/genkit-instance', () => ({
  getGenkitInstance: vi.fn(async () => ({
    generate: vi.fn(async () => ({ text: 'Mock response', raw: {}, usage: {} })),
    generateStream: vi.fn(async () => ({
      stream: (async function* () {
        yield { text: 'Mock' }
      })(),
      response: Promise.resolve({ text: 'Mock' }),
    })),
  })),
}))

// Mock Genkit config resolver to avoid model resolution issues
vi.mock('@/infra/llm/genkit/config-resolver', () => ({
  resolveGenkitConfig: vi.fn(async () => ({
    model: 'fake-model' as never,
    temperature: 0.7,
  })),
}))

// Mock LLM provider factory - generateChatCompletionWithTools THROWS to simulate
// production LLM failures (network error, API error, model not found, etc.)
// The bug: this error is NOT caught, causing HTTP 500 instead of graceful fallback
vi.mock('@/infra/llm/providers/factory', () => ({
  getLLMProvider: vi.fn(async () => ({
    generateChatCompletion: vi.fn(async () => ({
      text: 'Mock',
      raw: {},
      toolCalls: [],
      usage: {},
    })),
    generateChatCompletionWithTools: vi.fn(async () => {
      throw new Error('LLM API error: Model not found or quota exceeded')
    }),
    generateStreamingChatCompletion: vi.fn(async () => ({ stream: {} as never, raw: {} })),
    isConfigured: vi.fn(async () => true),
  })),
  getProviderModelConfig: vi.fn(async () => ({ name: 'fake-model', modelKey: 'EXERCISE_CHAT' })),
  detectBestProvider: vi.fn(async () => 'gemini' as never),
  getProviderTypeFromEnv: vi.fn(async () => 'gemini' as never),
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
  buildClearGuestSessionCookieHeader: vi.fn(() => ''),
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

// Mock MCP client returning tools (triggers tool-calling path in handleAdminModeChat)
vi.mock('@/server/repos/mcp/client/mcp-client', () => ({
  getMCPClient: vi.fn(() => ({
    listTools: vi.fn(async () => [
      {
        name: 'findCourses',
        description: 'Find courses in the database',
        inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
      },
    ]),
    callTool: vi.fn(async () => ({ content: [] })),
  })),
}))

let payload: Payload
let adminUserId: string
let originalDatabaseUrl: string | undefined

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error - TypeScript doesn't allow delete on process.env, but it's safe here
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const cfg = await import('@payload-config')
  payload = await getPayload({ config: cfg.default })

  // Create admin user
  const adminUser = await payload.create({
    collection: 'users',
    data: {
      email: `admin-chat-int-${Date.now()}@example.com`,
      password: 'test123456',
      role: 'admin',
    },
  })
  adminUserId = adminUser.id
}, 120000)

afterAll(async () => {
  if (!payload) return

  if (adminUserId) {
    await payload.delete({
      collection: 'users',
      id: adminUserId,
    })
  }

  if (payload.db?.destroy) {
    await payload.db.destroy()
  }

  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error - TypeScript doesn't allow delete on process.env, but it's safe here
    delete process.env.DATABASE_URL
  }
}, 60000)

describe('admin chat - issue #2563', () => {
  it('admin chat with adminMode=true returns 200 even when MCP endpoint is unavailable', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: { id: adminUserId, role: 'admin' } as PayloadRequest['user'],
      json: async () => ({
        message: 'What courses do we have?',
        acknowledgment: 'Understood.',
        adminMode: true,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)

    // Expected: 200 with success=true
    // Bug: returns 500 due to unhandled error in handleAdminModeChat
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.conversationId).toBeDefined()
  })

  it('admin chat without adminMode but as admin returns 200', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: { id: adminUserId, role: 'admin' } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello admin',
        acknowledgment: 'Understood.',
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)

    // Without adminMode and without context, should return 400
    expect(res.status).toBe(400)
  })
})
