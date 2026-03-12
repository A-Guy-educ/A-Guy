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
        expect.arrayContaining(['issue', 'add-label', '42', '--repo', 'owner/repo', 'bug']),
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
        expect.arrayContaining(['issue', 'remove-label', '42', '--repo', 'owner/repo', 'bug']),
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
})
