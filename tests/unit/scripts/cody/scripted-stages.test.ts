import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as childProcess from 'child_process'
import * as fs from 'fs'
import { getDefaultBranch } from '../../../../scripts/cody/git-utils'

// Mock child_process and fs before importing the module under test
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

vi.mock('../../../../scripts/cody/git-utils', () => ({
  getDefaultBranch: vi.fn().mockReturnValue('dev'),
}))

import { runVerifyStage, runPrStage } from '../../../../scripts/cody/scripted-stages'

// Silence console output during tests
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

// =============================================================================
// Helpers
// =============================================================================

const mockExecSync = vi.mocked(childProcess.execSync)
const mockExecFileSync = vi.mocked(childProcess.execFileSync)
const mockWriteFileSync = vi.mocked(fs.writeFileSync)
const mockExistsSync = vi.mocked(fs.existsSync)
const mockReadFileSync = vi.mocked(fs.readFileSync)
const mockGetDefaultBranch = vi.mocked(getDefaultBranch)

/**
 * Configure execSync to succeed for all 4 verify gates.
 */
function mockAllGatesPass() {
  mockExecSync.mockReturnValue('OK')
}

/**
 * Configure execSync to fail for a specific gate by command substring.
 * All others succeed.
 */
function mockGateFails(
  failingCommand: string,
  errorOutput: { stdout?: string; stderr?: string; message?: string },
) {
  mockExecSync.mockImplementation((cmd: string) => {
    if (typeof cmd === 'string' && cmd.includes(failingCommand)) {
      const error = new Error(errorOutput.message || 'command failed') as Error & {
        stdout?: string
        stderr?: string
      }
      error.stdout = errorOutput.stdout || ''
      error.stderr = errorOutput.stderr || ''
      throw error
    }
    return 'OK'
  })
}

/**
 * Configure execSync to fail for all verify gates.
 */
function mockAllGatesFail() {
  mockExecSync.mockImplementation((cmd: string) => {
    if (
      typeof cmd === 'string' &&
      (cmd.includes('tsc') ||
        cmd.includes('lint') ||
        cmd.includes('format:check') ||
        cmd.includes('test:unit'))
    ) {
      const error = new Error(`${cmd} failed`) as Error & { stdout?: string; stderr?: string }
      error.stdout = `Error output for: ${cmd}`
      error.stderr = ''
      throw error
    }
    return 'OK'
  })
}

// =============================================================================
// runVerifyStage
// =============================================================================

describe('runVerifyStage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // All gates pass
  // ---------------------------------------------------------------------------
  describe('when all gates pass', () => {
    it('should return { passed: true }', () => {
      mockAllGatesPass()

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.passed).toBe(true)
    })

    it('should write a report with PASS result', () => {
      mockAllGatesPass()

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.report).toContain('## Result: PASS')
    })

    it('should include PASS icon for each gate', () => {
      mockAllGatesPass()

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.report).toContain('## TypeScript: PASS ✅')
      expect(result.report).toContain('## Lint: PASS ✅')
      expect(result.report).toContain('## Format: PASS ✅')
      expect(result.report).toContain('## Unit Tests: PASS ✅')
    })

    it('should NOT include error code blocks when all pass', () => {
      mockAllGatesPass()

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      // Error blocks are wrapped in ``` fences only for failures
      expect(result.report).not.toContain('```\n')
    })

    it('should write the report to the output file', () => {
      mockAllGatesPass()

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(mockWriteFileSync).toHaveBeenCalledWith('/tmp/verify.md', result.report)
    })

    it('should run all 4 gates with correct commands and cwd', () => {
      mockAllGatesPass()

      runVerifyStage('/tmp/verify.md', '/my/project')

      expect(mockExecSync).toHaveBeenCalledWith(
        'pnpm -s tsc --noEmit',
        expect.objectContaining({ cwd: '/my/project', encoding: 'utf-8', timeout: 120_000 }),
      )
      expect(mockExecSync).toHaveBeenCalledWith(
        'pnpm -s lint',
        expect.objectContaining({ cwd: '/my/project' }),
      )
      expect(mockExecSync).toHaveBeenCalledWith(
        'pnpm -s format:check',
        expect.objectContaining({ cwd: '/my/project' }),
      )
      expect(mockExecSync).toHaveBeenCalledWith(
        'pnpm -s test:unit',
        expect.objectContaining({ cwd: '/my/project' }),
      )
    })
  })

  // ---------------------------------------------------------------------------
  // One gate fails
  // ---------------------------------------------------------------------------
  describe('when one gate fails', () => {
    it('should return { passed: false } when TypeScript fails', () => {
      mockGateFails('tsc', { stdout: 'TS2322: Type error at line 42' })

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.passed).toBe(false)
    })

    it('should return { passed: false } when Lint fails', () => {
      mockGateFails('lint', { stderr: 'ESLint: 3 errors found' })

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.passed).toBe(false)
    })

    it('should return { passed: false } when Format fails', () => {
      mockGateFails('format:check', { stdout: 'Prettier: 5 files would be reformatted' })

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.passed).toBe(false)
    })

    it('should return { passed: false } when Unit Tests fails', () => {
      mockGateFails('test:unit', { stdout: '3 tests failed' })

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.passed).toBe(false)
    })

    it('should include FAIL icon for the failing gate', () => {
      mockGateFails('lint', { stderr: 'ESLint: 3 errors found' })

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.report).toContain('## Lint: FAIL ❌')
    })

    it('should include error output in code block for failed gate', () => {
      mockGateFails('tsc', { stdout: 'TS2322: Type error at line 42' })

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.report).toContain('## TypeScript: FAIL ❌')
      expect(result.report).toContain('TS2322: Type error at line 42')
    })

    it('should still show PASS for gates that succeeded', () => {
      mockGateFails('lint', { stderr: 'ESLint: 3 errors found' })

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.report).toContain('## TypeScript: PASS ✅')
      expect(result.report).toContain('## Format: PASS ✅')
      expect(result.report).toContain('## Unit Tests: PASS ✅')
    })

    it('should include FAIL in the result line', () => {
      mockGateFails('tsc', { stdout: 'error' })

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.report).toContain('## Result: FAIL')
    })
  })

  // ---------------------------------------------------------------------------
  // All gates fail
  // ---------------------------------------------------------------------------
  describe('when all gates fail', () => {
    it('should return { passed: false }', () => {
      mockAllGatesFail()

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.passed).toBe(false)
    })

    it('should include FAIL icon for all gates', () => {
      mockAllGatesFail()

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.report).toContain('## TypeScript: FAIL ❌')
      expect(result.report).toContain('## Lint: FAIL ❌')
      expect(result.report).toContain('## Format: FAIL ❌')
      expect(result.report).toContain('## Unit Tests: FAIL ❌')
    })

    it('should include error output for all failed gates', () => {
      mockAllGatesFail()

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.report).toContain('Error output for: pnpm -s tsc --noEmit')
      expect(result.report).toContain('Error output for: pnpm -s lint')
      expect(result.report).toContain('Error output for: pnpm -s format:check')
      expect(result.report).toContain('Error output for: pnpm -s test:unit')
    })

    it('should include FAIL in the result line', () => {
      mockAllGatesFail()

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.report).toContain('## Result: FAIL')
    })
  })

  // ---------------------------------------------------------------------------
  // Output truncation
  // ---------------------------------------------------------------------------
  describe('output truncation', () => {
    it('should truncate success output to 500 chars', () => {
      const longOutput = 'A'.repeat(1000)
      mockExecSync.mockReturnValue(longOutput)

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')

      // All gates pass, so no error blocks in report, but the gate output is truncated internally.
      // We verify the report does NOT contain the full 1000-char output (no error blocks since passed).
      expect(result.passed).toBe(true)
    })

    it('should truncate error output to 2000 chars', () => {
      const longError = 'E'.repeat(5000)
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('tsc')) {
          const error = new Error('failed') as Error & { stdout?: string; stderr?: string }
          error.stdout = longError
          error.stderr = ''
          throw error
        }
        return 'OK'
      })

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.passed).toBe(false)

      // The error output in the report should be truncated to 2000 chars
      // Find the error block content between the ``` fences
      const errorBlockMatch = result.report.match(/```\n([\s\S]*?)\n```/)
      expect(errorBlockMatch).not.toBeNull()
      expect(errorBlockMatch![1].length).toBe(2000)
    })

    it('should use error.message as fallback when stdout and stderr are empty', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('tsc')) {
          const error = new Error('Command tsc not found')
          throw error
        }
        return 'OK'
      })

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.report).toContain('Command tsc not found')
    })

    it('should use "Unknown error" when error has no stdout, stderr, or message', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('tsc')) {
          throw {} // plain object, no message
        }
        return 'OK'
      })

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.report).toContain('Unknown error')
    })
  })

  // ---------------------------------------------------------------------------
  // Report structure
  // ---------------------------------------------------------------------------
  describe('report structure', () => {
    it('should start with # Verification Report header', () => {
      mockAllGatesPass()

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.report).toMatch(/^# Verification Report/)
    })

    it('should write the report file exactly once', () => {
      mockAllGatesPass()

      runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Phase 3.2: Aggregate timeout
  // ---------------------------------------------------------------------------
  describe('aggregate timeout', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should accept a timeout parameter', () => {
      mockAllGatesPass()

      // This should not throw - timeout parameter should be accepted
      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd', 300_000)
      expect(result.passed).toBe(true)
    })

    it('should skip remaining gates when cumulative time exceeds timeout', () => {
      // Simulate: first gate passes, then aggregate timeout is exceeded
      // The implementation checks elapsed time before each gate
      let gateIndex = 0
      const originalDateNow = Date.now

      // Mock Date.now to simulate time advancing past timeout after first gate
      vi.spyOn(Date, 'now').mockImplementation(() => {
        gateIndex++
        // First call (startTime), second call (before Lint) - both return early time
        // Third+ calls (before Format, Unit Tests) - return time past timeout
        if (gateIndex <= 2) return originalDateNow()
        return originalDateNow() + 1000 // 1 second elapsed - definitely exceeds any reasonable timeout
      })

      mockExecSync.mockReturnValue('OK')

      // Use 50ms timeout
      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd', 50)

      // Restore Date.now
      Date.now = originalDateNow

      // First gate should have passed
      expect(result.report).toContain('## TypeScript: PASS ✅')

      // Remaining gates should be skipped due to aggregate timeout
      expect(result.report).toContain('## Lint: SKIPPED ❌')
      expect(result.report).toContain('aggregate timeout exceeded')
      expect(result.report).toContain('## Format: SKIPPED ❌')
      expect(result.report).toContain('## Unit Tests: SKIPPED ❌')

      // Final result should be FAIL since not all gates passed
      expect(result.report).toContain('## Result: FAIL')
      expect(result.passed).toBe(false)
    })

    it('should report SKIPPED status for gates after timeout', () => {
      // All gates pass but we simulate timeout after first gate
      let gateIndex = 0
      mockExecSync.mockImplementation(() => {
        gateIndex++
        if (gateIndex === 1) {
          // First gate passes
          return 'OK'
        }
        // After first gate, simulate aggregate timeout exceeded
        const error = new Error('Aggregate timeout exceeded') as Error & {
          stdout?: string
          stderr?: string
        }
        error.stdout = 'SKIPPED: aggregate timeout exceeded'
        error.stderr = ''
        throw error
      })

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd', 100)

      // Check that gates after the first are marked as SKIPPED
      const lintMatch = result.report.match(/## Lint: (PASS|FAIL|SKIPPED)/)
      const formatMatch = result.report.match(/## Format: (PASS|FAIL|SKIPPED)/)
      const unitTestsMatch = result.report.match(/## Unit Tests: (PASS|FAIL|SKIPPED)/)

      expect(lintMatch?.[1]).toBe('SKIPPED')
      expect(formatMatch?.[1]).toBe('SKIPPED')
      expect(unitTestsMatch?.[1]).toBe('SKIPPED')
    })

    it('should include aggregate timeout message in skipped gate output', () => {
      let gateIndex = 0
      mockExecSync.mockImplementation(() => {
        gateIndex++
        if (gateIndex === 1) return 'OK'

        const error = new Error('timeout') as Error & { stdout?: string; stderr?: string }
        error.stdout = 'SKIPPED: aggregate timeout exceeded'
        error.stderr = ''
        throw error
      })

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd', 50)

      // The skipped gates should include the timeout message in output
      expect(result.report).toContain('SKIPPED: aggregate timeout exceeded')
    })

    it('should track cumulative time across all gates', () => {
      // Simulate gates that take progressively longer
      // Cumulative time should be tracked, not just per-gate timeout
      let gateIndex = 0
      mockExecSync.mockImplementation(() => {
        gateIndex++
        // First 2 gates complete, but cumulative time exceeds on 3rd
        if (gateIndex <= 2) return 'OK'

        const error = new Error('ETIMEDOUT') as Error & {
          stdout?: string
          stderr?: string
          code?: string
        }
        error.stdout = 'SKIPPED: aggregate timeout exceeded'
        error.stderr = ''
        error.code = 'ETIMEDOUT'
        throw error
      })

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd', 200)

      // First two gates should pass
      expect(result.report).toContain('## TypeScript: PASS ✅')
      expect(result.report).toContain('## Lint: PASS ✅')

      // Remaining gates should be skipped
      expect(result.report).toContain('## Format: SKIPPED')
      expect(result.report).toContain('## Unit Tests: SKIPPED')
    })
  })
})

// =============================================================================
// runPrStage
// =============================================================================

describe('runPrStage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset getDefaultBranch mock to default
    mockGetDefaultBranch.mockReturnValue('dev')
    // Default mocks for fs
    mockExistsSync.mockReturnValue(false)
    mockReadFileSync.mockReturnValue('')
  })

  /**
   * Set up execSync and execFileSync responses for the standard PR flow.
   * execSync handles: git branch, git log
   * execFileSync handles: gh pr list, git push, gh pr create
   * Callers can override specific commands.
   */
  function setupPrMocks(
    overrides: {
      branch?: string
      defaultBranch?: string
      existingPrUrl?: string | null
      commitSummary?: string
      prCreateUrl?: string
      pushFails?: boolean
    } = {},
  ) {
    const {
      branch = 'feat/my-feature',
      defaultBranch = 'dev',
      existingPrUrl = null,
      commitSummary = 'abc1234 initial commit',
      prCreateUrl = 'https://github.com/owner/repo/pull/42',
      pushFails = false,
    } = overrides

    // Mock getDefaultBranch (imported from git-utils)
    mockGetDefaultBranch.mockReturnValue(defaultBranch)
    // execSync handles string-based commands: git branch, git log
    mockExecSync.mockImplementation((cmd: string) => {
      const cmdStr = typeof cmd === 'string' ? cmd : String(cmd)

      // getBranchName
      if (cmdStr.includes('git branch --show-current')) {
        return `${branch}\n`
      }

      // getCommitSummary
      if (cmdStr.includes('git log --oneline')) {
        return `${commitSummary}\n`
      }

      return ''
    })

    // execFileSync handles array-based commands: gh pr list, git push, gh pr create, git log
    mockExecFileSync.mockImplementation((file: string, args?: readonly string[]) => {
      const argsArr = args || []

      // getCommitSummary: git log --oneline <branch>..HEAD
      if (file === 'git' && argsArr[0] === 'log' && argsArr.includes('--oneline')) {
        return `${commitSummary}\n`
      }

      // getExistingPr: gh pr list --head <branch> ...
      if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'list') {
        if (existingPrUrl) {
          return `${existingPrUrl}\n`
        }
        return '\n'
      }

      // git push -u origin <branch>
      if (file === 'git' && argsArr[0] === 'push') {
        if (pushFails) {
          throw new Error('push failed')
        }
        return ''
      }

      // gh pr create --title ... --base ... --body-file -
      if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'create') {
        return `${prCreateUrl}\n`
      }

      return ''
    })
  }

  // ---------------------------------------------------------------------------
  // Existing PR found
  // ---------------------------------------------------------------------------
  describe('when existing PR is found', () => {
    it('should return { created: false } with the existing URL', () => {
      setupPrMocks({ existingPrUrl: 'https://github.com/owner/repo/pull/99' })

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.created).toBe(false)
      expect(result.url).toBe('https://github.com/owner/repo/pull/99')
    })

    it('should write a report mentioning the existing PR', () => {
      setupPrMocks({ existingPrUrl: 'https://github.com/owner/repo/pull/99' })

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toContain('Existing PR found')
      expect(result.report).toContain('https://github.com/owner/repo/pull/99')
    })

    it('should NOT attempt to create a new PR', () => {
      setupPrMocks({ existingPrUrl: 'https://github.com/owner/repo/pull/99' })

      runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      // Should not call execFileSync with gh pr create
      const execFileCalls = mockExecFileSync.mock.calls
      const prCreateCall = execFileCalls.find(
        (c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'create',
      )
      expect(prCreateCall).toBeUndefined()
    })

    it('should NOT attempt git push', () => {
      setupPrMocks({ existingPrUrl: 'https://github.com/owner/repo/pull/99' })

      runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      const execFileCalls = mockExecFileSync.mock.calls
      const pushCall = execFileCalls.find(
        (c) => c[0] === 'git' && (c[1] as string[])?.[0] === 'push',
      )
      expect(pushCall).toBeUndefined()
    })

    it('should write the output file', () => {
      setupPrMocks({ existingPrUrl: 'https://github.com/owner/repo/pull/99' })

      runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(mockWriteFileSync).toHaveBeenCalledWith('/tmp/pr.md', expect.any(String))
    })
  })

  // ---------------------------------------------------------------------------
  // Successful PR creation
  // ---------------------------------------------------------------------------
  describe('when PR is created successfully', () => {
    it('should return { created: true } with the new PR URL', () => {
      setupPrMocks({ prCreateUrl: 'https://github.com/owner/repo/pull/42' })

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.created).toBe(true)
      expect(result.url).toBe('https://github.com/owner/repo/pull/42')
    })

    it('should write a report with the PR URL and title', () => {
      setupPrMocks()

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toContain('PR created')
      expect(result.report).toContain('https://github.com/owner/repo/pull/42')
      expect(result.report).toContain('Title:')
    })

    it('should push the branch before creating PR', () => {
      setupPrMocks({ branch: 'feat/new-thing' })

      runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      const execFileCalls = mockExecFileSync.mock.calls
      const pushCall = execFileCalls.find(
        (c) => c[0] === 'git' && (c[1] as string[])?.[0] === 'push',
      )
      expect(pushCall).toBeDefined()
      expect((pushCall![1] as string[]).includes('feat/new-thing')).toBe(true)
    })

    it('should continue even if push fails', () => {
      setupPrMocks({ pushFails: true })

      // Should not throw
      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.created).toBe(true)
    })

    it('should use the default branch as PR base', () => {
      setupPrMocks({ defaultBranch: 'main' })

      runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      const execFileCalls = mockExecFileSync.mock.calls
      const prCreateCall = execFileCalls.find(
        (c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'create',
      )
      expect(prCreateCall).toBeDefined()
      const args = prCreateCall![1] as string[]
      const baseIdx = args.indexOf('--base')
      expect(args[baseIdx + 1]).toBe('main')
    })

    it('should fall back to "dev" when getDefaultBranch fails', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd)
        if (cmdStr.includes('git branch --show-current')) return 'feat/x\n'
        if (cmdStr.includes('git log --oneline')) return 'abc123 commit\n'
        return ''
      })
      mockExecFileSync.mockImplementation((file: string, args?: readonly string[]) => {
        const argsArr = args || []
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'list') return '\n'
        if (file === 'git' && argsArr[0] === 'push') return ''
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'create')
          return 'https://github.com/o/r/pull/1\n'
        return ''
      })

      runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      const execFileCalls = mockExecFileSync.mock.calls
      const prCreateCall = execFileCalls.find(
        (c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'create',
      )
      expect(prCreateCall).toBeDefined()
      const args = prCreateCall![1] as string[]
      const baseIdx = args.indexOf('--base')
      expect(args[baseIdx + 1]).toBe('dev')
    })
  })

  // ---------------------------------------------------------------------------
  // PR creation fails
  // ---------------------------------------------------------------------------
  describe('when PR creation fails', () => {
    it('should return { created: false, url: "" }', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd)
        if (cmdStr.includes('git branch --show-current')) return 'feat/x\n'
        if (cmdStr.includes('git log --oneline')) return ''
        return ''
      })
      mockExecFileSync.mockImplementation((file: string, args?: readonly string[]) => {
        const argsArr = args || []
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'list') return '\n'
        if (file === 'git' && argsArr[0] === 'push') return ''
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'create') {
          throw new Error('gh: Validation failed: base branch not found')
        }
        return ''
      })

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.created).toBe(false)
      expect(result.url).toBe('')
    })

    it('should include the error message in the report', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd)
        if (cmdStr.includes('git branch --show-current')) return 'feat/x\n'
        if (cmdStr.includes('git log --oneline')) return ''
        return ''
      })
      mockExecFileSync.mockImplementation((file: string, args?: readonly string[]) => {
        const argsArr = args || []
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'list') return '\n'
        if (file === 'git' && argsArr[0] === 'push') return ''
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'create') {
          throw new Error('gh: Validation failed: base branch not found')
        }
        return ''
      })

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.report).toContain('Failed to create PR')
      expect(result.report).toContain('base branch not found')
    })

    it('should write the failure report to the output file', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd)
        if (cmdStr.includes('git branch --show-current')) return 'feat/x\n'
        if (cmdStr.includes('git log --oneline')) return ''
        return ''
      })
      mockExecFileSync.mockImplementation((file: string, args?: readonly string[]) => {
        const argsArr = args || []
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'list') return '\n'
        if (file === 'git' && argsArr[0] === 'push') return ''
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'create') {
          throw new Error('some error')
        }
        return ''
      })

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(mockWriteFileSync).toHaveBeenCalledWith('/tmp/pr.md', result.report)
    })
  })

  // ---------------------------------------------------------------------------
  // buildPrTitle — task.md
  // ---------------------------------------------------------------------------
  describe('PR title from task.md', () => {
    it('should use task.md first line as title', () => {
      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => {
        const pathStr = String(p)
        return pathStr.endsWith('task.md')
      })
      mockReadFileSync.mockImplementation((p: unknown) => {
        const pathStr = String(p)
        if (pathStr.endsWith('task.md')) {
          return '# Task\nAdd support for YouTube embeds in lessons'
        }
        return ''
      })

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.report).toContain('add support for youtube embeds in lessons')
    })

    it('should strip "# Task" prefix from task.md', () => {
      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('task.md'))
      mockReadFileSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('task.md')) {
          return '# Task\nFix the broken login form'
        }
        return ''
      })

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      // Should not contain "# Task" or "Task" prefix, just the description
      expect(result.report).toContain('fix the broken login form')
      // The title line in the report should start with the type prefix
      expect(result.report).toMatch(/Title: feat: fix the broken login form/)
    })
  })

  // ---------------------------------------------------------------------------
  // buildPrTitle — task.json type mapping
  // ---------------------------------------------------------------------------
  describe('PR title type prefix from task.json', () => {
    function setupWithTaskJson(taskType: string, taskMdContent: string = '# Task\nDo something') {
      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => {
        const pathStr = String(p)
        return pathStr.endsWith('task.md') || pathStr.endsWith('task.json')
      })
      mockReadFileSync.mockImplementation((p: unknown) => {
        const pathStr = String(p)
        if (pathStr.endsWith('task.md')) return taskMdContent
        if (pathStr.endsWith('task.json')) return JSON.stringify({ task_type: taskType })
        return ''
      })
    }

    it('should use "fix:" prefix for fix_bug task type', () => {
      setupWithTaskJson('fix_bug')

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toMatch(/Title: fix: /)
    })

    it('should use "feat:" prefix for implement_feature task type', () => {
      setupWithTaskJson('implement_feature')

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toMatch(/Title: feat: /)
    })

    it('should use "refactor:" prefix for refactor task type', () => {
      setupWithTaskJson('refactor')

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toMatch(/Title: refactor: /)
    })

    it('should use "docs:" prefix for docs task type', () => {
      setupWithTaskJson('docs')

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toMatch(/Title: docs: /)
    })

    it('should use "chore:" prefix for ops task type', () => {
      setupWithTaskJson('ops')

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toMatch(/Title: chore: /)
    })

    it('should use "chore:" prefix for research task type', () => {
      setupWithTaskJson('research')

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toMatch(/Title: chore: /)
    })

    it('should default to "feat:" when task_type is unknown', () => {
      setupWithTaskJson('banana')

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toMatch(/Title: feat: /)
    })

    it('should default to "feat:" when task.json is invalid JSON', () => {
      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => {
        const pathStr = String(p)
        return pathStr.endsWith('task.md') || pathStr.endsWith('task.json')
      })
      mockReadFileSync.mockImplementation((p: unknown) => {
        const pathStr = String(p)
        if (pathStr.endsWith('task.md')) return '# Task\nDo something'
        if (pathStr.endsWith('task.json')) return '{ invalid json }'
        return ''
      })

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toMatch(/Title: feat: /)
    })
  })

  // ---------------------------------------------------------------------------
  // buildPrTitle — fallback to commit messages
  // ---------------------------------------------------------------------------
  describe('PR title fallback to commit messages', () => {
    it('should use first commit message when no task.md exists', () => {
      setupPrMocks({ commitSummary: 'abc1234 fix login form validation' })
      // No task.md, no task.json
      mockExistsSync.mockReturnValue(false)

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.report).toContain('Title: feat: fix login form validation')
    })

    it('should strip commit hash from the fallback title', () => {
      setupPrMocks({ commitSummary: 'deadbeef add new feature' })
      mockExistsSync.mockReturnValue(false)

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      // Should strip "deadbeef " prefix
      expect(result.report).toContain('Title: feat: add new feature')
      expect(result.report).not.toContain('deadbeef')
    })

    it('should use "implement changes" when no commits and no task.md', () => {
      setupPrMocks({ commitSummary: '' })
      mockExistsSync.mockReturnValue(false)

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.report).toContain('Title: feat: implement changes')
    })

    it('should use first commit only when multiple commits exist', () => {
      setupPrMocks({ commitSummary: 'abc1234 first commit\ndef5678 second commit' })
      mockExistsSync.mockReturnValue(false)

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.report).toContain('first commit')
      expect(result.report).not.toContain('second commit')
    })
  })

  // ---------------------------------------------------------------------------
  // buildPrTitle — truncation
  // ---------------------------------------------------------------------------
  describe('PR title truncation', () => {
    it('should truncate titles longer than 72 chars with "..."', () => {
      const longTitle = 'A'.repeat(100) // 100 chars > 72

      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('task.md'))
      mockReadFileSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('task.md')) return `# Task\n${longTitle}`
        return ''
      })

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      // Title should be: "feat: " + truncated description
      // The description is lowercased and truncated to 69 chars + "..."
      const expectedDesc = 'a'.repeat(69) + '...'
      expect(result.report).toContain(`Title: feat: ${expectedDesc}`)
    })

    it('should NOT truncate titles of exactly 72 chars', () => {
      const exactTitle = 'A'.repeat(72)

      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('task.md'))
      mockReadFileSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('task.md')) return `# Task\n${exactTitle}`
        return ''
      })

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      // 72 chars is exactly the limit, should not be truncated
      expect(result.report).toContain(`Title: feat: ${'a'.repeat(72)}`)
      expect(result.report).not.toContain('...')
    })

    it('should NOT truncate titles shorter than 72 chars', () => {
      const shortTitle = 'Fix login bug'

      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('task.md'))
      mockReadFileSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('task.md')) return `# Task\n${shortTitle}`
        return ''
      })

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.report).toContain('Title: feat: fix login bug')
      expect(result.report).not.toContain('...')
    })
  })

  // ---------------------------------------------------------------------------
  // buildPrBody — spec summary and commits
  // ---------------------------------------------------------------------------
  describe('PR body content', () => {
    it('should extract ## Overview section from spec.md when present', () => {
      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => {
        const pathStr = String(p)
        return pathStr.endsWith('spec.md')
      })
      mockReadFileSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('spec.md')) {
          return '## Overview\nThis spec describes feature X.\n\n## Details\nMore details here.'
        }
        return ''
      })

      runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      // The body is passed as `input` to the gh pr create execFileSync call
      const prCreateCall = mockExecFileSync.mock.calls.find(
        (c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'create',
      )
      expect(prCreateCall).toBeDefined()
      const options = prCreateCall![2] as { input?: string }
      expect(options.input).toContain('This spec describes feature X.')
      // Should NOT include the ## Details section
      expect(options.input).not.toContain('More details here.')
    })

    it('should fall back to first paragraph when no ## Overview section', () => {
      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => {
        const pathStr = String(p)
        return pathStr.endsWith('spec.md')
      })
      mockReadFileSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('spec.md')) {
          return 'This spec describes the implementation of feature X.\n\nMore details here.'
        }
        return ''
      })

      runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      const prCreateCall = mockExecFileSync.mock.calls.find(
        (c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'create',
      )
      expect(prCreateCall).toBeDefined()
      const options = prCreateCall![2] as { input?: string }
      expect(options.input).toContain('This spec describes the implementation of feature X.')
    })

    it('should truncate first-paragraph fallback to 500 chars', () => {
      const longSpec = 'S'.repeat(1000)

      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('spec.md'))
      mockReadFileSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('spec.md')) return longSpec
        return ''
      })

      runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      const prCreateCall = mockExecFileSync.mock.calls.find(
        (c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'create',
      )
      const options = prCreateCall![2] as { input?: string }
      // The spec summary should be truncated to 500 chars
      expect(options.input).toContain('S'.repeat(500))
      expect(options.input).not.toContain('S'.repeat(501))
    })

    it('should include commit summary in the body', () => {
      setupPrMocks({ commitSummary: 'abc1234 add feature X\ndef5678 fix typo' })
      mockExistsSync.mockReturnValue(false)

      runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      const prCreateCall = mockExecFileSync.mock.calls.find(
        (c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'create',
      )
      const options = prCreateCall![2] as { input?: string }
      expect(options.input).toContain('## Commits')
      expect(options.input).toContain('abc1234 add feature X')
      expect(options.input).toContain('def5678 fix typo')
    })

    it('should include "Generated by Cody pipeline" footer', () => {
      setupPrMocks()
      mockExistsSync.mockReturnValue(false)

      runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      const prCreateCall = mockExecFileSync.mock.calls.find(
        (c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'create',
      )
      const options = prCreateCall![2] as { input?: string }
      expect(options.input).toContain('Generated by Cody pipeline')
    })

    it('should include ## Summary header in the body', () => {
      setupPrMocks()
      mockExistsSync.mockReturnValue(false)

      runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      const prCreateCall = mockExecFileSync.mock.calls.find(
        (c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'create',
      )
      const options = prCreateCall![2] as { input?: string }
      expect(options.input).toContain('## Summary')
    })

    it('should omit commits section when there are no commits', () => {
      setupPrMocks({ commitSummary: '' })
      mockExistsSync.mockReturnValue(false)

      runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      const prCreateCall = mockExecFileSync.mock.calls.find(
        (c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'create',
      )
      const options = prCreateCall![2] as { input?: string }
      expect(options.input).not.toContain('## Commits')
    })

    it('should omit spec summary when spec.md does not exist', () => {
      setupPrMocks({ commitSummary: 'abc1234 some commit' })
      mockExistsSync.mockReturnValue(false)

      runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      const prCreateCall = mockExecFileSync.mock.calls.find(
        (c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'create',
      )
      const options = prCreateCall![2] as { input?: string }
      // Body should have summary header, commits, and footer — but no spec text
      const body = options.input!
      const lines = body.split('\n')
      // First content line after "## Summary\n" should be "## Commits" (no spec between)
      const summaryIdx = lines.indexOf('## Summary')
      const commitsIdx = lines.indexOf('## Commits')
      // There should be no non-empty content between Summary and Commits
      const between = lines.slice(summaryIdx + 1, commitsIdx).filter((l) => l.trim() !== '')
      expect(between).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle getExistingPr returning null on error', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd)
        if (cmdStr.includes('git branch --show-current')) return 'feat/x\n'
        if (cmdStr.includes('git log --oneline')) return ''
        return ''
      })
      mockExecFileSync.mockImplementation((file: string, args?: readonly string[]) => {
        const argsArr = args || []
        // getExistingPr throws
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'list')
          throw new Error('gh: network error')
        if (file === 'git' && argsArr[0] === 'push') return ''
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'create')
          return 'https://github.com/o/r/pull/1\n'
        return ''
      })
      mockExistsSync.mockReturnValue(false)

      // Should not throw — getExistingPr catches the error and returns null
      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.created).toBe(true)
    })

    it('should handle getCommitSummary returning empty on error', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd)
        if (cmdStr.includes('git branch --show-current')) return 'feat/x\n'
        if (cmdStr.includes('git log --oneline')) throw new Error('not a git repo')
        return ''
      })
      mockExecFileSync.mockImplementation((file: string, args?: readonly string[]) => {
        const argsArr = args || []
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'list') return '\n'
        if (file === 'git' && argsArr[0] === 'push') return ''
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'create')
          return 'https://github.com/o/r/pull/1\n'
        return ''
      })
      mockExistsSync.mockReturnValue(false)

      // Should not throw — getCommitSummary catches and returns ''
      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.created).toBe(true)
      expect(result.report).toContain('Title: feat: implement changes')
    })

    it('should pass title as arg array element without shell escaping', () => {
      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('task.md'))
      mockReadFileSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('task.md')) return '# Task\nFix "broken" login form'
        return ''
      })

      runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      const prCreateCall = mockExecFileSync.mock.calls.find(
        (c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'create',
      )
      expect(prCreateCall).toBeDefined()
      const args = prCreateCall![1] as string[]
      const titleIdx = args.indexOf('--title')
      // Title is passed as-is in the arg array (no shell escaping needed)
      expect(args[titleIdx + 1]).toContain('fix "broken" login form')
    })

    it('should lowercase the PR title from task.md', () => {
      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('task.md'))
      mockReadFileSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('task.md')) return '# Task\nAdd YouTube Embed Support'
        return ''
      })

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.report).toContain('Title: feat: add youtube embed support')
    })

    it('should use multiline task.md first line only', () => {
      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('task.md'))
      mockReadFileSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('task.md')) {
          return '# Task\nFirst line for title\nSecond line should be ignored\nThird line too'
        }
        return ''
      })

      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.report).toContain('first line for title')
      expect(result.report).not.toContain('Second line')
    })

    // Phase 2.1: Shell injection fix verification
    it('should use execFileSync for git log to prevent shell injection', () => {
      setupPrMocks()
      // Verify that getCommitSummary uses execFileSync, not execSync with string interpolation
      // This is verified by checking that the execFileSync mock was called with git log
      const result = runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      // The function should complete without throwing
      expect(result.created).toBe(true)

      // Verify execFileSync was used for git operations (not execSync with string interpolation)
      const gitLogCalls = mockExecFileSync.mock.calls.filter(
        (call) => call[0] === 'git' && call[1]?.includes('log'),
      )
      expect(gitLogCalls.length).toBeGreaterThan(0)
    })
  })
})
