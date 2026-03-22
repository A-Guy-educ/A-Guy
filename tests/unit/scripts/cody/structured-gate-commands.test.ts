/**
 * @fileType test
 * @domain ci | cody
 * @pattern gate-commands
 * @ai-summary Tests that gate approval only accepts structured commands (approve/reject),
 *   rejecting previously-accepted ambiguous keywords
 */

import { describe, it, expect } from 'vitest'
import { detectApprovalFromComment } from '../../../../scripts/cody/clarify-workflow'

describe('structured gate commands', () => {
  describe('accepted approval commands', () => {
    it.each(['@cody approve', '/cody approve', 'approve'])('"%s" → approved', (comment) => {
      const result = detectApprovalFromComment(comment)
      expect(result.status).toBe('approved')
    })

    it('preserves answer content after approve', () => {
      const result = detectApprovalFromComment('@cody approve Use the existing Button component')
      expect(result.status).toBe('approved')
      expect(result.answerContent).toBe('Use the existing Button component')
    })

    it('preserves multi-line answer after approve', () => {
      const result = detectApprovalFromComment('@cody approve Line 1\\nLine 2\\nLine 3')
      expect(result.status).toBe('approved')
      expect(result.answerContent).toContain('Line 1')
      expect(result.answerContent).toContain('Line 2')
    })
  })

  describe('accepted rejection commands', () => {
    it.each(['@cody reject', '/cody reject', 'reject'])('"%s" → rejected', (comment) => {
      const result = detectApprovalFromComment(comment)
      expect(result.status).toBe('rejected')
    })

    it('preserves reason after reject', () => {
      const result = detectApprovalFromComment('@cody reject Wrong approach, use REST instead')
      expect(result.status).toBe('rejected')
      expect(result.answerContent).toBe('Wrong approach, use REST instead')
    })
  })

  describe('rejected ambiguous keywords (previously accepted)', () => {
    it.each([
      ['yes', 'was approval keyword'],
      ['go', 'was approval keyword'],
      ['proceed', 'was approval keyword'],
      ['y', 'was approval keyword'],
      ['continue', 'was approval keyword'],
      ['approved', 'was approval keyword'],
      ['no', 'was rejection keyword'],
      ['cancel', 'was rejection keyword'],
      ['stop', 'was rejection keyword'],
      ['n', 'was rejection keyword'],
      ['rejected', 'was rejection keyword'],
    ])('"%s" → null (no match) — %s', (keyword) => {
      const result = detectApprovalFromComment(`@cody ${keyword}`)
      expect(result.status).toBeNull()
    })

    it('"@cody yes I see the issue but don\'t proceed" → null (not accidentally approved)', () => {
      const result = detectApprovalFromComment("@cody yes I see the issue but don't proceed")
      expect(result.status).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('null comment → null', () => {
      expect(detectApprovalFromComment(null).status).toBeNull()
    })

    it('empty comment → null', () => {
      expect(detectApprovalFromComment('').status).toBeNull()
    })

    it('random text → null', () => {
      expect(detectApprovalFromComment('I think this looks good').status).toBeNull()
    })

    it('case insensitive — "APPROVE" works', () => {
      const result = detectApprovalFromComment('@cody APPROVE')
      expect(result.status).toBe('approved')
    })

    it('case insensitive — "Reject" works', () => {
      const result = detectApprovalFromComment('@cody Reject')
      expect(result.status).toBe('rejected')
    })

    it('JSON-encoded comment body', () => {
      const result = detectApprovalFromComment('"@cody approve"')
      expect(result.status).toBe('approved')
    })
  })
})
