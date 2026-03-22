import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the brain-client module before importing review-brain
const mockRunBrain = vi.fn()
vi.mock('../../../../scripts/cody/brain-client', () => ({
  runBrain: mockRunBrain,
}))

describe('review-brain', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('runReviewBrain', () => {
    it('returns the review output from the brain', async () => {
      const expectedReview = `# Code Review

## Critical
- None

## Warnings
- Missing error handling in auth service

## Info
- Consider using a constant for the token expiry
`

      mockRunBrain.mockResolvedValue({
        output: expectedReview,
        toolCalls: 5,
        tokensUsed: 8000,
      })

      const { runReviewBrain } = await import('../../../../scripts/cody/review-brain')
      const result = await runReviewBrain(
        '# Plan\nImplement auth service',
        ['src/server/services/auth.ts'],
        'diff here',
        'http://100.66.248.120:4097/sse',
      )

      expect(result).toBe(expectedReview)
    })

    it('formats user message with plan, changed files, and diffs', async () => {
      mockRunBrain.mockResolvedValue({
        output: '# Review\nAll good',
        toolCalls: 1,
        tokensUsed: 1000,
      })

      const { runReviewBrain } = await import('../../../../scripts/cody/review-brain')

      // Suppress errors - we just want to verify the mock was called
      await runReviewBrain(
        '# Plan\nThe plan content',
        ['src/auth.ts', 'src/user.ts'],
        '--- a/src/auth.ts\n+++ a/src/auth.ts\n@@ -1,3 +1,4 @@',
        'http://100.66.248.120:4097/sse',
      ).catch(() => {})

      // Verify runBrain was called at all
      expect(mockRunBrain).toHaveBeenCalled()
      // Verify it was called with the right server URL
      expect(mockRunBrain.mock.calls[0][0]).toBe('http://100.66.248.120:4097/sse')
      // Verify user message contains expected sections
      const userMessage = mockRunBrain.mock.calls[0][2] as string
      expect(userMessage).toContain('## Plan')
      expect(userMessage).toContain('## Changed Files')
      expect(userMessage).toContain('## Diffs')
    })

    it('uses correct system prompt for review', async () => {
      mockRunBrain.mockResolvedValue({
        output: '# Review\nDone',
        toolCalls: 0,
        tokensUsed: 500,
      })

      const { runReviewBrain } = await import('../../../../scripts/cody/review-brain')
      await runReviewBrain('plan', ['file.ts'], 'diff', 'http://100.66.248.120:4097/sse')

      expect(mockRunBrain).toHaveBeenCalledWith(
        'http://100.66.248.120:4097/sse',
        expect.stringContaining('You are the code reviewer for the Cody pipeline'),
        expect.any(String),
      )
    })

    it('handles empty changed files list', async () => {
      mockRunBrain.mockResolvedValue({
        output: '# Review\nNo files changed',
        toolCalls: 0,
        tokensUsed: 500,
      })

      const { runReviewBrain } = await import('../../../../scripts/cody/review-brain')
      const result = await runReviewBrain('plan', [], '', 'http://100.66.248.120:4097/sse')

      expect(result).toContain('No files changed')
    })

    it('handles empty diffs', async () => {
      mockRunBrain.mockResolvedValue({
        output: '# Review\nNo diff',
        toolCalls: 0,
        tokensUsed: 500,
      })

      const { runReviewBrain } = await import('../../../../scripts/cody/review-brain')
      const result = await runReviewBrain('plan', ['file.ts'], '', 'http://100.66.248.120:4097/sse')

      expect(result).toContain('No diff')
    })
  })
})
