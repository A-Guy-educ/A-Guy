/**
 * Unit Tests for Approve Gate Fallback Logic
 *
 * Tests the /api/cody/tasks/[taskId]/actions route that handles the 'approve' action.
 * When the user's token fails with 401/403, the route should fall back to the bot token
 * and add actor attribution to the comment.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Mock the github-client module
vi.mock('@/ui/cody/github-client', () => ({
  postComment: vi.fn().mockResolvedValue(undefined),
  getOctokit: vi.fn(() => ({
    issues: { createComment: vi.fn().mockResolvedValue(undefined) },
  })),
}))

vi.mock('@/ui/cody/auth', () => ({
  requireCodyAuth: vi.fn(() => null),
  verifyActorLogin: vi.fn(() => ({
    identity: { login: 'testuser', id: 1, avatar_url: 'https://example.com/avatar.png' },
  })),
  getUserOctokit: vi.fn(),
}))

vi.mock('@/infra/utils/logger/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Import after mocks
import { NextRequest } from 'next/server'
import { postComment } from '@/ui/cody/github-client'
import { getUserOctokit } from '@/ui/cody/auth'

describe('POST /api/cody/tasks/[taskId]/actions - Approve Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(postComment).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('should use user token when available and working', async () => {
    // Setup: user token works - create a mock that returns a user Octokit
    const mockUserOctokit = {
      issues: { createComment: vi.fn().mockResolvedValue(undefined) },
    }
    vi.mocked(getUserOctokit).mockReturnValue(Promise.resolve(mockUserOctokit as never))

    // Import and call the route handler
    const { POST } = await import('@/app/api/cody/tasks/[taskId]/actions/route')

    const request = new NextRequest('http://localhost/api/cody/tasks/issue-822/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
    })

    const params = Promise.resolve({ taskId: 'issue-822' })
    const response = await POST(request, { params })
    const body = await response.json()

    // Verify: user token was used (postComment called with userOctokit)
    expect(postComment).toHaveBeenCalledWith(822, '/cody approve', mockUserOctokit)
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toBe('Gate approved')
  })

  it('should use bot token with attribution when no user token', async () => {
    // Setup: no user token (legacy session)
    vi.mocked(getUserOctokit).mockReturnValue(Promise.resolve(null))

    // Import and call the route handler
    const { POST } = await import('@/app/api/cody/tasks/[taskId]/actions/route')

    const request = new NextRequest('http://localhost/api/cody/tasks/issue-822/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
    })

    const params = Promise.resolve({ taskId: 'issue-822' })
    const response = await POST(request, { params })
    const body = await response.json()

    // Verify: bot token used with actor attribution (no user token, so uses withActor)
    expect(postComment).toHaveBeenCalledWith(822, '/cody approve _(by @testuser)_')

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })
})
