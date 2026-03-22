/**
 * @fileType test
 * @domain cody
 * @pattern bug-reproduction
 * @ai-summary Reproduction tests for GITHUB_TOKEN error message mismatch bug
 */
import { describe, it, expect } from 'vitest'

describe('GITHUB_TOKEN error detection', () => {
  describe('Error message matching in tasks route', () => {
    /**
     * This test reproduces the bug where the catch clause in tasks/route.ts
     * checks for `error?.message?.includes('GITHUB_TOKEN not configured')`
     * but the actual error from getOctokit() is:
     * "Neither CODY_BOT_TOKEN nor GITHUB_TOKEN is configured"
     *
     * The includes() check fails because "GITHUB_TOKEN is configured" != "GITHUB_TOKEN not configured"
     */
    it('should detect the new error message format from getOctokit', () => {
      const errorMessage = 'Neither CODY_BOT_TOKEN nor GITHUB_TOKEN is configured'

      // OLD BUGGY CHECK (what tasks/route.ts currently does):
      const oldCheck = errorMessage.includes('GITHUB_TOKEN not configured')
      expect(oldCheck).toBe(false) // This is the bug!

      // CORRECT CHECK (should match both old and new formats):
      // Note: the message says "is configured" not "not configured"
      const newCheck =
        errorMessage.includes('TOKEN') &&
        errorMessage.includes('configured') &&
        (errorMessage.includes('GITHUB_TOKEN') || errorMessage.includes('CODY_BOT_TOKEN'))
      expect(newCheck).toBe(true)
    })

    it('should detect the old error message format for backward compat', () => {
      const errorMessage = 'GITHUB_TOKEN not configured'

      const check =
        errorMessage.includes('not configured') &&
        (errorMessage.includes('GITHUB_TOKEN') || errorMessage.includes('CODY_BOT_TOKEN'))
      expect(check).toBe(true)
    })

    it('should NOT match unrelated errors', () => {
      const errorMessages = [
        'Something else is not configured',
        'Rate limit exceeded',
        'Network error',
        '',
      ]

      for (const errorMessage of errorMessages) {
        const check =
          errorMessage.includes('not configured') &&
          (errorMessage.includes('GITHUB_TOKEN') || errorMessage.includes('CODY_BOT_TOKEN'))
        expect(check).toBe(false)
      }
    })
  })

  describe('NoTokenError class', () => {
    it('should have helpful default message mentioning both tokens', async () => {
      // Dynamic import to get the NoTokenError class
      const { NoTokenError } = await import('@/ui/cody/api')

      // Default message should be helpful
      const error = new NoTokenError()
      const message = error.message

      // Should mention both token options
      expect(message).toContain('GITHUB_TOKEN')
      expect(message).toContain('CODY_BOT_TOKEN')
      expect(message).toContain('not configured')
    })

    it('should accept custom message', async () => {
      const { NoTokenError } = await import('@/ui/cody/api')

      const customMessage = 'Custom error message'
      const error = new NoTokenError(customMessage)

      expect(error.message).toBe(customMessage)
      expect(error.name).toBe('NoTokenError')
    })
  })
})
