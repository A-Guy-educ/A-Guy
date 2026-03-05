/**
 * @fileType test
 * @domain cody | pipeline
 * @pattern fresh-flag
 * @ai-summary Tests for resetBranchIfFresh: --fresh closes PR + deletes branch
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock child_process before importing the module under test
vi.mock('child_process', () => ({
  execSync: vi.fn().mockReturnValue(''),
  execFileSync: vi.fn().mockReturnValue(''),
}))

// Mock github-api's closeLinkedPR
vi.mock('../../../../scripts/cody/github-api', () => ({
  closeLinkedPR: vi.fn(),
}))

import { execFileSync } from 'child_process'
import { closeLinkedPR } from '../../../../scripts/cody/github-api'
import { resetBranchIfFresh } from '../../../../scripts/cody/checkout-task-branch'

const mockExecFileSync = vi.mocked(execFileSync)
const mockCloseLinkedPR = vi.mocked(closeLinkedPR)

// Silence logger output during tests
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

describe('resetBranchIfFresh', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset env - use a copy so we don't pollute across tests
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // ---------------------------------------------------------------------------
  // When FRESH is not set
  // ---------------------------------------------------------------------------
  describe('when FRESH is not set', () => {
    it('should return the branch unchanged', () => {
      process.env.FRESH = ''

      const result = resetBranchIfFresh('feat/my-branch', 'dev')

      expect(result).toBe('feat/my-branch')
      expect(mockCloseLinkedPR).not.toHaveBeenCalled()
      expect(mockExecFileSync).not.toHaveBeenCalled()
    })

    it('should return null unchanged when branch is null', () => {
      process.env.FRESH = 'false'

      const result = resetBranchIfFresh(null, 'dev')

      expect(result).toBeNull()
      expect(mockCloseLinkedPR).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // When FRESH=true with issue number and PR exists
  // ---------------------------------------------------------------------------
  describe('when FRESH=true and issue has a linked PR', () => {
    it('should call closeLinkedPR with the issue number', () => {
      process.env.FRESH = 'true'
      mockCloseLinkedPR.mockReturnValue(true)

      resetBranchIfFresh('feat/my-branch', 'dev', '651')

      expect(mockCloseLinkedPR).toHaveBeenCalledWith(651)
    })

    it('should return null to force new branch creation', () => {
      process.env.FRESH = 'true'
      mockCloseLinkedPR.mockReturnValue(true)

      const result = resetBranchIfFresh('feat/my-branch', 'dev', '651')

      expect(result).toBeNull()
    })

    it('should NOT manually delete the branch (closeLinkedPR handles it)', () => {
      process.env.FRESH = 'true'
      mockCloseLinkedPR.mockReturnValue(true)

      resetBranchIfFresh('feat/my-branch', 'dev', '651')

      // No git push --delete or git branch -D calls
      expect(mockExecFileSync).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // When FRESH=true with issue number but NO PR exists
  // ---------------------------------------------------------------------------
  describe('when FRESH=true and issue has no linked PR', () => {
    it('should call closeLinkedPR (which returns false)', () => {
      process.env.FRESH = 'true'
      mockCloseLinkedPR.mockReturnValue(false)

      resetBranchIfFresh('feat/my-branch', 'dev', '651')

      expect(mockCloseLinkedPR).toHaveBeenCalledWith(651)
    })

    it('should fall back to manual branch deletion', () => {
      process.env.FRESH = 'true'
      mockCloseLinkedPR.mockReturnValue(false)

      resetBranchIfFresh('feat/my-branch', 'dev', '651')

      // Should call git push origin --delete and git branch -D
      const calls = mockExecFileSync.mock.calls.map((c) => ({
        cmd: String(c[0]),
        args: (c[1] as string[]) || [],
      }))
      expect(calls.some((c) => c.cmd === 'git' && c.args.includes('push') && c.args.includes('--delete'))).toBe(true)
      expect(calls.some((c) => c.cmd === 'git' && c.args.includes('-D'))).toBe(true)
    })

    it('should return null to force new branch creation', () => {
      process.env.FRESH = 'true'
      mockCloseLinkedPR.mockReturnValue(false)

      const result = resetBranchIfFresh('feat/my-branch', 'dev', '651')

      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // When FRESH=true without issue number
  // ---------------------------------------------------------------------------
  describe('when FRESH=true without issue number', () => {
    it('should NOT call closeLinkedPR', () => {
      process.env.FRESH = 'true'

      resetBranchIfFresh('feat/my-branch', 'dev')

      expect(mockCloseLinkedPR).not.toHaveBeenCalled()
    })

    it('should still manually delete the branch', () => {
      process.env.FRESH = 'true'

      resetBranchIfFresh('feat/my-branch', 'dev')

      const calls = mockExecFileSync.mock.calls.map((c) => ({
        cmd: String(c[0]),
        args: (c[1] as string[]) || [],
      }))
      expect(calls.some((c) => c.cmd === 'git' && c.args.includes('push') && c.args.includes('--delete'))).toBe(true)
      expect(calls.some((c) => c.cmd === 'git' && c.args.includes('-D'))).toBe(true)
    })

    it('should return null to force new branch creation', () => {
      process.env.FRESH = 'true'

      const result = resetBranchIfFresh('feat/my-branch', 'dev')

      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // When FRESH=true but no branch exists
  // ---------------------------------------------------------------------------
  describe('when FRESH=true but branch is null', () => {
    it('should call closeLinkedPR if issue number provided', () => {
      process.env.FRESH = 'true'
      mockCloseLinkedPR.mockReturnValue(true)

      const result = resetBranchIfFresh(null, 'dev', '651')

      expect(mockCloseLinkedPR).toHaveBeenCalledWith(651)
      expect(result).toBeNull()
    })

    it('should not attempt manual branch deletion when branch is null and no PR', () => {
      process.env.FRESH = 'true'
      mockCloseLinkedPR.mockReturnValue(false)

      resetBranchIfFresh(null, 'dev', '651')

      // No git commands should be called for branch deletion (branch is null)
      expect(mockExecFileSync).not.toHaveBeenCalled()
    })

    it('should return null', () => {
      process.env.FRESH = 'true'

      const result = resetBranchIfFresh(null, 'dev')

      expect(result).toBeNull()
    })
  })
})
