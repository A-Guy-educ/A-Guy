/**
 * Unit Tests for Cody Chat Save API Route
 *
 * Tests the /api/cody/chat/save route that saves chat history to GitHub.
 * Key behaviors tested:
 * - Validation of request body
 * - Dedup: skip commit when content is unchanged
 * - Commit when content is different
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock the github-client module
vi.mock('@/ui/cody/github-client', () => ({
  findTaskBranch: vi.fn(),
  getOctokit: vi.fn(),
}))

vi.mock('@/ui/cody/auth', () => ({
  requireCodyAuth: vi.fn(() => null), // Skip auth for tests
}))

vi.mock('@/ui/cody/constants', () => ({
  GITHUB_OWNER: 'test-owner',
  GITHUB_REPO: 'test-repo',
  TASK_ID_REGEX: /^\d{6}-[\w-]+$/,
}))

// Import after mocks
import { NextRequest } from 'next/server'
import { findTaskBranch, getOctokit } from '@/ui/cody/github-client'

describe('POST /api/cody/chat/save - Chat Save Route', () => {
  let mockOctokit: {
    repos: {
      getContent: ReturnType<typeof vi.fn>
      createOrUpdateFileContents: ReturnType<typeof vi.fn>
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock octokit
    mockOctokit = {
      repos: {
        getContent: vi.fn(),
        createOrUpdateFileContents: vi.fn(),
      },
    }
    vi.mocked(getOctokit).mockReturnValue(mockOctokit as any)
  })

  describe('validation', () => {
    it('rejects missing taskId', async () => {
      const { POST } = await import('@/app/api/cody/chat/save/route')

      const body = { messages: [] }
      const req = new NextRequest('http://localhost/api/cody/chat/save', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await POST(req)
      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toContain('taskId')
    })

    it('rejects invalid taskId format', async () => {
      const { POST } = await import('@/app/api/cody/chat/save/route')

      const body = { taskId: 'invalid', messages: [] }
      const req = new NextRequest('http://localhost/api/cody/chat/save', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await POST(req)
      expect(response.status).toBe(400)
    })

    it('rejects messages with invalid role', async () => {
      const { POST } = await import('@/app/api/cody/chat/save/route')

      const body = {
        taskId: '260301-test',
        messages: [{ role: 'invalid', text: 'hello' }],
      }
      const req = new NextRequest('http://localhost/api/cody/chat/save', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await POST(req)
      expect(response.status).toBe(400)
    })

    it('accepts valid request', async () => {
      vi.mocked(findTaskBranch).mockResolvedValue('feature/test-branch')
      vi.mocked(mockOctokit.repos.getContent).mockRejectedValue({ status: 404 })
      vi.mocked(mockOctokit.repos.createOrUpdateFileContents).mockResolvedValue({
        content: { name: 'chat.json' },
      } as any)

      const { POST } = await import('@/app/api/cody/chat/save/route')

      const body = {
        taskId: '260301-test',
        messages: [{ role: 'user', text: 'hello' }],
      }
      const req = new NextRequest('http://localhost/api/cody/chat/save', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await POST(req)
      expect(response.status).toBe(200)
    })
  })

  describe('deduplication', () => {
    it('should skip commit when content is unchanged', async () => {
      const existingChat = {
        version: 1,
        taskId: '260301-test',
        sessions: [
          {
            stage: 'dashboard',
            startedAt: '2026-03-14T10:00:00.000Z',
            messages: [{ role: 'user', text: 'hello', timestamp: '2026-03-14T10:00:01.000Z' }],
          },
        ],
      }
      const existingContent = Buffer.from(JSON.stringify(existingChat, null, 2)).toString('base64')

      vi.mocked(findTaskBranch).mockResolvedValue('feature/test-branch')
      vi.mocked(mockOctokit.repos.getContent).mockResolvedValue({
        data: {
          content: existingContent,
          sha: 'abc123',
        },
      } as any)

      const { POST } = await import('@/app/api/cody/chat/save/route')

      // Send same messages - content should be identical
      const body = {
        taskId: '260301-test',
        messages: [{ role: 'user', text: 'hello', timestamp: '2026-03-14T10:00:01.000Z' }],
      }
      const req = new NextRequest('http://localhost/api/cody/chat/save', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await POST(req)
      expect(response.status).toBe(200)

      const json = await response.json()
      expect(json.unchanged).toBe(true)

      // Should NOT call createOrUpdateFileContents
      expect(mockOctokit.repos.createOrUpdateFileContents).not.toHaveBeenCalled()
    })

    it('should commit when content is different', async () => {
      const existingChat = {
        version: 1,
        taskId: '260301-test',
        sessions: [
          {
            stage: 'dashboard',
            startedAt: '2026-03-14T10:00:00.000Z',
            messages: [{ role: 'user', text: 'hello', timestamp: '2026-03-14T10:00:01.000Z' }],
          },
        ],
      }
      const existingContent = Buffer.from(JSON.stringify(existingChat, null, 2)).toString('base64')

      vi.mocked(findTaskBranch).mockResolvedValue('feature/test-branch')
      vi.mocked(mockOctokit.repos.getContent).mockResolvedValue({
        data: {
          content: existingContent,
          sha: 'abc123',
        },
      } as any)
      vi.mocked(mockOctokit.repos.createOrUpdateFileContents).mockResolvedValue({
        content: { name: 'chat.json' },
      } as any)

      const { POST } = await import('@/app/api/cody/chat/save/route')

      // Send different message - content should differ
      const body = {
        taskId: '260301-test',
        messages: [
          { role: 'user', text: 'hello', timestamp: '2026-03-14T10:00:01.000Z' },
          { role: 'assistant', text: 'hi there', timestamp: '2026-03-14T10:00:02.000Z' },
        ],
      }
      const req = new NextRequest('http://localhost/api/cody/chat/save', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await POST(req)
      expect(response.status).toBe(200)

      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.unchanged).toBeUndefined()

      // Should call createOrUpdateFileContents
      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalled()
    })

    it('should commit when only timestamp differs (new message)', async () => {
      const existingChat = {
        version: 1,
        taskId: '260301-test',
        sessions: [
          {
            stage: 'dashboard',
            startedAt: '2026-03-14T10:00:00.000Z',
            messages: [{ role: 'user', text: 'hello', timestamp: '2026-03-14T10:00:01.000Z' }],
          },
        ],
      }
      const existingContent = Buffer.from(JSON.stringify(existingChat, null, 2)).toString('base64')

      vi.mocked(findTaskBranch).mockResolvedValue('feature/test-branch')
      vi.mocked(mockOctokit.repos.getContent).mockResolvedValue({
        data: {
          content: existingContent,
          sha: 'abc123',
        },
      } as any)
      vi.mocked(mockOctokit.repos.createOrUpdateFileContents).mockResolvedValue({
        content: { name: 'chat.json' },
      } as any)

      const { POST } = await import('@/app/api/cody/chat/save/route')

      // Send same message but use default timestamp (generated) - this should still differ
      // because the new timestamp will be different from the stored one
      const body = {
        taskId: '260301-test',
        messages: [{ role: 'user', text: 'hello' }], // no timestamp - will get new one
      }
      const req = new NextRequest('http://localhost/api/cody/chat/save', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await POST(req)
      expect(response.status).toBe(200)

      const json = await response.json()
      expect(json.success).toBe(true)

      // Should call createOrUpdateFileContents because timestamp will differ
      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalled()
    })
  })

  describe('clear chat', () => {
    it('should clear dashboard session when messages is empty', async () => {
      const existingChat = {
        version: 1,
        taskId: '260301-test',
        sessions: [
          {
            stage: 'dashboard',
            startedAt: '2026-03-14T10:00:00.000Z',
            messages: [{ role: 'user', text: 'hello', timestamp: '2026-03-14T10:00:01.000Z' }],
          },
          {
            stage: 'spec',
            startedAt: '2026-03-14T09:00:00.000Z',
            messages: [
              { role: 'assistant', text: 'working on spec', timestamp: '2026-03-14T09:00:01.000Z' },
            ],
          },
        ],
      }
      const existingContent = Buffer.from(JSON.stringify(existingChat, null, 2)).toString('base64')

      vi.mocked(findTaskBranch).mockResolvedValue('feature/test-branch')
      vi.mocked(mockOctokit.repos.getContent).mockResolvedValue({
        data: {
          content: existingContent,
          sha: 'abc123',
        },
      } as any)
      vi.mocked(mockOctokit.repos.createOrUpdateFileContents).mockResolvedValue({
        content: { name: 'chat.json' },
      } as any)

      const { POST } = await import('@/app/api/cody/chat/save/route')

      // Clear messages - should remove dashboard session but keep spec session
      const body = { taskId: '260301-test', messages: [] }
      const req = new NextRequest('http://localhost/api/cody/chat/save', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await POST(req)
      expect(response.status).toBe(200)

      // Should call createOrUpdateFileContents
      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalled()

      // Verify the call - dashboard session should be filtered out
      const callArgs = vi.mocked(mockOctokit.repos.createOrUpdateFileContents).mock.calls[0][0]
      const updatedContent = JSON.parse(Buffer.from(callArgs.content, 'base64').toString('utf-8'))
      expect(updatedContent.sessions).toHaveLength(1)
      expect(updatedContent.sessions[0].stage).toBe('spec')
    })
  })
})
