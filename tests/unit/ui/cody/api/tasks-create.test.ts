/**
 * Unit Tests for Cody Tasks POST API
 *
 * Tests the /api/cody/tasks route POST handler that:
 * - Creates a GitHub issue from the task data
 * - Auto-triggers the pipeline by posting @cody comment
 * - Uploads attachments if provided
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock the github-client module
vi.mock('@/ui/cody/github-client', () => ({
  createIssue: vi.fn(),
  postComment: vi.fn(),
  uploadIssueAttachment: vi.fn(),
  fetchIssues: vi.fn(),
  fetchWorkflowRuns: vi.fn(),
  fetchOpenPRs: vi.fn(),
  fetchDeploymentPreviews: vi.fn(),
  findBranchByIssueNumber: vi.fn(),
  getStatusFromBranch: vi.fn(),
  findStatusOnBranch: vi.fn(),
}))

vi.mock('@/ui/cody/auth', () => ({
  requireCodyAuth: vi.fn(() => Promise.resolve({ identity: { login: 'testuser' } })),
  verifyActorLogin: vi.fn(() => Promise.resolve({ identity: { login: 'testuser' } })),
  getUserOctokit: vi.fn(() => Promise.resolve(null)),
}))

// Import after mocks
import { NextRequest } from 'next/server'
import { createIssue, postComment, uploadIssueAttachment } from '@/ui/cody/github-client'

// Helper to create mock GitHub issue response
const createMockIssue = (num: number) => ({
  id: num,
  number: num,
  title: `Test Task ${num}`,
  body: 'Test body',
  state: 'open' as const,
  labels: [],
  milestone: null,
  assignees: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  closed_at: null,
  html_url: `https://github.com/test/repo/issues/${num}`,
})

describe('POST /api/cody/tasks - Create Task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create issue and trigger pipeline with @cody comment', async () => {
    // Setup mocks
    vi.mocked(createIssue).mockResolvedValue(createMockIssue(123))
    vi.mocked(postComment).mockResolvedValue(undefined)
    vi.mocked(uploadIssueAttachment).mockResolvedValue({
      attachment_url: 'https://example.com/test.png',
      name: 'test.png',
    })

    // Import and call the route handler
    const { POST } = await import('@/app/api/cody/tasks/route')

    const request = new NextRequest('http://localhost/api/cody/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Task',
        body: 'Test description',
        labels: ['feature'],
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    // Verify issue was created
    expect(createIssue).toHaveBeenCalledWith(
      {
        title: 'Test Task',
        body: expect.stringContaining('Test description'),
        labels: ['feature'],
        assignees: [],
      },
      undefined,
    )

    // Verify pipeline was triggered with @cody comment
    expect(postComment).toHaveBeenCalledWith(123, '@cody', undefined)

    // Verify response
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.issue.number).toBe(123)
  })

  it('should handle trigger failure gracefully', async () => {
    // Setup mocks - issue created but trigger fails
    vi.mocked(createIssue).mockResolvedValue(createMockIssue(456))
    vi.mocked(postComment).mockRejectedValue(new Error('API rate limit'))
    vi.mocked(uploadIssueAttachment).mockResolvedValue({ attachment_url: '', name: '' })

    // Import and call the route handler
    const { POST } = await import('@/app/api/cody/tasks/route')

    const request = new NextRequest('http://localhost/api/cody/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Task 2',
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    // Verify issue was still created
    expect(createIssue).toHaveBeenCalled()

    // Verify trigger was attempted
    expect(postComment).toHaveBeenCalledWith(456, '@cody', undefined)

    // Verify response still succeeds (trigger failure is non-fatal)
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('should upload attachments if provided', async () => {
    // Setup mocks
    vi.mocked(createIssue).mockResolvedValue(createMockIssue(789))
    vi.mocked(postComment).mockResolvedValue(undefined)
    vi.mocked(uploadIssueAttachment).mockResolvedValue({
      name: 'test.png',
      attachment_url: 'https://example.com/test.png',
    })

    // Import and call the route handler
    const { POST } = await import('@/app/api/cody/tasks/route')

    const request = new NextRequest('http://localhost/api/cody/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Task with attachments',
        attachments: [{ name: 'test.png', content: 'base64data' }],
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    // Verify attachment was uploaded
    expect(uploadIssueAttachment).toHaveBeenCalledWith(
      789,
      {
        name: 'test.png',
        content: 'base64data',
      },
      undefined,
    )

    // Verify response includes attachments
    expect(response.status).toBe(200)
    expect(body.attachments).toHaveLength(1)
    expect(body.attachments[0].name).toBe('test.png')
  })

  it('should require title field', async () => {
    // Import and call the route handler
    const { POST } = await import('@/app/api/cody/tasks/route')

    const request = new NextRequest('http://localhost/api/cody/tasks', {
      method: 'POST',
      body: JSON.stringify({
        body: 'Missing title',
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    // Verify error response
    expect(response.status).toBe(400)
    expect(body.error).toBe('Title is required')

    // Verify no issue was created
    expect(createIssue).not.toHaveBeenCalled()
  })
})
