/**
 * Unit Tests for Cody Close Action API
 *
 * Tests the /api/cody/tasks/[taskId]/actions route that handles the 'close' action.
 * When closing an Issue, it should also:
 * - Close the associated PR (if exists)
 * - Delete the branch (if exists)
 * - Close the issue
 *
 * These tests verify the close action properly orchestrates closing PR, deleting branch,
 * and closing the issue.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { GitHubPR } from '@/ui/cody/types'

// Mock the github-client module
vi.mock('@/ui/cody/github-client', () => ({
  findAssociatedPRByIssueNumber: vi.fn(),
  findTaskBranch: vi.fn(),
  closePR: vi.fn(),
  deleteBranch: vi.fn(),
  updateIssue: vi.fn(),
  clearCache: vi.fn(),
}))

vi.mock('@/ui/cody/auth', () => ({
  requireCodyAuth: vi.fn(() => null), // Skip auth for tests
}))

// Import after mocks
import { NextRequest } from 'next/server'
import {
  findAssociatedPRByIssueNumber,
  findTaskBranch,
  closePR,
  deleteBranch,
  updateIssue,
} from '@/ui/cody/github-client'

describe('POST /api/cody/tasks/[taskId]/actions - Close Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should close issue, PR, and delete branch when all exist', async () => {
    // Setup mocks
    const mockPR: GitHubPR = {
      number: 123,
      title: 'Test PR',
      state: 'open',
      head: { ref: 'feature/test-branch', sha: 'abc123' },
      id: 1,
      html_url: '',
      merged_at: null,
    }
    const mockBranch = 'feature/260301-test-issue'

    vi.mocked(findAssociatedPRByIssueNumber).mockResolvedValue(mockPR)
    vi.mocked(findTaskBranch).mockResolvedValue(mockBranch)
    vi.mocked(closePR).mockResolvedValue(undefined)
    vi.mocked(deleteBranch).mockResolvedValue(undefined)
    vi.mocked(updateIssue).mockResolvedValue(undefined)

    // Import and call the route handler
    const { POST } = await import('@/app/api/cody/tasks/[taskId]/actions/route')

    const request = new NextRequest('http://localhost/api/cody/tasks/issue-659/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'close' }),
    })

    const params = Promise.resolve({ taskId: 'issue-659' })
    const response = await POST(request, { params })
    const body = await response.json()

    // Verify all actions were called
    expect(findAssociatedPRByIssueNumber).toHaveBeenCalledWith(659)
    expect(closePR).toHaveBeenCalledWith(123)
    expect(findTaskBranch).toHaveBeenCalledWith('issue-659')
    expect(deleteBranch).toHaveBeenCalledWith(mockBranch)
    expect(updateIssue).toHaveBeenCalledWith(659, { state: 'closed' })

    // Verify response
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toContain('PR closed')
    expect(body.message).toContain('branch deleted')
  })

  it('should close issue when no PR or branch exists', async () => {
    // Setup mocks - no PR, no branch
    vi.mocked(findAssociatedPRByIssueNumber).mockResolvedValue(null)
    vi.mocked(findTaskBranch).mockResolvedValue(null)
    vi.mocked(closePR).mockResolvedValue(undefined)
    vi.mocked(deleteBranch).mockResolvedValue(undefined)
    vi.mocked(updateIssue).mockResolvedValue(undefined)

    // Import and call the route handler
    const { POST } = await import('@/app/api/cody/tasks/[taskId]/actions/route')

    const request = new NextRequest('http://localhost/api/cody/tasks/issue-659/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'close' }),
    })

    const params = Promise.resolve({ taskId: 'issue-659' })
    const response = await POST(request, { params })
    const body = await response.json()

    // Verify only updateIssue was called (no PR to close, no branch to delete)
    expect(findAssociatedPRByIssueNumber).toHaveBeenCalledWith(659)
    expect(closePR).not.toHaveBeenCalled()
    expect(findTaskBranch).toHaveBeenCalledWith('issue-659')
    expect(deleteBranch).not.toHaveBeenCalled()
    expect(updateIssue).toHaveBeenCalledWith(659, { state: 'closed' })

    // Verify response still succeeds
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('should not delete protected branches (dev, main, master)', async () => {
    // Setup mocks - branch is protected
    const mockPR: GitHubPR = {
      number: 123,
      title: 'Test PR',
      state: 'open',
      head: { ref: 'dev', sha: 'abc123' },
      id: 1,
      html_url: '',
      merged_at: null,
    }

    vi.mocked(findAssociatedPRByIssueNumber).mockResolvedValue(mockPR)
    vi.mocked(findTaskBranch).mockResolvedValue('dev')
    vi.mocked(closePR).mockResolvedValue(undefined)
    vi.mocked(deleteBranch).mockResolvedValue(undefined)
    vi.mocked(updateIssue).mockResolvedValue(undefined)

    // Import and call the route handler
    const { POST } = await import('@/app/api/cody/tasks/[taskId]/actions/route')

    const request = new NextRequest('http://localhost/api/cody/tasks/issue-659/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'close' }),
    })

    const params = Promise.resolve({ taskId: 'issue-659' })
    const response = await POST(request, { params })
    const _body = await response.json()

    // Verify PR was closed but branch was NOT deleted
    expect(closePR).toHaveBeenCalledWith(123)
    expect(deleteBranch).not.toHaveBeenCalled() // dev is protected
    expect(updateIssue).toHaveBeenCalledWith(659, { state: 'closed' })

    // Verify response succeeds
    expect(response.status).toBe(200)
  })

  it('should close PR but not delete branch when only PR exists', async () => {
    // Setup mocks - only PR exists, no branch
    const mockPR: GitHubPR = {
      number: 456,
      title: 'Test PR',
      state: 'open',
      head: { ref: 'some-branch', sha: 'abc123' },
      id: 1,
      html_url: '',
      merged_at: null,
    }

    vi.mocked(findAssociatedPRByIssueNumber).mockResolvedValue(mockPR)
    vi.mocked(findTaskBranch).mockResolvedValue(null)
    vi.mocked(closePR).mockResolvedValue(undefined)
    vi.mocked(deleteBranch).mockResolvedValue(undefined)
    vi.mocked(updateIssue).mockResolvedValue(undefined)

    // Import and call the route handler
    const { POST } = await import('@/app/api/cody/tasks/[taskId]/actions/route')

    const request = new NextRequest('http://localhost/api/cody/tasks/issue-100/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'close' }),
    })

    const params = Promise.resolve({ taskId: 'issue-100' })
    const response = await POST(request, { params })
    const _body = await response.json()

    // Verify PR was closed but branch deletion was skipped
    expect(closePR).toHaveBeenCalledWith(456)
    expect(deleteBranch).not.toHaveBeenCalled() // No branch found
    expect(updateIssue).toHaveBeenCalledWith(100, { state: 'closed' })

    expect(response.status).toBe(200)
  })
})
