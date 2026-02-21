import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as childProcess from 'child_process'

// Mock child_process.execSync before importing the module
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}))

import {
  ensureFeatureBranch,
  getDefaultBranch,
  BRANCH_PREFIX_MAP,
  commitPipelineFiles,
} from '../../../../scripts/cody/git-utils'

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

    // Default: current branch is 'dev', local branch does NOT exist, remote might exist
    mockExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
        return 'dev\n'
      }
      // Check for local branch (no origin/ prefix) - by default, doesn't exist (throw)
      if (
        typeof cmd === 'string' &&
        cmd.includes('git rev-parse --verify ') &&
        !cmd.includes('origin/')
      ) {
        throw new Error('fatal: Needed a single revision')
      }
      // Check for remote branch - by default, doesn't exist (throw)
      // Tests that need remote to exist will override this
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
        // Local branch check: throw (doesn't exist), remote branch check: return (exists)
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify ')) {
          if (cmd.includes('origin/')) {
            return 'abc123\n' // Remote exists
          }
          throw new Error('fatal: Needed a single revision') // Local doesn't exist
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
  // Behavior tests (resilient to internal refactoring)
  // --------------------------------------------------------------------------

  describe('behavior', () => {
    it('should create new branch when neither local nor remote exists', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        // Neither local nor remote exists
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify')) {
          throw new Error('not found')
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-new-behavior', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      // Should create new branch
      expect(calls).toContain('git checkout -b feat/260218-new-behavior')
      // Should not try to checkout existing branch
      expect(calls).not.toContain('git checkout feat/260218-new-behavior')
    })

    it('should checkout existing remote branch when it exists', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        // Local doesn't exist, remote does
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify ')) {
          if (cmd.includes('origin/')) {
            return 'abc123\n' // Remote exists
          }
          throw new Error('not found') // Local doesn't exist
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-remote-exists', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      // Should checkout existing branch (not create new)
      expect(calls).toContain('git checkout feat/260218-remote-exists')
      expect(calls).not.toContain('git checkout -b')
      // Should pull from remote
      expect(calls).toContain('git pull origin feat/260218-remote-exists')
    })

    it('should checkout existing local branch when only local exists', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        // Remote doesn't exist, local does
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify ')) {
          if (cmd.includes('origin/')) {
            throw new Error('not found') // Remote doesn't exist
          }
          return 'abc123\n' // Local exists
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-local-only', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      // Should checkout existing local branch (not create new)
      expect(calls).toContain('git checkout feat/260218-local-only')
      expect(calls).not.toContain('git checkout -b')
    })

    it('should stash and restore dirty working tree when checking out local branch', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify ')) {
          if (cmd.includes('origin/')) {
            throw new Error('not found') // Remote doesn't exist
          }
          return 'abc123\n' // Local exists
        }
        // Dirty working tree triggers stash
        if (typeof cmd === 'string' && cmd.includes('git status --porcelain')) {
          return ' M status.json\n'
        }
        // Stash exists after stash
        if (typeof cmd === 'string' && cmd.includes('git stash list')) {
          return 'stash@{0}: ...\n'
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-dirty-local', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      // Should stash before checkout
      expect(calls).toContain('git stash --include-untracked')
      // Should restore stash after checkout
      expect(calls).toContain('git stash pop')
    })

    it('should not stash in CI mode', () => {
      process.env.GITHUB_ACTIONS = 'true'
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify ')) {
          if (cmd.includes('origin/')) {
            throw new Error('not found') // Remote doesn't exist
          }
          return 'abc123\n' // Local exists
        }
        if (typeof cmd === 'string' && cmd.includes('git status --porcelain')) {
          return ' M status.json\n'
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-ci-local', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      // Should NOT stash in CI mode
      expect(calls).not.toContain('git stash --include-untracked')
      expect(calls).not.toContain('git stash pop')

      // Clean instead
      expect(calls).toContain('git checkout -- .')
      expect(calls).toContain('git clean -fd')
    })
  })

  // --------------------------------------------------------------------------
  // Local branch exists (BUG-17: resume from previous failed run)
  // --------------------------------------------------------------------------

  describe('local branch exists (resume from previous run)', () => {
    it('should checkout existing local branch and not create new one', () => {
      let callCount = 0
      mockExecSync.mockImplementation((cmd: string) => {
        callCount++
        // Current branch is dev
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        // Local branch exists (no origin/ prefix)
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify feat/')) {
          return 'abc123\n'
        }
        // Remote branch does NOT exist (origin/feat/ throws)
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify origin/feat/')) {
          throw new Error('fatal: needed a single revision')
        }
        // Working tree is clean
        if (typeof cmd === 'string' && cmd.includes('git status --porcelain')) {
          return ''
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-local-resume', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      // Should checkout existing local branch, NOT create new one
      expect(calls).toContain('git checkout feat/260218-local-resume')
      expect(calls).not.toContain('git checkout -b feat/260218-local-resume')
    })

    it('should stash dirty working tree before switching to local branch', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        // Local branch exists
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify feat/')) {
          return 'abc123\n'
        }
        // Remote branch does NOT exist
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify origin/feat/')) {
          throw new Error('fatal: needed a single revision')
        }
        // Working tree has changes - return non-empty to trigger stash
        if (typeof cmd === 'string' && cmd.includes('git status --porcelain')) {
          return ' M .tasks/260218-local-resume/status.json\n'
        }
        // Stash list has entries after stash (simulate stash was created)
        if (typeof cmd === 'string' && cmd.includes('git stash list')) {
          return 'stash@{0}: ...\n'
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-local-resume', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      // Should stash before checkout
      const stashIdx = calls.indexOf('git stash --include-untracked')
      const checkoutIdx = calls.indexOf('git checkout feat/260218-local-resume')
      expect(stashIdx).toBeLessThan(checkoutIdx)

      // Should pop stash after checkout (when stash list was non-empty)
      const stashPopIdx = calls.indexOf('git stash pop')
      expect(stashPopIdx).toBeGreaterThan(checkoutIdx)
    })

    it('should try to push local branch to remote', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify feat/')) {
          return 'abc123\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify origin/feat/')) {
          throw new Error('fatal: needed a single revision')
        }
        if (typeof cmd === 'string' && cmd.includes('git status --porcelain')) {
          return ''
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-push-test', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      expect(calls).toContain('git push origin feat/260218-push-test')
    })
  })

  // --------------------------------------------------------------------------
  // Merge default branch into feature branch (re-run with updated dev)
  // --------------------------------------------------------------------------

  describe('merge default branch after pulling remote feature branch', () => {
    it('should merge default branch after pulling remote feature branch', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        // Remote branch exists
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify ')) {
          if (cmd.includes('origin/')) {
            return 'abc123\n'
          }
          throw new Error('not found')
        }
        if (typeof cmd === 'string' && cmd.includes('git status --porcelain')) {
          return ''
        }
        // git symbolic-ref for getDefaultBranch - used by the merge step
        if (typeof cmd === 'string' && cmd.includes('git symbolic-ref')) {
          return 'refs/remotes/origin/dev\n'
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-merge-test', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      // Should checkout and pull feature branch first
      expect(calls).toContain('git checkout feat/260218-merge-test')
      expect(calls).toContain('git pull origin feat/260218-merge-test')
      // Should merge default branch after pulling feature branch
      expect(calls).toContain('git merge origin/dev --no-edit')
    })

    it('should merge default branch after pulling local-only feature branch', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        // Remote doesn't exist, local does
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify ')) {
          if (cmd.includes('origin/')) {
            throw new Error('not found')
          }
          return 'abc123\n' // Local exists
        }
        if (typeof cmd === 'string' && cmd.includes('git status --porcelain')) {
          return ''
        }
        if (typeof cmd === 'string' && cmd.includes('git symbolic-ref')) {
          return 'refs/remotes/origin/dev\n'
        }
        return Buffer.from('')
      })

      ensureFeatureBranch('260218-local-merge-test', 'implement_feature')

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      // Should checkout local branch
      expect(calls).toContain('git checkout feat/260218-local-merge-test')
      // Should merge default branch
      expect(calls).toContain('git merge origin/dev --no-edit')
    })

    it('should abort merge and throw error on conflict', () => {
      let mergeAttempted = false
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('git branch --show-current')) {
          return 'dev\n'
        }
        if (typeof cmd === 'string' && cmd.includes('git rev-parse --verify ')) {
          if (cmd.includes('origin/')) {
            return 'abc123\n'
          }
          throw new Error('not found')
        }
        if (typeof cmd === 'string' && cmd.includes('git status --porcelain')) {
          return ''
        }
        if (typeof cmd === 'string' && cmd.includes('git symbolic-ref')) {
          return 'refs/remotes/origin/dev\n'
        }
        // Simulate merge conflict
        if (typeof cmd === 'string' && cmd.includes('git merge origin/')) {
          mergeAttempted = true
          throw new Error('Merge failed: Conflict in file.txt')
        }
        return Buffer.from('')
      })

      expect(() => {
        ensureFeatureBranch('260218-conflict-test', 'implement_feature')
      }).toThrow()

      const calls = mockExecSync.mock.calls.map((c) => c[0])

      // Should have attempted merge
      expect(mergeAttempted).toBe(true)
      // Should abort merge after conflict
      expect(calls).toContain('git merge --abort')
    })
  })
})

// ============================================================================
// getDefaultBranch
// ============================================================================

describe('getDefaultBranch', () => {
  const mockExecSync = vi.mocked(childProcess.execSync)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return branch from git symbolic-ref when available', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('symbolic-ref')) {
        return 'refs/remotes/origin/dev\n'
      }
      return ''
    })

    expect(getDefaultBranch('/fake/cwd')).toBe('dev')
  })

  it('should return "main" when symbolic-ref points to main', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('symbolic-ref')) {
        return 'refs/remotes/origin/main\n'
      }
      return ''
    })

    expect(getDefaultBranch('/fake/cwd')).toBe('main')
  })

  it('should fall back to git remote show origin when symbolic-ref fails', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('symbolic-ref')) {
        throw new Error('not a symbolic ref')
      }
      if (typeof cmd === 'string' && cmd.includes('git remote show origin')) {
        return '* remote origin\n  HEAD branch: main\n  Remote branches:\n'
      }
      return ''
    })

    expect(getDefaultBranch('/fake/cwd')).toBe('main')
  })

  it('should return "dev" when both methods fail', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('not a git repo')
    })

    expect(getDefaultBranch('/fake/cwd')).toBe('dev')
  })

  it('should use process.cwd() as default when no cwd provided', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('symbolic-ref')) {
        return 'refs/remotes/origin/dev\n'
      }
      return ''
    })

    // Call without cwd argument
    expect(getDefaultBranch()).toBe('dev')
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cwd: process.cwd() }),
    )
  })

  it('should pass cwd to all git commands', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('symbolic-ref')) {
        return 'refs/remotes/origin/dev\n'
      }
      return ''
    })

    getDefaultBranch('/my/project')
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cwd: '/my/project' }),
    )
  })

  it('should fall back to "dev" when symbolic-ref returns empty and remote show fails', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('symbolic-ref')) {
        return '\n' // empty trimmed
      }
      if (typeof cmd === 'string' && cmd.includes('git remote show origin')) {
        throw new Error('network error')
      }
      return ''
    })

    expect(getDefaultBranch('/fake/cwd')).toBe('dev')
  })
})

// ============================================================================
// commitPipelineFiles
// ============================================================================

describe('commitPipelineFiles', () => {
  beforeEach(() => {
    vi.mocked(childProcess.execSync).mockClear()
    vi.mocked(childProcess.execFileSync).mockClear()
  })

  it('should use task-only staging by default', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('')
    vi.mocked(childProcess.execFileSync).mockReturnValue(Buffer.from(''))

    commitPipelineFiles({
      taskDir: '.tasks/260218-test',
      taskId: '260218-test',
      message: 'test commit',
    })

    // Should call git add with taskDir via execFileSync (shell injection fix)
    expect(childProcess.execFileSync).toHaveBeenCalledWith(
      'git',
      ['add', '--', '.tasks/260218-test'],
      expect.objectContaining({ stdio: 'inherit' }),
    )
  })

  it('should use tracked+task staging when specified', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('')
    vi.mocked(childProcess.execFileSync).mockReturnValue(Buffer.from(''))

    commitPipelineFiles({
      taskDir: '.tasks/260218-test',
      taskId: '260218-test',
      message: 'test commit',
      stagingStrategy: 'tracked+task',
    })

    // Should call git add -u then git add taskDir
    const syncCalls = vi.mocked(childProcess.execSync).mock.calls
    expect(syncCalls.some((c) => c[0] === 'git add -u')).toBe(true)

    // Task dir should be added via execFileSync
    const fileSyncCalls = vi.mocked(childProcess.execFileSync).mock.calls
    expect(fileSyncCalls.some((c) => c[0] === 'git' && c[1]?.[0] === 'add')).toBe(true)
  })

  it('should handle nothing to commit gracefully', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('')
    vi.mocked(childProcess.execFileSync).mockImplementation(() => {
      throw new Error('nothing to commit')
    })

    const result = commitPipelineFiles({
      taskDir: '.tasks/260218-test',
      taskId: '260218-test',
      message: 'test commit',
    })

    expect(result.success).toBe(true)
    expect(result.committed).toBe(false)
  })

  it('should throw on commit error (except nothing to commit)', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('')
    vi.mocked(childProcess.execFileSync).mockImplementation(() => {
      throw new Error('some other error')
    })

    const result = commitPipelineFiles({
      taskDir: '.tasks/260218-test',
      taskId: '260218-test',
      message: 'test commit',
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain('some other error')
  })

  it('should optionally push after commit', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('')
    vi.mocked(childProcess.execFileSync).mockReturnValue(Buffer.from(''))

    commitPipelineFiles({
      taskDir: '.tasks/260218-test',
      taskId: '260218-test',
      message: 'test commit',
      push: true,
    })

    // Should have called git commit via execFileSync (BUG-5 fix: no shell injection)
    expect(childProcess.execFileSync).toHaveBeenCalledWith(
      'git',
      ['commit', '--no-gpg-sign', '-m', 'test commit'],
      expect.objectContaining({ stdio: 'inherit' }),
    )
    // Should have called git push
    expect(childProcess.execSync).toHaveBeenCalledWith(
      'git push -u origin HEAD',
      expect.objectContaining({ stdio: 'inherit' }),
    )
  })
})

describe('commitAndPush staging behavior', () => {
  // Note: commitAndPush is tested here instead of the main test suite
  // because it requires more complex setup (file system mocking)

  it('should export SAFE_STAGE_DIRS constant', async () => {
    const { SAFE_STAGE_DIRS } = await import('../../../../scripts/cody/git-utils')
    expect(SAFE_STAGE_DIRS).toContain('src/')
    expect(SAFE_STAGE_DIRS).toContain('tests/')
    expect(SAFE_STAGE_DIRS).toContain('.tasks/')
  })
})

// Phase 2.2: Shell injection fix verification
describe('commitPipelineFiles shell safety', () => {
  it('should use execFileSync for git add to prevent path injection', async () => {
    const { commitPipelineFiles } = await import('../../../../scripts/cody/git-utils')

    vi.mocked(childProcess.execSync).mockReturnValue('')
    vi.mocked(childProcess.execFileSync).mockImplementation(
      (file: string, args?: readonly string[]) => {
        // Track calls for verification
        if (file === 'git' && args?.[0] === 'add') {
          // This is the call we want to verify
        }
        return Buffer.from('')
      },
    )

    commitPipelineFiles({
      taskDir: '/path with spaces/.tasks/test',
      taskId: 'test',
      message: 'test commit',
      stagingStrategy: 'task-only',
    })

    // Verify execFileSync was used for git add (not execSync with string interpolation)
    const gitAddCalls = vi
      .mocked(childProcess.execFileSync)
      .mock.calls.filter((call) => call[0] === 'git' && call[1]?.[0] === 'add')
    expect(gitAddCalls.length).toBeGreaterThan(0)
  })
})
