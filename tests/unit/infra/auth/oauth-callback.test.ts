/**
 * Unit tests for GitHub OAuth callback route
 *
 * Tests that:
 * 1. Collaborator check uses bot token (not user token) — admin access required
 * 2. Session stores encrypted GitHub access token
 * 3. Non-collaborators are rejected
 * 4. Login succeeds for valid collaborators
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/infra/auth/oauth_state', () => ({
  validateOAuthState: vi.fn(() => ({ valid: true, returnTo: '/cody' })),
}))

vi.mock('@/infra/auth/oauth_url', () => ({
  getPublicBaseUrl: vi.fn(() => 'http://localhost:3000'),
}))

vi.mock('@/infra/auth/cody_session', () => ({
  createCodySession: vi.fn(),
}))

vi.mock('@/ui/cody/constants', () => ({
  GITHUB_OWNER: 'test-owner',
  GITHUB_REPO: 'test-repo',
}))

vi.mock('@/infra/utils/logger/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('GitHub OAuth Callback', () => {
  const USER_TOKEN = 'gho_user_access_token_abc123'
  const BOT_TOKEN = 'ghp_bot_token_xyz789'

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.GITHUB_APP_CLIENT_ID = 'test-client-id'
    process.env.GITHUB_APP_CLIENT_SECRET = 'test-client-secret'
    process.env.CODY_BOT_TOKEN = BOT_TOKEN
    process.env.PAYLOAD_SECRET = 'test-payload-secret-for-unit-tests'
  })

  afterEach(() => {
    process.env.GITHUB_APP_CLIENT_ID = undefined as unknown as string
    process.env.GITHUB_APP_CLIENT_SECRET = undefined as unknown as string
    process.env.CODY_BOT_TOKEN = undefined as unknown as string
    process.env.PAYLOAD_SECRET = undefined as unknown as string
  })

  function createCallbackRequest() {
    return new NextRequest(
      'http://localhost:3000/api/oauth/github/callback?code=test-code&state=test-state',
    )
  }

  function setupMockFetch(options: { collabStatus?: number; collabToken?: string }) {
    const capturedCollabAuth: string[] = []

    mockFetch.mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url)

      // Token exchange
      if (urlStr.includes('login/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: USER_TOKEN }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // User profile
      if (urlStr === 'https://api.github.com/user') {
        return new Response(
          JSON.stringify({
            id: 12345,
            login: 'testuser',
            avatar_url: 'https://github.com/testuser.png',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // Collaborator check — capture the auth header
      if (urlStr.includes('/collaborators/')) {
        const authHeader = (init?.headers as Record<string, string>)?.Authorization ?? ''
        capturedCollabAuth.push(authHeader)
        return new Response(null, { status: options.collabStatus ?? 204 })
      }

      return new Response('Not Found', { status: 404 })
    })

    return { capturedCollabAuth }
  }

  it('uses bot token (not user token) for collaborator check', async () => {
    const { capturedCollabAuth } = setupMockFetch({ collabStatus: 204 })
    const { GET } = await import('@/app/api/oauth/github/callback/route')

    await GET(createCallbackRequest())

    // The collaborator check should use the bot token
    expect(capturedCollabAuth).toHaveLength(1)
    expect(capturedCollabAuth[0]).toBe(`Bearer ${BOT_TOKEN}`)
    expect(capturedCollabAuth[0]).not.toContain(USER_TOKEN)
  })

  it('passes user access token to createCodySession', async () => {
    setupMockFetch({ collabStatus: 204 })
    const { GET } = await import('@/app/api/oauth/github/callback/route')
    const { createCodySession } = await import('@/infra/auth/cody_session')

    await GET(createCallbackRequest())

    // createCodySession should receive the user's access token (3rd arg)
    expect(createCodySession).toHaveBeenCalledWith(
      expect.anything(), // response
      expect.objectContaining({
        login: 'testuser',
        avatar_url: 'https://github.com/testuser.png',
        githubId: 12345,
      }),
      USER_TOKEN,
    )
  })

  it('rejects non-collaborators (404 from collaborator check)', async () => {
    setupMockFetch({ collabStatus: 404 })
    const { GET } = await import('@/app/api/oauth/github/callback/route')

    const response = await GET(createCallbackRequest())

    expect(response.status).toBe(302)
    const location = response.headers.get('Location') ?? ''
    expect(location).toContain('error=not_collaborator')
  })

  it('rejects when user gets 403 from collaborator endpoint', async () => {
    setupMockFetch({ collabStatus: 403 })
    const { GET } = await import('@/app/api/oauth/github/callback/route')

    const response = await GET(createCallbackRequest())

    expect(response.status).toBe(302)
    const location = response.headers.get('Location') ?? ''
    expect(location).toContain('error=not_collaborator')
  })

  it('redirects to /cody on successful login', async () => {
    setupMockFetch({ collabStatus: 204 })
    const { GET } = await import('@/app/api/oauth/github/callback/route')

    const response = await GET(createCallbackRequest())

    expect(response.status).toBe(302)
    const location = response.headers.get('Location') ?? ''
    expect(location).toBe('/cody')
  })

  it('fails when no bot token is configured', async () => {
    // Save original values (dotenv may have set these from .env)
    const savedBot = process.env.CODY_BOT_TOKEN
    const savedGH = process.env.GITHUB_TOKEN
    try {
      // Must actually delete — setting to undefined still leaves the key
      delete (process.env as Record<string, string | undefined>).CODY_BOT_TOKEN
      delete (process.env as Record<string, string | undefined>).GITHUB_TOKEN

      setupMockFetch({ collabStatus: 204 })
      const { GET } = await import('@/app/api/oauth/github/callback/route')

      const response = await GET(createCallbackRequest())

      expect(response.status).toBe(302)
      const location = response.headers.get('Location') ?? ''
      expect(location).toContain('error=not_configured')
    } finally {
      // Restore
      if (savedBot) process.env.CODY_BOT_TOKEN = savedBot
      if (savedGH) process.env.GITHUB_TOKEN = savedGH
    }
  })
})
