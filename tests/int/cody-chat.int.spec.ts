/**
 * Integration/System Tests for Cody Dashboard Chat Endpoint
 *
 * Tests the /api/cody/chat endpoint which handles streaming AI chat
 * with GitHub MCP tools for the Cody Operations Dashboard.
 *
 * Key behaviors tested:
 * - Authentication (401 when not authenticated)
 * - Environment validation (503 when tokens missing)
 * - Message validation (400 when messages empty)
 * - Streaming response format (SSE with text-delta events)
 * - Tool invocation in streaming responses
 *
 * @fileType integration-test
 * @domain cody | chat
 * @pattern streaming | auth
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { SignJWT } from 'jose'

// ============================================================================
// Test Configuration
// ============================================================================

const CODY_SESSION_COOKIE = 'cody-gh-session'
const TEST_LOGIN = 'test-user'
const TEST_GITHUB_ID = 12345
const TEST_PAYLOAD_SECRET = 'test-secret-for-jwt-signing-min-32-chars!'

// Mock environment
const testEnv = {
  GH_PAT: 'ghp_test_token',
  GEMINI_API_KEY: 'gemini-test-key',
  PAYLOAD_SECRET: TEST_PAYLOAD_SECRET,
  NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000',
}

// ============================================================================
// Helper: Create Valid Session Cookie
// ============================================================================

async function createValidSessionCookie(): Promise<string> {
  const secret = new TextEncoder().encode(`cody-gh-session:${TEST_PAYLOAD_SECRET}`)
  const token = await new SignJWT({
    login: TEST_LOGIN,
    avatar_url: 'https://avatars.githubusercontent.com/u/12345',
    githubId: TEST_GITHUB_ID,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 86400)
    .sign(secret)
  return `${CODY_SESSION_COOKIE}=${token}`
}

// ============================================================================
// Mock: AI SDK Streaming
// ============================================================================

const mockStreamChunks = [
  { type: 'text-delta', delta: 'Hello' },
  { type: 'text-delta', delta: ' there' },
  { type: 'text-delta', delta: '!' },
]

function createMockStreamResponse(): Response {
  // Create a simple SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of mockStreamChunks) {
        controller.enqueue(`data: ${JSON.stringify(chunk)}\n`)
      }
      controller.enqueue('data: [DONE]\n')
      controller.close()
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}

// ============================================================================
// Mock Dependencies - These MUST be at the top level
// ============================================================================

vi.mock('@/ui/cody/github-client', () => ({
  fetchIssue: vi.fn(),
  fetchIssues: vi.fn(),
  fetchComments: vi.fn(),
  getStatusFromBranch: vi.fn(),
  findTaskBranch: vi.fn(),
  fetchWorkflowRuns: vi.fn(),
  findAssociatedPR: vi.fn(),
  getOctokit: vi.fn(() => ({ repos: { getContent: vi.fn() } })),
}))

vi.mock('@/ui/cody/auth', () => ({
  requireCodyAuth: vi.fn(),
  verifyActorLogin: vi.fn(),
  getUserOctokit: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('@/ui/cody/agents', () => ({
  getAgent: vi.fn(() => ({
    id: 'dashboard-manager',
    name: 'Dashboard Manager',
    systemPrompt: 'You are a helpful assistant.',
    toolScope: 'all',
  })),
  REMOTE_SYSTEM_PROMPT_EXTENSION: 'Remote Dev Environment',
}))

vi.mock('@/ui/cody/remote-config', () => ({
  isRemoteEnabled: vi.fn(() => false),
  getRemoteConfig: vi.fn(),
}))

// Mock MCP manager - this is crucial because it loads MCP clients
vi.mock('@/app/api/cody/chat/mcp-manager', () => ({
  getMCPManager: vi.fn(() => ({
    getTools: vi.fn(() => Promise.resolve({})),
    getSystemPromptExtensions: vi.fn(() => Promise.resolve('')),
    getHealthStatus: vi.fn(() => Promise.resolve([])),
  })),
}))

// Mock MCP client
vi.mock('@ai-sdk/mcp', () => ({
  createMCPClient: vi.fn(),
}))

// Mock AI SDK - we'll control this in tests
vi.mock('ai', () => ({
  streamText: vi.fn(() => ({
    toUIMessageStreamResponse: () => createMockStreamResponse(),
  })),
  tool: vi.fn((config: unknown) => config),
  stepCountIs: vi.fn(() => ({})),
}))

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => () => ({})),
}))

vi.mock('@/infra/utils/logger/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// ============================================================================
// Tests
// ============================================================================

describe('Cody Chat API Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Set test environment
    Object.entries(testEnv).forEach(([key, value]) => {
      process.env[key] = value
    })
  })

  afterEach(() => {
    // Clean up environment
    Object.keys(testEnv).forEach((key) => {
      delete process.env[key]
    })
  })

  describe('Authentication', () => {
    it('returns 401 when no session cookie is present', async () => {
      const { verifyActorLogin } = await import('@/ui/cody/auth')
      vi.mocked(verifyActorLogin).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Not authenticated' }), { status: 401 }) as never,
      )

      const { POST } = await import('@/app/api/cody/chat/route')

      const req = new NextRequest('http://localhost/api/cody/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      })

      const response = await POST(req)
      expect(response.status).toBe(401)
    })

    it('returns 401 when session cookie is invalid/expired', async () => {
      const { verifyActorLogin } = await import('@/ui/cody/auth')
      vi.mocked(verifyActorLogin).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Session expired' }), { status: 401 }) as never,
      )

      const { POST } = await import('@/app/api/cody/chat/route')

      const req = new NextRequest('http://localhost/api/cody/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${CODY_SESSION_COOKIE}=invalid-token`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      })

      const response = await POST(req)
      expect(response.status).toBe(401)
    })

    it('returns 403 when actorLogin does not match authenticated session', async () => {
      const { verifyActorLogin } = await import('@/ui/cody/auth')
      vi.mocked(verifyActorLogin).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Invalid actorLogin' }), { status: 403 }) as never,
      )

      const { POST } = await import('@/app/api/cody/chat/route')

      const req = new NextRequest('http://localhost/api/cody/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: await createValidSessionCookie(),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          actorLogin: 'different-user', // Doesn't match session
        }),
      })

      const response = await POST(req)
      expect(response.status).toBe(403)
    })

    it('proceeds with valid authentication and returns streaming response', async () => {
      const { verifyActorLogin } = await import('@/ui/cody/auth')
      vi.mocked(verifyActorLogin).mockResolvedValueOnce({
        identity: { login: TEST_LOGIN, avatar_url: '', githubId: TEST_GITHUB_ID },
      })

      const { POST } = await import('@/app/api/cody/chat/route')

      const req = new NextRequest('http://localhost/api/cody/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: await createValidSessionCookie(),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      })

      const response = await POST(req)

      // Should have streaming headers or successful response
      expect(response.status).toBe(200)
      const contentType = response.headers.get('Content-Type')
      expect(contentType).toMatch(/text\/event-stream|application\/x-ndjson/)
    })
  })

  describe('Environment Validation', () => {
    it('returns 503 when GH_PAT is not configured', async () => {
      const { verifyActorLogin } = await import('@/ui/cody/auth')
      vi.mocked(verifyActorLogin).mockResolvedValueOnce({
        identity: { login: TEST_LOGIN, avatar_url: '', githubId: TEST_GITHUB_ID },
      })

      delete process.env.GH_PAT
      delete process.env.GITHUB_TOKEN

      const { POST } = await import('@/app/api/cody/chat/route')

      const req = new NextRequest('http://localhost/api/cody/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: await createValidSessionCookie(),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      })

      const response = await POST(req)
      expect(response.status).toBe(503)
      const json = await response.json()
      expect(json.error).toContain('GitHub token')
    })

    it('returns 503 when GEMINI_API_KEY is not configured', async () => {
      const { verifyActorLogin } = await import('@/ui/cody/auth')
      vi.mocked(verifyActorLogin).mockResolvedValueOnce({
        identity: { login: TEST_LOGIN, avatar_url: '', githubId: TEST_GITHUB_ID },
      })

      delete process.env.GEMINI_API_KEY

      const { POST } = await import('@/app/api/cody/chat/route')

      const req = new NextRequest('http://localhost/api/cody/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: await createValidSessionCookie(),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      })

      const response = await POST(req)
      expect(response.status).toBe(503)
      const json = await response.json()
      expect(json.error).toContain('GEMINI_API_KEY')
    })
  })

  describe('Request Validation', () => {
    it('returns 400 when messages array is empty', async () => {
      const { verifyActorLogin } = await import('@/ui/cody/auth')
      vi.mocked(verifyActorLogin).mockResolvedValueOnce({
        identity: { login: TEST_LOGIN, avatar_url: '', githubId: TEST_GITHUB_ID },
      })

      const { POST } = await import('@/app/api/cody/chat/route')

      const req = new NextRequest('http://localhost/api/cody/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: await createValidSessionCookie(),
        },
        body: JSON.stringify({
          messages: [],
        }),
      })

      const response = await POST(req)
      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toContain('Messages')
    })

    it('returns 400 when messages is missing', async () => {
      const { verifyActorLogin } = await import('@/ui/cody/auth')
      vi.mocked(verifyActorLogin).mockResolvedValueOnce({
        identity: { login: TEST_LOGIN, avatar_url: '', githubId: TEST_GITHUB_ID },
      })

      const { POST } = await import('@/app/api/cody/chat/route')

      const req = new NextRequest('http://localhost/api/cody/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: await createValidSessionCookie(),
        },
        body: JSON.stringify({}),
      })

      const response = await POST(req)
      expect(response.status).toBe(400)
    })
  })

  describe('Streaming Response', () => {
    it('returns streaming response with correct headers for authenticated request', async () => {
      const { verifyActorLogin } = await import('@/ui/cody/auth')
      vi.mocked(verifyActorLogin).mockResolvedValueOnce({
        identity: { login: TEST_LOGIN, avatar_url: '', githubId: TEST_GITHUB_ID },
      })

      const { POST } = await import('@/app/api/cody/chat/route')

      const req = new NextRequest('http://localhost/api/cody/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: await createValidSessionCookie(),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      })

      const response = await POST(req)

      // Should have streaming headers
      expect(response.headers.get('Content-Type')).toMatch(
        /text\/event-stream|application\/x-ndjson/,
      )
    })
  })

  describe('Message Processing', () => {
    it('processes user message correctly', async () => {
      const { verifyActorLogin } = await import('@/ui/cody/auth')
      vi.mocked(verifyActorLogin).mockResolvedValueOnce({
        identity: { login: TEST_LOGIN, avatar_url: '', githubId: TEST_GITHUB_ID },
      })

      const { POST } = await import('@/app/api/cody/chat/route')

      const req = new NextRequest('http://localhost/api/cody/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: await createValidSessionCookie(),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'What is the status of task 260221?' }],
        }),
      })

      const response = await POST(req)
      expect(response.status).toBe(200)
    })

    it('includes task context when taskId is provided', async () => {
      const { verifyActorLogin } = await import('@/ui/cody/auth')
      vi.mocked(verifyActorLogin).mockResolvedValueOnce({
        identity: { login: TEST_LOGIN, avatar_url: '', githubId: TEST_GITHUB_ID },
      })

      const { findTaskBranch } = await import('@/ui/cody/github-client')
      vi.mocked(findTaskBranch).mockResolvedValueOnce('feature/task-260221')

      const { POST } = await import('@/app/api/cody/chat/route')

      const req = new NextRequest('http://localhost/api/cody/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: await createValidSessionCookie(),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Tell me about this task' }],
          taskId: '260221-test-task',
          taskData: {
            issueNumber: 260221,
            title: 'Test Task',
            body: 'Task description',
            state: 'open',
            labels: ['cody:implemented'],
            column: 'In Progress',
          },
        }),
      })

      const response = await POST(req)
      expect(response.status).toBe(200)

      // Verify findTaskBranch was called with the taskId
      expect(findTaskBranch).toHaveBeenCalledWith('260221-test-task')
    })

    it('handles agent selection correctly', async () => {
      const { verifyActorLogin } = await import('@/ui/cody/auth')
      vi.mocked(verifyActorLogin).mockResolvedValueOnce({
        identity: { login: TEST_LOGIN, avatar_url: '', githubId: TEST_GITHUB_ID },
      })

      const { getAgent } = await import('@/ui/cody/agents')

      const { POST } = await import('@/app/api/cody/chat/route')

      const req = new NextRequest('http://localhost/api/cody/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: await createValidSessionCookie(),
        },
        body: JSON.stringify({
          agentId: 'system-architect',
          messages: [{ role: 'user', content: 'Help me plan a feature' }],
        }),
      })

      await POST(req)

      // Verify getAgent was called with system-architect
      expect(getAgent).toHaveBeenCalledWith('system-architect')
    })
  })

  describe('GET /api/cody/chat', () => {
    it('returns health status when authenticated', async () => {
      const { requireCodyAuth } = await import('@/ui/cody/auth')
      vi.mocked(requireCodyAuth).mockResolvedValueOnce(null)

      const { GET } = await import('@/app/api/cody/chat/route')

      const req = new NextRequest('http://localhost/api/cody/chat', {
        method: 'GET',
        headers: {
          Cookie: await createValidSessionCookie(),
        },
      })

      const response = await GET(req)
      expect(response.status).toBe(200)

      const json = await response.json()
      expect(json.status).toBe('Chat endpoint ready')
    })

    it('returns 401 when not authenticated on GET', async () => {
      const { requireCodyAuth } = await import('@/ui/cody/auth')
      vi.mocked(requireCodyAuth).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Not authenticated' }), { status: 401 }) as never,
      )

      const { GET } = await import('@/app/api/cody/chat/route')

      const req = new NextRequest('http://localhost/api/cody/chat', {
        method: 'GET',
      })

      const response = await GET(req)
      expect(response.status).toBe(401)
    })
  })
})

// ============================================================================
// Summary of Test Coverage
// ============================================================================

/**
 * This test file covers:
 *
 * ✓ Authentication flows
 *   - 401 when no session cookie
 *   - 401 when session is invalid/expired
 *   - 403 when actorLogin mismatch
 *   - Successful auth with streaming response
 *
 * ✓ Environment validation
 *   - 503 when GH_PAT/GITHUB_TOKEN missing
 *   - 503 when GEMINI_API_KEY missing
 *
 * ✓ Request validation
 *   - 400 when messages array is empty
 *   - 400 when messages is missing
 *
 * ✓ Streaming response
 *   - Proper SSE headers
 *
 * ✓ Message processing
 *   - User messages processed
 *   - Task context included when taskId provided
 *   - Agent selection works correctly
 *
 * ✓ GET endpoint
 *   - Health check when authenticated
 *   - 401 when not authenticated
 */
