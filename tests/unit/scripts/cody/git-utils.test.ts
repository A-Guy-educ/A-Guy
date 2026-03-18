import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as childProcess from 'child_process'

// Mock child_process.execFileSync before importing the module
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}))

// Helper to convert execFileSync calls to command strings for assertions
// execFileSync(file: string, args: string[], options) -> "file args..."
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toCommandString = (call: any): string => {
  return `${call[0]} ${(call[1] || []).join(' ')}`
}

// Mock logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
  trace: vi.fn(),
  silent: vi.fn(),
  level: 'info',
}))

vi.mock('../../../../scripts/cody/logger', () => ({
  logger: mockLogger,
  createStageLogger: vi.fn().mockReturnValue(mockLogger),
}))

import {
  ensureFeatureBranch,
  getDefaultBranch,
  BRANCH_PREFIX_MAP,
  commitPipelineFiles,
  deriveBranchName,
  pushWithRebase,
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
// deriveBranchName
// ============================================================================

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('deriveBranchName', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-branch-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('returns taskId when task.md does not exist', () => {
    const result = deriveBranchName(tempDir, '260225-auto-90')
    expect(result).toBe('260225-auto-90')
  })

  it('extracts issue title from ## Issue Title section', () => {
    // Use simple format without extra special chars
    fs.writeFileSync(
      path.join(tempDir, 'task.md'),
      `## Issue Title
Remove type casts from guest sessions
`,
    )

    const result = deriveBranchName(tempDir, '260225-auto-90')
    expect(result.startsWith('260225-')).toBe(true)
    expect(result).toContain('remove')
    expect(result).toContain('type')
    expect(result).toContain('casts')
  })

  it('uses first non-header line when no issue title', () => {
    fs.writeFileSync(
      path.join(tempDir, 'task.md'),
      `# Task
This is a simple task description.
`,
    )

    const result = deriveBranchName(tempDir, '260225-auto-90')
    expect(result.startsWith('260225-')).toBe(true)
    expect(result).toContain('simple')
    expect(result).toContain('task')
  })

  it('trims to max 50 characters total', () => {
    const longTitle =
      'This is a very long title that exceeds the maximum character limit for branch names when combined with date prefix'
    fs.writeFileSync(
      path.join(tempDir, 'task.md'),
      `## Issue Title
${longTitle}
`,
    )

    const result = deriveBranchName(tempDir, '260225-auto-90')
    expect(result.length).toBeLessThanOrEqual(50)
    expect(result.startsWith('260225-')).toBe(true)
  })

  it('removes special characters and sanitizes', () => {
    fs.writeFileSync(
      path.join(tempDir, 'task.md'),
      `## Issue Title
Fix Auth and media persistence issue
`,
    )

    const result = deriveBranchName(tempDir, '260225-auto-90')
    expect(result.startsWith('260225-')).toBe(true)
    expect(result).toContain('fix')
    expect(result).toContain('auth')
    expect(result).toContain('media')
  })

  it('returns taskId when task.md is empty', () => {
    fs.writeFileSync(path.join(tempDir, 'task.md'), '')

    const result = deriveBranchName(tempDir, '260225-auto-90')
    expect(result).toBe('260225-auto-90')
  })

  describe('issue number embedding', () => {
    let savedIssueNumber: string | undefined

    beforeEach(() => {
      savedIssueNumber = process.env.ISSUE_NUMBER
    })

    afterEach(() => {
      if (savedIssueNumber !== undefined) {
        process.env.ISSUE_NUMBER = savedIssueNumber
      } else {
        delete process.env.ISSUE_NUMBER
      }
    })

    it('embeds issue number in branch name when ISSUE_NUMBER is set', () => {
      process.env.ISSUE_NUMBER = '621'
      fs.writeFileSync(
        path.join(tempDir, 'task.md'),
        `## Issue Title
Bug Report HTML SVG Content Rendering Failure
`,
      )

      const result = deriveBranchName(tempDir, '260227-auto-77')
      expect(result).toContain('-621-')
      expect(result.startsWith('260227-auto-')).toBe(true)
      expect(result).toContain('bug')
    })

    it('does not embed issue number when ISSUE_NUMBER is not set', () => {
      delete process.env.ISSUE_NUMBER
      fs.writeFileSync(
        path.join(tempDir, 'task.md'),
        `## Issue Title
Some feature title
`,
      )

      const result = deriveBranchName(tempDir, '260227-auto-77')
      expect(result).not.toMatch(/-\d{3,}-/)
      expect(result.startsWith('260227-auto-')).toBe(true)
    })

    it('still respects 50 char limit with issue number', () => {
      process.env.ISSUE_NUMBER = '12345'
      const longTitle =
        'This is a very long title that exceeds the maximum character limit for branch names'
      fs.writeFileSync(
        path.join(tempDir, 'task.md'),
        `## Issue Title
${longTitle}
`,
      )

      const result = deriveBranchName(tempDir, '260225-auto-90')
      expect(result.length).toBeLessThanOrEqual(50)
      expect(result).toContain('-12345-')
      expect(result.startsWith('260225-')).toBe(true)
    })

    it('produces different branch names for different issues on same day', () => {
      fs.writeFileSync(
        path.join(tempDir, 'task.md'),
        `## Issue Title
Some task title
`,
      )

      process.env.ISSUE_NUMBER = '501'
      const branch1 = deriveBranchName(tempDir, '260227-auto-50')

      process.env.ISSUE_NUMBER = '621'
      const branch2 = deriveBranchName(tempDir, '260227-auto-77')

      // Different issue numbers → different branch names
      expect(branch1).not.toBe(branch2)
      expect(branch1).toContain('-501-')
      expect(branch2).toContain('-621-')
    })
  })
})

// ============================================================================
// ensureFeatureBranch
// ============================================================================

describe('ensureFeatureBranch', () => {
  const mockExecFileSync = vi.mocked(childProcess.execFileSync)
  let savedGithubActions: string | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    mockLogger.info.mockClear()
    mockLogger.warn.mockClear()
    savedGithubActions = process.env.GITHUB_ACTIONS
    delete process.env.GITHUB_ACTIONS

    // Default: current branch is 'dev', local branch does NOT exist, remote might exist
    // execFileSync(file, args, options)

    mockExecFileSync.mockImplementation(((
      file: string,
      args: readonly string[] = [],
      ..._rest: unknown[]
    ) => {
      const cmd = args.join(' ')
      if (file === 'git' && cmd.includes('branch --show-current')) {
        return 'dev\n'
      }
      // Check for local branch (no origin/ prefix) - by default, doesn't exist (throw)
      if (file === 'git' && cmd.includes('rev-parse --verify ') && !cmd.includes('origin/')) {
        throw new Error('fatal: Needed a single revision')
      }
      // Check for remote branch - by default, doesn't exist (throw)
      // Tests that need remote to exist will override this
      if (file === 'git' && cmd.includes('rev-parse --verify origin/')) {
        throw new Error('fatal: Needed a single revision')
      }
      if (file === 'git' && cmd.includes('status --porcelain')) {
        return '' // Clean working tree by default
      }
      // All other commands (fetch, checkout, pull) succeed silently
      return Buffer.from('')
    }) as typeof mockExecFileSync)
  })

  afterEach(() => {
    if (savedGithubActions !== undefined) {
      process.env.GITHUB_ACTIONS = savedGithubActions
    } else {
      delete process.env.GITHUB_ACTIONS
    }
  })

  // --------------------------------------------------------------------------
  // Early return: already on a feature branch
  // --------------------------------------------------------------------------

  describe('when already on a feature branch', () => {
    it('should return early without creating a branch', () => {
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'feat/260218-existing-task\n'
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      ensureFeatureBranch('260218-my-task', 'implement_feature')

      // Should only call git branch --show-current, nothing else
      expect(mockExecFileSync).toHaveBeenCalledTimes(1)
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'git',
        ['branch', '--show-current'],
        expect.objectContaining({ encoding: 'utf-8' }),
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[branch] Already on feature branch: feat/260218-existing-task',
      )
    })

    it('should return early for any non-base branch name', () => {
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'fix/260218-some-bug\n'
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      ensureFeatureBranch('260218-other-task', 'fix_bug')

      expect(mockExecFileSync).toHaveBeenCalledTimes(1)
    })
  })

  // --------------------------------------------------------------------------
  // Remote branch exists: checkout + pull
  // --------------------------------------------------------------------------

  describe('when on dev and remote branch exists', () => {
    beforeEach(() => {
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        // Local branch check: throw (doesn't exist), remote branch check: return (exists)
        if (file === 'git' && cmd.includes('rev-parse --verify ')) {
          if (cmd.includes('origin/')) {
            return 'abc123\n' // Remote exists
          }
          throw new Error('fatal: Needed a single revision') // Local doesn't exist
        }
        if (file === 'git' && cmd.includes('status --porcelain')) {
          return '' // Clean working tree
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)
    })

    it('should checkout and pull the existing remote branch', () => {
      ensureFeatureBranch('260218-my-task', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      expect(calls).toContain('git fetch origin')
      expect(calls).toContain('git rev-parse --verify origin/feat/260218-my-task')
      expect(calls).toContain('git checkout feat/260218-my-task')
      expect(calls).toContain('git pull origin feat/260218-my-task')
    })

    it('should NOT create a new branch', () => {
      ensureFeatureBranch('260218-my-task', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      expect(calls).not.toContain(expect.stringContaining('checkout -b'))
      expect(calls).not.toContain('git checkout dev')
    })

    it('should log that remote branch exists', () => {
      ensureFeatureBranch('260218-my-task', 'implement_feature')

      expect(mockLogger.info).toHaveBeenCalledWith(
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

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      expect(calls).toContain('git fetch origin')
      expect(calls).toContain('git checkout dev')
      expect(calls).toContain('git pull origin dev')
      expect(calls).toContain('git checkout -b feat/260218-my-task')
    })

    it('should NOT checkout an existing remote branch', () => {
      ensureFeatureBranch('260218-my-task', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      // Should not have plain checkout (without -b) for the feature branch
      expect(calls).not.toContain('git checkout feat/260218-my-task')
      expect(calls).not.toContain('git pull origin feat/260218-my-task')
    })

    it('should log that a new branch is being created', () => {
      ensureFeatureBranch('260218-my-task', 'implement_feature')

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[branch] Creating new branch from dev: feat/260218-my-task',
      )
    })
  })

  // --------------------------------------------------------------------------
  // On main: should also create feature branch
  // --------------------------------------------------------------------------

  describe('when on main', () => {
    beforeEach(() => {
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'main\n'
        }
        if (file === 'git' && cmd.includes('rev-parse --verify')) {
          throw new Error('fatal: Needed a single revision')
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)
    })

    it('should create a feature branch (same as from dev)', () => {
      ensureFeatureBranch('260218-my-task', 'fix_bug')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

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
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return '\n'
        }
        if (file === 'git' && cmd.includes('rev-parse --verify')) {
          throw new Error('fatal: Needed a single revision')
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)
    })

    it('should create a feature branch', () => {
      ensureFeatureBranch('260218-my-task', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      expect(calls).toContain('git checkout -b feat/260218-my-task')
    })
  })

  // --------------------------------------------------------------------------
  // Branch naming
  // --------------------------------------------------------------------------

  describe('branch naming', () => {
    it('should name fix_bug branch as "fix/<taskId>"', () => {
      ensureFeatureBranch('260218-my-task', 'fix_bug')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)
      expect(calls).toContain('git checkout -b fix/260218-my-task')
    })

    it('should name implement_feature branch as "feat/<taskId>"', () => {
      ensureFeatureBranch('260218-task', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)
      expect(calls).toContain('git checkout -b feat/260218-task')
    })

    it('should name refactor branch as "refactor/<taskId>"', () => {
      ensureFeatureBranch('260218-cleanup', 'refactor')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)
      expect(calls).toContain('git checkout -b refactor/260218-cleanup')
    })

    it('should name docs branch as "docs/<taskId>"', () => {
      ensureFeatureBranch('260218-readme', 'docs')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)
      expect(calls).toContain('git checkout -b docs/260218-readme')
    })

    it('should name ops branch as "chore/<taskId>"', () => {
      ensureFeatureBranch('260218-ci-fix', 'ops')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)
      expect(calls).toContain('git checkout -b chore/260218-ci-fix')
    })

    it('should name research branch as "feat/<taskId>"', () => {
      ensureFeatureBranch('260218-spike', 'research')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)
      expect(calls).toContain('git checkout -b feat/260218-spike')
    })

    it('should name spec_only branch as "feat/<taskId>"', () => {
      ensureFeatureBranch('260218-spec', 'spec_only')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)
      expect(calls).toContain('git checkout -b feat/260218-spec')
    })
  })

  // --------------------------------------------------------------------------
  // Unknown task type defaults to 'feat'
  // --------------------------------------------------------------------------

  describe('unknown task type', () => {
    it('should default to "feat" prefix for unknown task types', () => {
      ensureFeatureBranch('260218-mystery', 'unknown_type')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)
      expect(calls).toContain('git checkout -b feat/260218-mystery')
    })

    it('should default to "feat" prefix for empty string task type', () => {
      ensureFeatureBranch('260218-no-type', '')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)
      expect(calls).toContain('git checkout -b feat/260218-no-type')
    })
  })

  // --------------------------------------------------------------------------
  // Custom projectDir: cwd is passed to all execFileSync calls
  // --------------------------------------------------------------------------

  describe('custom projectDir', () => {
    it('should pass custom cwd to all execFileSync calls', () => {
      const customDir = '/custom/project/dir'

      ensureFeatureBranch('260218-task', 'implement_feature', customDir)

      // Every execFileSync call should have received cwd = customDir
      // execFileSync(file, args, options) - options is at index 2
      for (const call of mockExecFileSync.mock.calls) {
        const opts = call[2] as Record<string, unknown> | undefined
        expect(opts?.cwd).toBe(customDir)
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
      // execFileSync(file, args, options) - options is at index 2
      const firstCallOpts = mockExecFileSync.mock.calls[0][2] as Record<string, unknown> | undefined
      expect(firstCallOpts?.cwd).toBe('/mocked/cwd')

      cwdSpy.mockRestore()
    })

    it('should use process.cwd() for all execFileSync calls when projectDir is undefined', () => {
      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/default/cwd')

      ensureFeatureBranch('260218-task', 'fix_bug')

      for (const call of mockExecFileSync.mock.calls) {
        // execFileSync(file, args, options) - options is at index 2
        const opts = call[2] as Record<string, unknown> | undefined
        expect(opts?.cwd).toBe('/default/cwd')
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

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

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
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        if (file === 'git' && cmd.includes('rev-parse --verify')) {
          return 'abc123\n' // Remote branch exists
        }
        if (file === 'git' && cmd.includes('symbolic-ref')) {
          return 'refs/heads/dev\n'
        }
        if (file === 'git' && cmd.includes('merge')) {
          return 'Already up to date.\n'
        }
        if (file === 'git' && cmd.includes('checkout') && cmd.includes('feat/')) {
          return Buffer.from(`Switched to branch 'feat/260218-ci-task'\n`)
        }
        if (file === 'git' && cmd.includes('pull origin')) {
          return 'Already up to date.\n'
        }
        // Default: return empty success
        return Buffer.from('')
      }) as typeof mockExecFileSync)
    })

    it('should run git checkout -- . before branch switch (no git clean -fd)', () => {
      ensureFeatureBranch('260218-ci-task', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      // Should run git checkout -- . to revert tracked files
      expect(calls).toContain('git checkout -- .')
      // git clean -fd was removed to avoid deleting untracked agent-created files

      // Verify checkout -- . comes before any branch operations
      const checkoutDotIdx = calls.indexOf('git checkout -- .')
      expect(checkoutDotIdx).toBeGreaterThanOrEqual(0)
    })

    it('should NOT run git status --porcelain or git stash in CI mode', () => {
      ensureFeatureBranch('260218-ci-task', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      expect(calls).not.toContain('git status --porcelain')
      expect(calls).not.toContain('git stash --include-untracked')
    })

    it('should not fail if cleanup commands throw', () => {
      let checkoutDotThrown = false
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        if (file === 'git' && cmd.includes('rev-parse --verify')) {
          return 'abc123\n'
        }
        if (file === 'git' && cmd.includes('symbolic-ref')) {
          return 'refs/heads/dev\n'
        }
        if (file === 'git' && cmd.includes('checkout -- .')) {
          checkoutDotThrown = true
          throw new Error('cleanup failed')
        }
        if (file === 'git' && cmd.includes('checkout feat/')) {
          // After cleanup throws, should still try to checkout
          return Buffer.from(`Switched to branch 'feat/260218-ci-fail'\n`)
        }
        if (file === 'git' && cmd.includes('merge')) {
          return 'Already up to date.\n'
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      // Should not throw even when cleanup fails
      expect(() => {
        ensureFeatureBranch('260218-ci-fail', 'implement_feature')
      }).not.toThrow()

      // Verify that git checkout -- . was attempted (and threw)
      expect(checkoutDotThrown).toBe(true)
    })

    it('should actually checkout the feature branch in CI mode (not just clean dirty state)', () => {
      ensureFeatureBranch('260218-ci-task', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      // BUG FIX verification: Previously CI mode only ran "git checkout -- ."
      // but never actually switched to the feature branch. This caused commits
      // to land on dev (which has branch protection), failing the pipeline.
      expect(calls).toContain('git checkout feat/260218-ci-task')
      expect(calls).toContain('git pull origin feat/260218-ci-task')

      // Verify order: cleanup before checkout
      const cleanupIdx = calls.indexOf('git checkout -- .')
      const checkoutIdx = calls.indexOf('git checkout feat/260218-ci-task')
      expect(cleanupIdx).toBeLessThan(checkoutIdx)
    })

    it('should merge default branch after checkout in CI mode', () => {
      ensureFeatureBranch('260218-ci-task', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      // After checkout, should merge default branch to keep feature branch up-to-date
      const mergeCall = calls.find(
        (c) => c.startsWith('git merge origin/') && c.includes('--no-edit'),
      )
      expect(mergeCall).toBeDefined()

      // Verify order: checkout before merge
      const checkoutIdx = calls.indexOf('git checkout feat/260218-ci-task')
      const mergeIdx = calls.findIndex(
        (c) => c.startsWith('git merge origin/') && c.includes('--no-edit'),
      )
      expect(checkoutIdx).toBeLessThan(mergeIdx)
    })
  })

  describe('dirty-state cleanup (local mode)', () => {
    beforeEach(() => {
      delete process.env.GITHUB_ACTIONS
    })

    it('should check git status --porcelain and stash if dirty', () => {
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        if (file === 'git' && cmd.includes('rev-parse --verify')) {
          return 'abc123\n'
        }
        if (file === 'git' && cmd.includes('status --porcelain')) {
          return ' M src/dirty-file.ts\n'
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      ensureFeatureBranch('260218-local-dirty', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      expect(calls).toContain('git status --porcelain')
      expect(calls).toContain('git stash --include-untracked')

      // Stash should come before the branch checkout
      const stashIdx = calls.indexOf('git stash --include-untracked')
      const branchCheckoutIdx = calls.indexOf('git checkout feat/260218-local-dirty')
      expect(stashIdx).toBeLessThan(branchCheckoutIdx)
    })

    it('should warn when stashing uncommitted changes', () => {
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        if (file === 'git' && cmd.includes('rev-parse --verify')) {
          return 'abc123\n'
        }
        if (file === 'git' && cmd.includes('status --porcelain')) {
          return ' M src/dirty-file.ts\n'
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      ensureFeatureBranch('260218-local-warn', 'implement_feature')

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('uncommitted changes'))
    })

    it('should NOT stash if working tree is clean', () => {
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        if (file === 'git' && cmd.includes('rev-parse --verify')) {
          return 'abc123\n'
        }
        if (file === 'git' && cmd.includes('status --porcelain')) {
          return '' // Clean working tree
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      ensureFeatureBranch('260218-local-clean', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      expect(calls).toContain('git status --porcelain')
      expect(calls).not.toContain('git stash --include-untracked')
    })

    it('should NOT run git checkout -- . or git clean -fd in local mode', () => {
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        if (file === 'git' && cmd.includes('rev-parse --verify')) {
          return 'abc123\n'
        }
        if (file === 'git' && cmd.includes('status --porcelain')) {
          return ''
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      ensureFeatureBranch('260218-local-no-clean', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      expect(calls).not.toContain('git checkout -- .')
      expect(calls).not.toContain('git clean -fd')
    })

    it('should not fail if git status --porcelain throws', () => {
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        if (file === 'git' && cmd.includes('rev-parse --verify')) {
          return 'abc123\n'
        }
        if (file === 'git' && cmd.includes('status --porcelain')) {
          throw new Error('status check failed')
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      expect(() => {
        ensureFeatureBranch('260218-local-status-fail', 'implement_feature')
      }).not.toThrow()

      const calls = mockExecFileSync.mock.calls.map(toCommandString)
      // Should still proceed to checkout the branch
      expect(calls).toContain('git checkout feat/260218-local-status-fail')
    })

    it('should not cleanup when creating a new branch (remote does not exist)', () => {
      // Default mock: rev-parse throws (no remote branch)
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        if (file === 'git' && cmd.includes('rev-parse --verify')) {
          throw new Error('fatal: not found')
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      ensureFeatureBranch('260218-new-branch', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

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
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        // Neither local nor remote exists
        if (file === 'git' && cmd.includes('rev-parse --verify')) {
          throw new Error('not found')
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      ensureFeatureBranch('260218-new-behavior', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      // Should create new branch
      expect(calls).toContain('git checkout -b feat/260218-new-behavior')
      // Should not try to checkout existing branch
      expect(calls).not.toContain('git checkout feat/260218-new-behavior')
    })

    it('should checkout existing remote branch when it exists', () => {
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        // Local doesn't exist, remote does
        if (file === 'git' && cmd.includes('rev-parse --verify ')) {
          if (cmd.includes('origin/')) {
            return 'abc123\n' // Remote exists
          }
          throw new Error('not found') // Local doesn't exist
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      ensureFeatureBranch('260218-remote-exists', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      // Should checkout existing branch (not create new)
      expect(calls).toContain('git checkout feat/260218-remote-exists')
      expect(calls).not.toContain('git checkout -b')
      // Should pull from remote
      expect(calls).toContain('git pull origin feat/260218-remote-exists')
    })

    it('should checkout existing local branch when only local exists', () => {
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        // Remote doesn't exist, local does
        if (file === 'git' && cmd.includes('rev-parse --verify ')) {
          if (cmd.includes('origin/')) {
            throw new Error('not found') // Remote doesn't exist
          }
          return 'abc123\n' // Local exists
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      ensureFeatureBranch('260218-local-only', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      // Should checkout existing local branch (not create new)
      expect(calls).toContain('git checkout feat/260218-local-only')
      expect(calls).not.toContain('git checkout -b')
    })

    it('should stash and restore dirty working tree when checking out local branch', () => {
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        if (file === 'git' && cmd.includes('rev-parse --verify ')) {
          if (cmd.includes('origin/')) {
            throw new Error('not found') // Remote doesn't exist
          }
          return 'abc123\n' // Local exists
        }
        // Dirty working tree triggers stash
        if (file === 'git' && cmd.includes('status --porcelain')) {
          return ' M status.json\n'
        }
        // Stash exists after stash
        if (file === 'git' && cmd.includes('stash list')) {
          return 'stash@{0}: ...\n'
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      ensureFeatureBranch('260218-dirty-local', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      // Should stash before checkout
      expect(calls).toContain('git stash --include-untracked')
      // Should restore stash after checkout
      expect(calls).toContain('git stash pop')
    })

    it('should not stash in CI mode', () => {
      process.env.GITHUB_ACTIONS = 'true'
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        if (file === 'git' && cmd.includes('rev-parse --verify ')) {
          if (cmd.includes('origin/')) {
            throw new Error('not found') // Remote doesn't exist
          }
          return 'abc123\n' // Local exists
        }
        if (file === 'git' && cmd.includes('status --porcelain')) {
          return ' M status.json\n'
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      ensureFeatureBranch('260218-ci-local', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      // Should NOT stash in CI mode
      expect(calls).not.toContain('git stash --include-untracked')
      expect(calls).not.toContain('git stash pop')

      // Revert tracked files only (no git clean -fd to avoid deleting untracked agent files)
      expect(calls).toContain('git checkout -- .')
      // git clean -fd was removed
    })
  })

  // --------------------------------------------------------------------------
  // Local branch exists (BUG-17: resume from previous failed run)
  // --------------------------------------------------------------------------

  describe('local branch exists (resume from previous run)', () => {
    it('should checkout existing local branch and not create new one', () => {
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        // Current branch is dev
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        // Local branch exists (no origin/ prefix)
        if (file === 'git' && cmd.includes('rev-parse --verify feat/')) {
          return 'abc123\n'
        }
        // Remote branch does NOT exist (origin/feat/ throws)
        if (file === 'git' && cmd.includes('rev-parse --verify origin/feat/')) {
          throw new Error('fatal: needed a single revision')
        }
        // Working tree is clean
        if (file === 'git' && cmd.includes('status --porcelain')) {
          return ''
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      ensureFeatureBranch('260218-local-resume', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      // Should checkout existing local branch, NOT create new one
      expect(calls).toContain('git checkout feat/260218-local-resume')
      expect(calls).not.toContain('git checkout -b feat/260218-local-resume')
    })

    it('should stash dirty working tree before switching to local branch', () => {
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        // Local branch exists
        if (file === 'git' && cmd.includes('rev-parse --verify feat/')) {
          return 'abc123\n'
        }
        // Remote branch does NOT exist
        if (file === 'git' && cmd.includes('rev-parse --verify origin/feat/')) {
          throw new Error('fatal: needed a single revision')
        }
        // Working tree has changes - return non-empty to trigger stash
        if (file === 'git' && cmd.includes('status --porcelain')) {
          return ' M .tasks/260218-local-resume/status.json\n'
        }
        // Stash list has entries after stash (simulate stash was created)
        if (file === 'git' && cmd.includes('stash list')) {
          return 'stash@{0}: ...\n'
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      ensureFeatureBranch('260218-local-resume', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      // Should stash before checkout
      const stashIdx = calls.indexOf('git stash --include-untracked')
      const checkoutIdx = calls.indexOf('git checkout feat/260218-local-resume')
      expect(stashIdx).toBeLessThan(checkoutIdx)

      // Should pop stash after checkout (when stash list was non-empty)
      const stashPopIdx = calls.indexOf('git stash pop')
      expect(stashPopIdx).toBeGreaterThan(checkoutIdx)
    })

    it('should try to push local branch to remote', () => {
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        if (file === 'git' && cmd.includes('rev-parse --verify feat/')) {
          return 'abc123\n'
        }
        if (file === 'git' && cmd.includes('rev-parse --verify origin/feat/')) {
          throw new Error('fatal: needed a single revision')
        }
        if (file === 'git' && cmd.includes('status --porcelain')) {
          return ''
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      ensureFeatureBranch('260218-push-test', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      expect(calls).toContain('git push -u origin feat/260218-push-test')
    })
  })

  // --------------------------------------------------------------------------
  // Merge default branch into feature branch (re-run with updated dev)
  // --------------------------------------------------------------------------

  describe('merge default branch after pulling remote feature branch', () => {
    it('should merge default branch after pulling remote feature branch', () => {
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        // Remote branch exists
        if (file === 'git' && cmd.includes('rev-parse --verify ')) {
          if (cmd.includes('origin/')) {
            return 'abc123\n'
          }
          throw new Error('not found')
        }
        if (file === 'git' && cmd.includes('status --porcelain')) {
          return ''
        }
        // git symbolic-ref for getDefaultBranch - used by the merge step
        if (file === 'git' && cmd.includes('symbolic-ref')) {
          return 'refs/remotes/origin/dev\n'
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      ensureFeatureBranch('260218-merge-test', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      // Should checkout and pull feature branch first
      expect(calls).toContain('git checkout feat/260218-merge-test')
      expect(calls).toContain('git pull origin feat/260218-merge-test')
      // Should merge default branch after pulling feature branch
      expect(calls).toContain('git merge origin/dev --no-edit')
    })

    it('should merge default branch after pulling local-only feature branch', () => {
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        // Remote doesn't exist, local does
        if (file === 'git' && cmd.includes('rev-parse --verify ')) {
          if (cmd.includes('origin/')) {
            throw new Error('not found')
          }
          return 'abc123\n' // Local exists
        }
        if (file === 'git' && cmd.includes('status --porcelain')) {
          return ''
        }
        if (file === 'git' && cmd.includes('symbolic-ref')) {
          return 'refs/remotes/origin/dev\n'
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      ensureFeatureBranch('260218-local-merge-test', 'implement_feature')

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

      // Should checkout local branch
      expect(calls).toContain('git checkout feat/260218-local-merge-test')
      // Should merge default branch
      expect(calls).toContain('git merge origin/dev --no-edit')
    })

    it('should abort merge and throw error on conflict', () => {
      let mergeAttempted = false
      mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
        const cmd = args.join(' ')
        if (file === 'git' && cmd.includes('branch --show-current')) {
          return 'dev\n'
        }
        if (file === 'git' && cmd.includes('rev-parse --verify ')) {
          if (cmd.includes('origin/')) {
            return 'abc123\n'
          }
          throw new Error('not found')
        }
        if (file === 'git' && cmd.includes('status --porcelain')) {
          return ''
        }
        if (file === 'git' && cmd.includes('symbolic-ref')) {
          return 'refs/remotes/origin/dev\n'
        }
        // Simulate merge conflict
        if (file === 'git' && cmd.includes('merge origin/')) {
          mergeAttempted = true
          throw new Error('Merge failed: Conflict in file.txt')
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      expect(() => {
        ensureFeatureBranch('260218-conflict-test', 'implement_feature')
      }).toThrow()

      const calls = mockExecFileSync.mock.calls.map(toCommandString)

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
  const mockExecFileSync = vi.mocked(childProcess.execFileSync)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return branch from git symbolic-ref when available', () => {
    mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
      const cmd = args.join(' ')
      if (cmd.includes('symbolic-ref')) {
        return 'refs/remotes/origin/dev\n'
      }
      return ''
    }) as typeof mockExecFileSync)

    expect(getDefaultBranch('/fake/cwd')).toBe('dev')
  })

  it('should return "main" when symbolic-ref points to main', () => {
    mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
      const cmd = args.join(' ')
      if (cmd.includes('symbolic-ref')) {
        return 'refs/remotes/origin/main\n'
      }
      return ''
    }) as typeof mockExecFileSync)

    expect(getDefaultBranch('/fake/cwd')).toBe('main')
  })

  it('should fall back to git remote show origin when symbolic-ref fails', () => {
    mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
      const cmd = args.join(' ')
      if (cmd.includes('symbolic-ref')) {
        throw new Error('not a symbolic ref')
      }
      if (cmd.includes('remote show origin')) {
        return '* remote origin\n  HEAD branch: main\n  Remote branches:\n'
      }
      return ''
    }) as typeof mockExecFileSync)

    expect(getDefaultBranch('/fake/cwd')).toBe('main')
  })

  it('should return "dev" when both methods fail', () => {
    mockExecFileSync.mockImplementation((): string => {
      throw new Error('not a git repo')
    })

    expect(getDefaultBranch('/fake/cwd')).toBe('dev')
  })

  it('should use process.cwd() as default when no cwd provided', () => {
    mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
      const cmd = args.join(' ')
      if (cmd.includes('symbolic-ref')) {
        return 'refs/remotes/origin/dev\n'
      }
      return ''
    }) as typeof mockExecFileSync)

    // Call without cwd argument
    expect(getDefaultBranch()).toBe('dev')
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['symbolic-ref']),
      expect.objectContaining({ cwd: process.cwd() }),
    )
  })

  it('should pass cwd to all git commands', () => {
    mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
      const cmd = args.join(' ')
      if (cmd.includes('symbolic-ref')) {
        return 'refs/remotes/origin/dev\n'
      }
      return ''
    }) as typeof mockExecFileSync)

    getDefaultBranch('/my/project')
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['symbolic-ref']),
      expect.objectContaining({ cwd: '/my/project' }),
    )
  })

  it('should fall back to "dev" when symbolic-ref returns empty and remote show fails', () => {
    mockExecFileSync.mockImplementation(((file: string, args: readonly string[] = []) => {
      const cmd = args.join(' ')
      if (cmd.includes('symbolic-ref')) {
        return '\n' // empty trimmed
      }
      if (cmd.includes('remote show origin')) {
        throw new Error('network error')
      }
      return ''
    }) as typeof mockExecFileSync)

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

    // Should call git add -u then git add taskDir via execFileSync
    const fileSyncCalls = vi.mocked(childProcess.execFileSync).mock.calls
    // Check for git add -u call
    expect(fileSyncCalls.some((c) => c[0] === 'git' && c[1]?.join(' ').includes('add -u'))).toBe(
      true,
    )
    // Check for git add taskDir call
    expect(
      fileSyncCalls.some(
        (c) =>
          c[0] === 'git' &&
          c[1]?.join(' ').includes('add') &&
          c[1]?.join(' ').includes('.tasks/260218-test'),
      ),
    ).toBe(true)
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
    // Should have called git push via execFileSync (production code uses execFileSync)
    expect(childProcess.execFileSync).toHaveBeenCalledWith(
      'git',
      ['push', '-u', 'origin', 'HEAD'],
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
      message: 'test',
    })

    // Verify execFileSync was called with correct arguments (not a shell string)
    expect(childProcess.execFileSync).toHaveBeenCalled()
  })
})

// ============================================================================
// commitPipelineFiles — task artifact exclusion
// ============================================================================

describe('commitPipelineFiles artifact exclusion', () => {
  const mockExecFileSync = vi.mocked(childProcess.execFileSync)

  beforeEach(() => {
    vi.clearAllMocks()
    mockExecFileSync.mockReturnValue(Buffer.from(''))
  })

  // Helper to extract git reset HEAD calls
  const getResetCalls = () =>
    mockExecFileSync.mock.calls
      .filter((c) => c[0] === 'git' && (c[1] as string[])?.[0] === 'reset')
      .map((c) => (c[1] as string[]).join(' '))

  describe('on successful pipeline (pipelineFailed=false, default)', () => {
    it('should unstage gate markers (always excluded)', () => {
      commitPipelineFiles({
        taskDir: '.tasks/260218-test',
        taskId: '260218-test',
        message: 'test commit',
        stagingStrategy: 'task-only',
      })

      const resets = getResetCalls()
      // Should unstage gate-*.md
      expect(resets.some((r) => r.includes('gate-*.md'))).toBe(true)
      // Should unstage rerun-feedback.consumed.md
      expect(resets.some((r) => r.includes('rerun-feedback.consumed.md'))).toBe(true)
    })

    it('should unstage debug artifacts on success (noise reduction)', () => {
      commitPipelineFiles({
        taskDir: '.tasks/260218-test',
        taskId: '260218-test',
        message: 'test commit',
        stagingStrategy: 'task-only',
      })

      const resets = getResetCalls()
      // Should unstage *-events.jsonl
      expect(resets.some((r) => r.includes('*-events.jsonl'))).toBe(true)
      // Should unstage *-stderr.log
      expect(resets.some((r) => r.includes('*-stderr.log'))).toBe(true)
    })

    it('should unstage patterns with correct taskDir path prefix', () => {
      commitPipelineFiles({
        taskDir: '.tasks/260218-test',
        taskId: '260218-test',
        message: 'test commit',
        stagingStrategy: 'task-only',
      })

      const resets = getResetCalls()
      // All reset patterns should include the taskDir prefix
      for (const reset of resets) {
        expect(reset).toContain('.tasks/260218-test')
      }
    })

    it('should also unstage excluded files with tracked+task strategy', () => {
      commitPipelineFiles({
        taskDir: '.tasks/260218-test',
        taskId: '260218-test',
        message: 'test commit',
        stagingStrategy: 'tracked+task',
      })

      const resets = getResetCalls()
      // Should still unstage gate markers and debug artifacts
      expect(resets.some((r) => r.includes('gate-*.md'))).toBe(true)
      expect(resets.some((r) => r.includes('*-events.jsonl'))).toBe(true)
    })

    it('should NOT unstage excluded files with "all" strategy', () => {
      commitPipelineFiles({
        taskDir: '.tasks/260218-test',
        taskId: '260218-test',
        message: 'test commit',
        stagingStrategy: 'all',
      })

      const resets = getResetCalls()
      // "all" strategy does not run unstage logic
      expect(resets).toHaveLength(0)
    })
  })

  describe('on failed pipeline (pipelineFailed=true)', () => {
    it('should still unstage gate markers (always excluded)', () => {
      commitPipelineFiles({
        taskDir: '.tasks/260218-test',
        taskId: '260218-test',
        message: 'test commit',
        stagingStrategy: 'task-only',
        pipelineFailed: true,
      })

      const resets = getResetCalls()
      expect(resets.some((r) => r.includes('gate-*.md'))).toBe(true)
      expect(resets.some((r) => r.includes('rerun-feedback.consumed.md'))).toBe(true)
    })

    it('should NOT unstage debug artifacts (needed for post-mortem)', () => {
      commitPipelineFiles({
        taskDir: '.tasks/260218-test',
        taskId: '260218-test',
        message: 'test commit',
        stagingStrategy: 'task-only',
        pipelineFailed: true,
      })

      const resets = getResetCalls()
      // Debug artifacts should NOT be unstaged on failure
      expect(resets.some((r) => r.includes('*-events.jsonl'))).toBe(false)
      expect(resets.some((r) => r.includes('*-stderr.log'))).toBe(false)
    })

    it('should have fewer reset calls than success path', () => {
      // Success path
      commitPipelineFiles({
        taskDir: '.tasks/260218-success',
        taskId: '260218-success',
        message: 'success commit',
        stagingStrategy: 'task-only',
        pipelineFailed: false,
      })
      const successResets = getResetCalls()

      vi.clearAllMocks()
      mockExecFileSync.mockReturnValue(Buffer.from(''))

      // Failure path
      commitPipelineFiles({
        taskDir: '.tasks/260218-failure',
        taskId: '260218-failure',
        message: 'failure commit',
        stagingStrategy: 'task-only',
        pipelineFailed: true,
      })
      const failureResets = getResetCalls()

      // Failure path should have fewer resets (no debug artifact exclusions)
      expect(failureResets.length).toBeLessThan(successResets.length)
    })
  })

  describe('resilience', () => {
    it('should not fail if git reset throws for a pattern (no matching files)', () => {
      mockExecFileSync.mockImplementation(((file: string, args?: readonly string[]) => {
        const cmd = (args || []).join(' ')
        // Make git reset throw for all patterns (simulating no matching files)
        if (file === 'git' && cmd.startsWith('reset HEAD')) {
          throw new Error('fatal: pathspec did not match any file(s) known to git')
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      // Should not throw
      const result = commitPipelineFiles({
        taskDir: '.tasks/260218-test',
        taskId: '260218-test',
        message: 'test commit',
        stagingStrategy: 'task-only',
      })

      // The commit itself may fail (because our mock throws on commit too),
      // but the function should handle reset errors gracefully
      expect(result).toBeDefined()
    })

    it('should proceed to commit after reset errors', () => {
      let commitCalled = false
      mockExecFileSync.mockImplementation(((file: string, args?: readonly string[]) => {
        const cmd = (args || []).join(' ')
        // Reset throws
        if (file === 'git' && cmd.startsWith('reset HEAD')) {
          throw new Error('no matching files')
        }
        // Track commit call
        if (file === 'git' && cmd.startsWith('commit')) {
          commitCalled = true
        }
        return Buffer.from('')
      }) as typeof mockExecFileSync)

      commitPipelineFiles({
        taskDir: '.tasks/260218-test',
        taskId: '260218-test',
        message: 'test commit',
        stagingStrategy: 'task-only',
      })

      expect(commitCalled).toBe(true)
    })
  })
})

// ============================================================================
// pushWithRebase — pull-rebase-retry on push rejection
// ============================================================================

describe('pushWithRebase', () => {
  beforeEach(() => {
    vi.mocked(childProcess.execFileSync).mockClear()
  })

  it('should succeed on first push attempt', () => {
    vi.mocked(childProcess.execFileSync).mockReturnValue(Buffer.from(''))

    const result = pushWithRebase('/test/cwd')

    expect(result).toBe(true)
    // Should have called push once
    expect(childProcess.execFileSync).toHaveBeenCalledWith(
      'git',
      ['push', '-u', 'origin', 'HEAD'],
      expect.objectContaining({ cwd: '/test/cwd' }),
    )
    // Should NOT have called pull --rebase
    const calls = vi.mocked(childProcess.execFileSync).mock.calls
    const pullCalls = calls.filter((c) => c[0] === 'git' && c[1]?.includes('pull'))
    expect(pullCalls).toHaveLength(0)
  })

  it('should pull-rebase-retry when first push is rejected', () => {
    let pushCount = 0
    vi.mocked(childProcess.execFileSync).mockImplementation((cmd, args) => {
      if (cmd === 'git' && args?.[0] === 'push') {
        pushCount++
        if (pushCount === 1) {
          throw new Error('failed to push some refs')
        }
      }
      return Buffer.from('')
    })

    const result = pushWithRebase('/test/cwd')

    expect(result).toBe(true)

    const calls = vi.mocked(childProcess.execFileSync).mock.calls
    // Should have called push twice (first rejected, then succeeded)
    const pushCalls = calls.filter((c) => c[0] === 'git' && c[1]?.[0] === 'push')
    expect(pushCalls).toHaveLength(2)

    // Should have called pull --rebase in between
    const pullCalls = calls.filter(
      (c) => c[0] === 'git' && c[1]?.[0] === 'pull' && c[1]?.includes('--rebase'),
    )
    expect(pullCalls).toHaveLength(1)
  })

  it('should return false when push fails even after rebase', () => {
    vi.mocked(childProcess.execFileSync).mockImplementation((cmd, args) => {
      if (cmd === 'git' && args?.[0] === 'push') {
        throw new Error('failed to push some refs')
      }
      return Buffer.from('')
    })

    const result = pushWithRebase('/test/cwd')

    expect(result).toBe(false)
  })

  it('should return false when rebase itself fails (e.g., conflict)', () => {
    vi.mocked(childProcess.execFileSync).mockImplementation((cmd, args) => {
      if (cmd === 'git' && args?.[0] === 'push') {
        throw new Error('failed to push some refs')
      }
      if (cmd === 'git' && args?.[0] === 'pull') {
        throw new Error('CONFLICT: merge conflict in src/file.ts')
      }
      return Buffer.from('')
    })

    const result = pushWithRebase('/test/cwd')

    expect(result).toBe(false)
  })

  it('should use provided env for all git commands', () => {
    vi.mocked(childProcess.execFileSync).mockReturnValue(Buffer.from(''))
    const customEnv = { ...process.env, HUSKY: '0', CUSTOM: 'true' }

    pushWithRebase('/test/cwd', customEnv)

    expect(childProcess.execFileSync).toHaveBeenCalledWith(
      'git',
      ['push', '-u', 'origin', 'HEAD'],
      expect.objectContaining({ env: customEnv }),
    )
  })
})

// ============================================================================
// commitPipelineFiles — push-rebase integration
// ============================================================================

describe('commitPipelineFiles push-rebase integration', () => {
  beforeEach(() => {
    vi.mocked(childProcess.execFileSync).mockClear()
    vi.mocked(childProcess.execSync).mockClear()
  })

  it('should retry push with rebase when remote has diverged', () => {
    let pushCount = 0
    vi.mocked(childProcess.execFileSync).mockImplementation((cmd, args) => {
      if (cmd === 'git' && args?.[0] === 'push') {
        pushCount++
        if (pushCount === 1) {
          throw new Error('Updates were rejected because the remote contains work')
        }
      }
      return Buffer.from('')
    })

    const result = commitPipelineFiles({
      taskDir: '.tasks/260218-test',
      taskId: '260218-test',
      message: 'ci(cody): commit task files',
      push: true,
    })

    // Should succeed — rebase + retry push worked
    expect(result.success).toBe(true)
    expect(result.pushed).toBe(true)
  })

  it('should report push failure but still return committed=true', () => {
    vi.mocked(childProcess.execFileSync).mockImplementation((cmd, args) => {
      if (cmd === 'git' && args?.[0] === 'push') {
        throw new Error('failed to push some refs')
      }
      if (cmd === 'git' && args?.[0] === 'pull') {
        throw new Error('CONFLICT')
      }
      return Buffer.from('')
    })

    const result = commitPipelineFiles({
      taskDir: '.tasks/260218-test',
      taskId: '260218-test',
      message: 'ci(cody): commit task files',
      push: true,
    })

    // Commit succeeded but push failed
    expect(result.success).toBe(true)
    expect(result.committed).toBe(true)
    expect(result.pushed).toBe(false)
  })
})

// ============================================================================
// savePendingPatch / restorePendingPatch
// ============================================================================

import { savePendingPatch, restorePendingPatch } from '../../../../scripts/cody/git-utils'

describe('savePendingPatch', () => {
  let tempTaskDir: string

  beforeEach(() => {
    vi.clearAllMocks()
    tempTaskDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-patch-'))
  })

  afterEach(() => {
    fs.rmSync(tempTaskDir, { recursive: true, force: true })
  })

  it('should generate and save a patch from HEAD commit', () => {
    const mockExecFileSync = vi.mocked(childProcess.execFileSync)
    // Real fs for writing, mocked git
    mockExecFileSync.mockImplementation((_cmd, args) => {
      if (args && args[0] === 'format-patch') return 'From abc123...\n---\ndiff content'
      if (args && args[0] === 'log') return 'feat(task): commit message'
      if (args && args[0] === 'reset') return ''
      return ''
    })

    const result = savePendingPatch(tempTaskDir, '/repo')
    expect(result).toBe(true)
    // Verify files written to real filesystem
    expect(fs.existsSync(path.join(tempTaskDir, 'pending-commit.patch'))).toBe(true)
    expect(fs.existsSync(path.join(tempTaskDir, 'pending-commit-message.txt'))).toBe(true)
    expect(fs.readFileSync(path.join(tempTaskDir, 'pending-commit.patch'), 'utf-8')).toContain(
      'diff content',
    )
    expect(fs.readFileSync(path.join(tempTaskDir, 'pending-commit-message.txt'), 'utf-8')).toBe(
      'feat(task): commit message',
    )
    // Should reset HEAD after saving
    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['reset', 'HEAD~1'], expect.any(Object))
  })

  it('should return false when format-patch produces empty output', () => {
    const mockExecFileSync = vi.mocked(childProcess.execFileSync)
    mockExecFileSync.mockImplementation((_cmd, args) => {
      if (args && args[0] === 'format-patch') return '   '
      return ''
    })

    const result = savePendingPatch(tempTaskDir, '/repo')
    expect(result).toBe(false)
  })

  it('should return false when git command fails', () => {
    const mockExecFileSync = vi.mocked(childProcess.execFileSync)
    mockExecFileSync.mockImplementation(() => {
      throw new Error('git failed')
    })

    const result = savePendingPatch(tempTaskDir, '/repo')
    expect(result).toBe(false)
  })
})

describe('restorePendingPatch', () => {
  let tempTaskDir: string

  beforeEach(() => {
    vi.clearAllMocks()
    tempTaskDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-patch-restore-'))
  })

  afterEach(() => {
    fs.rmSync(tempTaskDir, { recursive: true, force: true })
  })

  it('should return false when no pending patch exists', () => {
    const result = restorePendingPatch(tempTaskDir, '/repo')
    expect(result).toBe(false)
  })

  it('should apply the patch and clean up files when patch exists', () => {
    // Create patch files on real filesystem
    fs.writeFileSync(path.join(tempTaskDir, 'pending-commit.patch'), 'diff content')
    fs.writeFileSync(path.join(tempTaskDir, 'pending-commit-message.txt'), 'commit msg')

    const mockExecFileSync = vi.mocked(childProcess.execFileSync)
    mockExecFileSync.mockReturnValue('')

    const result = restorePendingPatch(tempTaskDir, '/repo')
    expect(result).toBe(true)
    // Should apply patch
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['apply', '--3way', path.join(tempTaskDir, 'pending-commit.patch')],
      expect.any(Object),
    )
    // Should clean up both files
    expect(fs.existsSync(path.join(tempTaskDir, 'pending-commit.patch'))).toBe(false)
    expect(fs.existsSync(path.join(tempTaskDir, 'pending-commit-message.txt'))).toBe(false)
  })

  it('should return false and clean up when patch apply fails', () => {
    // Create only the patch file
    fs.writeFileSync(path.join(tempTaskDir, 'pending-commit.patch'), 'bad patch')

    const mockExecFileSync = vi.mocked(childProcess.execFileSync)
    mockExecFileSync.mockImplementation(() => {
      throw new Error('patch apply failed - conflicts')
    })

    const result = restorePendingPatch(tempTaskDir, '/repo')
    expect(result).toBe(false)
    // Should still clean up the bad patch
    expect(fs.existsSync(path.join(tempTaskDir, 'pending-commit.patch'))).toBe(false)
  })
})
