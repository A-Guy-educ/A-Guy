import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as childProcess from 'child_process'

// Mock child_process.execSync before importing the module
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

import { ensureFeatureBranch, BRANCH_PREFIX_MAP } from '../../../../scripts/cody/git-utils'

// ============================================================================
// BRANCH_PREFIX_MAP
// ============================================================================

describe('BRANCH_PREFIX_MAP', () => {
  it('should map fix_bug to "fix"', () => {
    expect(BRANCH_PREFIX_MAP.fix_bug).toBe('fix')
  })

  it('should map implement_feature to "feat"', () => {
    expect(BRANCH_PREFIX_MAP.implement_feature).toBe('feat')
  })

  it('should map refactor to "refactor"', () => {
    expect(BRANCH_PREFIX_MAP.refactor).toBe('refactor')
  })

  it('should map docs to "docs"', () => {
    expect(BRANCH_PREFIX_MAP.docs).toBe('docs')
  })

  it('should map ops to "chore"', () => {
    expect(BRANCH_PREFIX_MAP.ops).toBe('chore')
  })

  it('should map research to "feat"', () => {
    expect(BRANCH_PREFIX_MAP.research).toBe('feat')
  })

  it('should map spec_only to "feat"', () => {
    expect(BRANCH_PREFIX_MAP.spec_only).toBe('feat')
  })

  it('should have exactly 7 entries', () => {
    expect(Object.keys(BRANCH_PREFIX_MAP)).toHaveLength(7)
  })
})

// ============================================================================
// ensureFeatureBranch
// ============================================================================

describe('ensureFeatureBranch', () => {
  const mockExecSync = vi.mocked(childProcess.execSync)
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let savedGithubActions: string | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    savedGithubActions = process.env.GITHUB_ACTIONS
    delete process.env.GITHUB_ACTIONS

    // Default: current branch is 'dev', remote branch does NOT exist
    mockExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
        return 'dev\n'
      }
      if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify origin/')) {
        throw new Error('fatal: Needed a single revision')
      }
      if (typeof cmd === 'string' && cmd.includes('git status --porcelain')) {
        return '' // Clean working tree by default
      }
      // All other commands (fetch, checkout, pull) succeed silently
      return Buffer.from('')
    })
  })

  afterEach(() => {
    if (savedGithubActions !== undefined) {
      process.env.GITHUB_ACTIONS = savedGithubActions
    } else {
      delete process.env.GITHUB_ACTIONS
    }
    consoleWarnSpy.mockRestore()
  })

  // --------------------------------------------------------------------------
  // Early return: already on a feature branch
  // --------------------------------------------------------------------------

  describe('when already on a feature branch', () => {
    it('should return early without creating a branch', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'feat/260218-existing-task\n'
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-my-task', 'implement_feature')

      // Should only call git branch --show-current, nothing else
      expect(mockExecSync).toHaveBeenCalledTimes(1)
      expect(mockExecSync).toHaveBeenCalledWith(
        'git branch --show-current',
        expect.objectContaining({ encoding: 'utf-8' }),
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[branch] Already on feature branch: feat/260218-existing-task',
      )
    })

    it('should return early for any non-base branch name', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'fix/260218-some-bug\n'
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-other-task', 'fix_bug')

      expect(mockExecSync).toHaveBeenCalledTimes(1)
    })
  })

  // --------------------------------------------------------------------------
  // Remote branch exists: checkout + pull
  // --------------------------------------------------------------------------

  describe('when on dev and remote branch exists', () => {
    beforeEach(() => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        // rev-parse succeeds → remote branch exists
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify')) {
          return 'abc123\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git status --porcelain')) {
          return '' // Clean working tree
        }
        return Buffer.from('')
      })
    })

    it('should checkout and pull the existing remote branch', () => {
      ensureFeatureBranch('260218-my-task', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      expect(calls).toContain('git fetch origin')
      expect(calls).toContain('git rev-parse --verify origin/feat/260218-my-task')
      expect(calls).toContain('git checkout feat/260218-my-task')
      expect(calls).toContain('git pull origin feat/260218-my-task')
    })

    it('should NOT create a new branch', () => {
      ensureFeatureBranch('260218-my-task', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      expect(calls).not.toContain(expect.stringContaining('checkout -b'))
      expect(calls).not.toContain('git checkout dev')
    })

    it('should log that remote branch exists', () => {
      ensureFeatureBranch('260218-my-task', 'implement_feature')

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[branch] Remote branch exists, checking out: feat/260218-my-task',
      )
    })
  })

  // --------------------------------------------------------------------------
  // Remote branch does NOT exist: create new branch from dev
  // --------------------------------------------------------------------------

  describe('when on dev and remote branch does not exist', () => {
    it('should checkout dev, pull, and create new branch', () => {
      ensureFeatureBranch('260218-my-task', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      expect(calls).toContain('git fetch origin')
      expect(calls).toContain('git checkout dev')
      expect(calls).toContain('git pull origin dev')
      expect(calls).toContain('git checkout -b feat/260218-my-task')
    })

    it('should NOT checkout an existing remote branch', () => {
      ensureFeatureBranch('260218-my-task', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      // Should not have plain checkout (without -b) for the feature branch
      expect(calls).not.toContain('git checkout feat/260218-my-task')
      expect(calls).not.toContain('git pull origin feat/260218-my-task')
    })

    it('should log that a new branch is being created', () => {
      ensureFeatureBranch('260218-my-task', 'implement_feature')

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[branch] Creating new branch from dev: feat/260218-my-task',
      )
    })
  })

  // --------------------------------------------------------------------------
  // On main: should also create feature branch
  // --------------------------------------------------------------------------

  describe('when on main', () => {
    beforeEach(() => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'main\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify')) {
          throw new Error('fatal: Needed a single revision')
        }
        return Buffer.from('')
      })
    })

    it('should create a feature branch (same as from dev)', () => {
      ensureFeatureBranch('260218-my-task', 'fix_bug')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      expect(calls).toContain('git fetch origin')
      expect(calls).toContain('git checkout dev')
      expect(calls).toContain('git pull origin dev')
      expect(calls).toContain('git checkout -b fix/260218-my-task')
    })
  })

  // --------------------------------------------------------------------------
  // On empty string branch (detached HEAD yields '')
  // --------------------------------------------------------------------------

  describe('when on empty string branch (detached HEAD)', () => {
    beforeEach(() => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return '\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify')) {
          throw new Error('fatal: Needed a single revision')
        }
        return Buffer.from('')
      })
    })

    it('should create a feature branch', () => {
      ensureFeatureBranch('260218-my-task', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      expect(calls).toContain('git checkout -b feat/260218-my-task')
    })
  })

  // --------------------------------------------------------------------------
  // Branch naming
  // --------------------------------------------------------------------------

  describe('branch naming', () => {
    it('should name fix_bug branch as "fix/<taskId>"', () => {
      ensureFeatureBranch('260218-my-task', 'fix_bug')

      const calls = mockExecSync.mock.calls.map((c) => c[0])
      expect(calls).toContain('git checkout -b fix/260218-my-task')
    })

    it('should name implement_feature branch as "feat/<taskId>"', () => {
      ensureFeatureBranch('260218-task', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])
      expect(calls).toContain('git checkout -b feat/260218-task')
    })

    it('should name refactor branch as "refactor/<taskId>"', () => {
      ensureFeatureBranch('260218-cleanup', 'refactor')

      const calls = mockExecSync.mock.calls.map((c) => c[0])
      expect(calls).toContain('git checkout -b refactor/260218-cleanup')
    })

    it('should name docs branch as "docs/<taskId>"', () => {
      ensureFeatureBranch('260218-readme', 'docs')

      const calls = mockExecSync.mock.calls.map((c) => c[0])
      expect(calls).toContain('git checkout -b docs/260218-readme')
    })

    it('should name ops branch as "chore/<taskId>"', () => {
      ensureFeatureBranch('260218-ci-fix', 'ops')

      const calls = mockExecSync.mock.calls.map((c) => c[0])
      expect(calls).toContain('git checkout -b chore/260218-ci-fix')
    })

    it('should name research branch as "feat/<taskId>"', () => {
      ensureFeatureBranch('260218-spike', 'research')

      const calls = mockExecSync.mock.calls.map((c) => c[0])
      expect(calls).toContain('git checkout -b feat/260218-spike')
    })

    it('should name spec_only branch as "feat/<taskId>"', () => {
      ensureFeatureBranch('260218-spec', 'spec_only')

      const calls = mockExecSync.mock.calls.map((c) => c[0])
      expect(calls).toContain('git checkout -b feat/260218-spec')
    })
  })

  // --------------------------------------------------------------------------
  // Unknown task type defaults to 'feat'
  // --------------------------------------------------------------------------

  describe('unknown task type', () => {
    it('should default to "feat" prefix for unknown task types', () => {
      ensureFeatureBranch('260218-mystery', 'unknown_type')

      const calls = mockExecSync.mock.calls.map((c) => c[0])
      expect(calls).toContain('git checkout -b feat/260218-mystery')
    })

    it('should default to "feat" prefix for empty string task type', () => {
      ensureFeatureBranch('260218-no-type', '')

      const calls = mockExecSync.mock.calls.map((c) => c[0])
      expect(calls).toContain('git checkout -b feat/260218-no-type')
    })
  })

  // --------------------------------------------------------------------------
  // Custom projectDir: cwd is passed to all execSync calls
  // --------------------------------------------------------------------------

  describe('custom projectDir', () => {
    it('should pass custom cwd to all execSync calls', () => {
      const customDir = '/custom/project/dir'

      ensureFeatureBranch('260218-task', 'implement_feature', customDir)

      // Every execSync call should have received cwd = customDir
      for (const call of mockExecSync.mock.calls) {
        const opts = call[1] as Record<string, unknown>
        expect(opts.cwd).toBe(customDir)
      }
    })
  })

  // --------------------------------------------------------------------------
  // Default projectDir: uses process.cwd()
  // --------------------------------------------------------------------------

  describe('default projectDir', () => {
    it('should use process.cwd() when projectDir is not provided', () => {
      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/mocked/cwd')

      ensureFeatureBranch('260218-task', 'implement_feature')

      // The first call (git branch --show-current) should use the mocked cwd
      const firstCallOpts = mockExecSync.mock.calls[0][1] as Record<string, unknown>
      expect(firstCallOpts.cwd).toBe('/mocked/cwd')

      cwdSpy.mockRestore()
    })

    it('should use process.cwd() for all execSync calls when projectDir is undefined', () => {
      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/default/cwd')

      ensureFeatureBranch('260218-task', 'fix_bug')

      for (const call of mockExecSync.mock.calls) {
        const opts = call[1] as Record<string, unknown>
        expect(opts.cwd).toBe('/default/cwd')
      }

      cwdSpy.mockRestore()
    })
  })

  // --------------------------------------------------------------------------
  // Remote check failure: git rev-parse throws → create new branch
  // --------------------------------------------------------------------------

  describe('remote check failure', () => {
    it('should create new branch when git rev-parse fails', () => {
      // Default mock already has rev-parse throwing — verify the full flow
      ensureFeatureBranch('260218-new-task', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      // Should have attempted to verify remote
      expect(calls).toContain('git rev-parse --verify origin/feat/260218-new-task')

      // Since it failed, should create new branch from dev
      expect(calls).toContain('git checkout dev')
      expect(calls).toContain('git pull origin dev')
      expect(calls).toContain('git checkout -b feat/260218-new-task')

      // Should NOT checkout existing remote branch
      expect(calls).not.toContain('git checkout feat/260218-new-task')
      expect(calls).not.toContain('git pull origin feat/260218-new-task')
    })

    it('should not propagate the rev-parse error', () => {
      expect(() => {
        ensureFeatureBranch('260218-safe-task', 'implement_feature')
      }).not.toThrow()
    })
  })

  // --------------------------------------------------------------------------
  // Dirty-state cleanup before branch switch
  // --------------------------------------------------------------------------

  describe('dirty-state cleanup (CI mode)', () => {
    beforeEach(() => {
      process.env.GITHUB_ACTIONS = 'true'
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify')) {
          return 'abc123\n' // Remote branch exists
        }
        return Buffer.from('')
      })
    })

    it('should run git checkout -- . and git clean -fd before branch switch', () => {
      ensureFeatureBranch('260218-ci-task', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      expect(calls).toContain('git checkout -- .')
      expect(calls).toContain('git clean -fd')

      // Cleanup commands should come before the branch checkout
      const checkoutDotIdx = calls.indexOf('git checkout -- .')
      const cleanIdx = calls.indexOf('git clean -fd')
      const branchCheckoutIdx = calls.indexOf('git checkout feat/260218-ci-task')

      expect(checkoutDotIdx).toBeLessThan(branchCheckoutIdx)
      expect(cleanIdx).toBeLessThan(branchCheckoutIdx)
    })

    it('should NOT run git status --porcelain or git stash in CI mode', () => {
      ensureFeatureBranch('260218-ci-task', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      expect(calls).not.toContain('git status --porcelain')
      expect(calls).not.toContain('git stash --include-untracked')
    })

    it('should not fail if cleanup commands throw', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify')) {
          return 'abc123\n'
        }
        if (
          typeof cmd === 'string' &&
          (cmd.includes('git checkout -- .') || cmd.includes('git clean -fd'))
        ) {
          throw new Error('cleanup failed')
        }
        return Buffer.from('')
      })

      expect(() => {
        ensureFeatureBranch('260218-ci-fail', 'implement_feature')
      }).not.toThrow()

      const calls = mockExecSync.mock.calls.map((c) => c[0])
      // Should still proceed to checkout the branch
      expect(calls).toContain('git checkout feat/260218-ci-fail')
      expect(calls).toContain('git pull origin feat/260218-ci-fail')
    })
  })

  describe('dirty-state cleanup (local mode)', () => {
    beforeEach(() => {
      delete process.env.GITHUB_ACTIONS
    })

    it('should check git status --porcelain and stash if dirty', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify')) {
          return 'abc123\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git status --porcelain')) {
          return ' M src/dirty-file.ts\n'
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-local-dirty', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      expect(calls).toContain('git status --porcelain')
      expect(calls).toContain('git stash --include-untracked')

      // Stash should come before the branch checkout
      const stashIdx = calls.indexOf('git stash --include-untracked')
      const branchCheckoutIdx = calls.indexOf('git checkout feat/260218-local-dirty')
      expect(stashIdx).toBeLessThan(branchCheckoutIdx)
    })

    it('should warn when stashing uncommitted changes', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify')) {
          return 'abc123\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git status --porcelain')) {
          return ' M src/dirty-file.ts\n'
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-local-warn', 'implement_feature')

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('uncommitted changes'))
    })

    it('should NOT stash if working tree is clean', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify')) {
          return 'abc123\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git status --porcelain')) {
          return '' // Clean working tree
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-local-clean', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      expect(calls).toContain('git status --porcelain')
      expect(calls).not.toContain('git stash --include-untracked')
    })

    it('should NOT run git checkout -- . or git clean -fd in local mode', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify')) {
          return 'abc123\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git status --porcelain')) {
          return ''
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-local-no-clean', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      expect(calls).not.toContain('git checkout -- .')
      expect(calls).not.toContain('git clean -fd')
    })

    it('should not fail if git status --porcelain throws', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify')) {
          return 'abc123\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git status --porcelain')) {
          throw new Error('status check failed')
        }
        return Buffer.from('')
      })

      expect(() => {
        ensureFeatureBranch('260218-local-status-fail', 'implement_feature')
      }).not.toThrow()

      const calls = mockExecSync.mock.calls.map((c) => c[0])
      // Should still proceed to checkout the branch
      expect(calls).toContain('git checkout feat/260218-local-status-fail')
    })

    it('should not cleanup when creating a new branch (remote does not exist)', () => {
      // Default mock: rev-parse throws (no remote branch)
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify')) {
          throw new Error('fatal: not found')
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-new-branch', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      // Cleanup commands should NOT run when creating a new branch
      expect(calls).not.toContain('git status --porcelain')
      expect(calls).not.toContain('git stash --include-untracked')
      expect(calls).not.toContain('git checkout -- .')
      expect(calls).not.toContain('git clean -fd')

      // Should still create the branch normally
      expect(calls).toContain('git checkout -b feat/260218-new-branch')
    })
  })

  // --------------------------------------------------------------------------
  // Execution order
  // --------------------------------------------------------------------------

  describe('execution order', () => {
    it('should call git commands in correct order for new branch creation', () => {
      const callOrder: string[] = []

      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string') {
          callOrder.push(cmd)
        }
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify')) {
          throw new Error('not found')
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-ordered', 'implement_feature')

      expect(callOrder).toEqual([
        'git branch --show-current',
        'git fetch origin',
        'git rev-parse --verify origin/feat/260218-ordered',
        'git checkout dev',
        'git pull origin dev',
        'git checkout -b feat/260218-ordered',
      ])
    })

    it('should call git commands in correct order for existing remote branch (local mode)', () => {
      const callOrder: string[] = []

      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string') {
          callOrder.push(cmd)
        }
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify')) {
          return 'abc123\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git status --porcelain')) {
          return '' // Clean working tree
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-existing', 'fix_bug')

      expect(callOrder).toEqual([
        'git branch --show-current',
        'git fetch origin',
        'git rev-parse --verify origin/fix/260218-existing',
        'git status --porcelain',
        'git checkout fix/260218-existing',
        'git pull origin fix/260218-existing',
      ])
    })

    it('should call git commands in correct order for existing remote branch (CI mode)', () => {
      process.env.GITHUB_ACTIONS = 'true'
      const callOrder: string[] = []

      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string') {
          callOrder.push(cmd)
        }
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify')) {
          return 'abc123\n'
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-existing', 'fix_bug')

      expect(callOrder).toEqual([
        'git branch --show-current',
        'git fetch origin',
        'git rev-parse --verify origin/fix/260218-existing',
        'git checkout -- .',
        'git clean -fd',
        'git checkout fix/260218-existing',
        'git pull origin fix/260218-existing',
      ])
    })
  })
})
