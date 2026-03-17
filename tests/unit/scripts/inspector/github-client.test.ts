import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as childProcess from 'child_process'

// Mock child_process before importing the module
vi.mock('child_process', () => ({
  execFileSync: vi.fn().mockReturnValue(''),
}))

// Mock fs (used by readTaskFile)
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue(''),
}))

import { createGitHubClient } from '../../../../scripts/inspector/clients/github'

describe('createGitHubClient', () => {
  const mockExecFileSync = childProcess.execFileSync as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockExecFileSync.mockReturnValue('')
  })

  describe('postComment', () => {
    it('should include --repo flag in gh CLI args', () => {
      const client = createGitHubClient('owner/repo', 'fake-token')

      client.postComment(42, 'Hello world')

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining([
          'issue',
          'comment',
          '42',
          '--repo',
          'owner/repo',
          '--body-file',
          '-',
        ]),
        expect.objectContaining({ input: 'Hello world' }),
      )
    })

    it('should pass body as stdin input', () => {
      const client = createGitHubClient('owner/repo', 'fake-token')

      client.postComment(10, 'Test body')

      const call = mockExecFileSync.mock.calls[0]
      expect(call[2].input).toBe('Test body')
    })
  })

  describe('addLabel', () => {
    it('should include --repo flag in gh CLI args', () => {
      const client = createGitHubClient('owner/repo', 'fake-token')

      client.addLabel(42, 'bug')

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining([
          'issue',
          'edit',
          '42',
          '--repo',
          'owner/repo',
          '--add-label',
          'bug',
        ]),
        expect.any(Object),
      )
    })
  })

  describe('removeLabel', () => {
    it('should include --repo flag in gh CLI args', () => {
      const client = createGitHubClient('owner/repo', 'fake-token')

      client.removeLabel(42, 'bug')

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining([
          'issue',
          'edit',
          '42',
          '--repo',
          'owner/repo',
          '--remove-label',
          'bug',
        ]),
        expect.any(Object),
      )
    })
  })

  describe('closeIssue', () => {
    it('should include --repo flag in gh CLI args (regression)', () => {
      const client = createGitHubClient('owner/repo', 'fake-token')

      client.closeIssue(42)

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['issue', 'close', '42']),
        expect.any(Object),
      )
      // Verify --repo is present (already was before this fix, regression test)
      const args = mockExecFileSync.mock.calls[0][1] as string[]
      const hasRepo = args.some((arg: string) => arg.includes('--repo'))
      expect(hasRepo).toBe(true)
    })
  })

  describe('triggerWorkflow', () => {
    it('should include --repo flag in gh CLI args (regression)', () => {
      const client = createGitHubClient('owner/repo', 'fake-token')

      // triggerWorkflow uses execFileSync directly (not the gh helper)
      client.triggerWorkflow('cody.yml', { task: 'test' })

      // triggerWorkflow has its own execFileSync call
      const calls = mockExecFileSync.mock.calls
      const workflowCall = calls.find((call: unknown[]) => {
        const args = call[1] as string[]
        return args.includes('workflow')
      })
      expect(workflowCall).toBeDefined()
      const args = workflowCall![1] as string[]
      const hasRepo = args.some((arg: string) => arg.includes('--repo'))
      expect(hasRepo).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should return empty string when gh command fails', () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('gh command failed')
      })

      const client = createGitHubClient('owner/repo', 'fake-token')

      // Should not throw — fire-and-forget
      expect(() => client.postComment(42, 'test')).not.toThrow()
    })
  })

  describe('listWorkflowRuns', () => {
    it('should call gh api with workflow file and status filter', () => {
      const runs = [
        {
          id: 1,
          status: 'completed',
          conclusion: 'success',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:18:00Z',
          headBranch: 'dev',
          event: 'workflow_dispatch',
        },
      ]
      mockExecFileSync.mockReturnValue(JSON.stringify(runs))

      const client = createGitHubClient('owner/repo', 'fake-token')
      const result = client.listWorkflowRuns('cody.yml', { per_page: 50, status: 'completed' })

      expect(result).toHaveLength(1)
      expect(result[0].conclusion).toBe('success')
      const args = mockExecFileSync.mock.calls[0][1] as string[]
      expect(args).toContain('api')
      expect(args.some((a: string) => a.includes('cody.yml'))).toBe(true)
    })

    it('should return empty array when gh returns empty output', () => {
      mockExecFileSync.mockReturnValue('')
      const client = createGitHubClient('owner/repo', 'fake-token')
      expect(client.listWorkflowRuns('cody.yml')).toEqual([])
    })

    it('should return empty array when gh returns invalid JSON', () => {
      mockExecFileSync.mockReturnValue('not json')
      const client = createGitHubClient('owner/repo', 'fake-token')
      expect(client.listWorkflowRuns('cody.yml')).toEqual([])
    })
  })

  describe('createIssue', () => {
    it('should create issue then add labels separately', () => {
      mockExecFileSync.mockReturnValue('https://github.com/owner/repo/issues/99')

      const client = createGitHubClient('owner/repo', 'fake-token')
      const result = client.createIssue('Bug title', 'Bug body', ['bug', 'cody:improvement'])

      expect(result).toBe(99)
      // First call: create issue (no labels in args)
      const createArgs = mockExecFileSync.mock.calls[0][1] as string[]
      expect(createArgs).toContain('issue')
      expect(createArgs).toContain('create')
      expect(createArgs).toContain('Bug title')
      expect(createArgs).not.toContain('--label')
      // Second call: add labels via edit
      const editArgs = mockExecFileSync.mock.calls[1][1] as string[]
      expect(editArgs).toContain('issue')
      expect(editArgs).toContain('edit')
      expect(editArgs).toContain('--add-label')
      expect(editArgs).toContain('bug,cody:improvement')
    })

    it('should return null when gh returns no URL', () => {
      mockExecFileSync.mockReturnValue('')
      const client = createGitHubClient('owner/repo', 'fake-token')
      expect(client.createIssue('title', 'body', [])).toBeNull()
    })
  })

  describe('searchIssues', () => {
    it('should return parsed issues from gh search response', () => {
      const issues = [
        {
          number: 5,
          title: 'Found issue',
          labels: ['cody:improvement'],
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ]
      mockExecFileSync.mockReturnValue(JSON.stringify(issues))

      const client = createGitHubClient('owner/repo', 'fake-token')
      const result = client.searchIssues('failure stage:build')

      expect(result).toHaveLength(1)
      expect(result[0].number).toBe(5)
      const args = mockExecFileSync.mock.calls[0][1] as string[]
      expect(args).toContain('api')
      expect(args.some((a: string) => a.includes('search/issues'))).toBe(true)
    })

    it('should return empty array on failure', () => {
      mockExecFileSync.mockReturnValue('')
      const client = createGitHubClient('owner/repo', 'fake-token')
      expect(client.searchIssues('test query')).toEqual([])
    })
  })
})
