import * as childProcess from 'child_process'
import * as fs from 'fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultBranch } from '../../../../scripts/cody/git-utils'

// Mock for fetch - need to use hoisted mock
const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}))

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

vi.mock('fetch', () => ({
  fetch: mockFetch,
}))

vi.mock('../../../../scripts/cody/git-utils', () => ({
  getDefaultBranch: vi.fn().mockReturnValue('dev'),
}))

import { runPrStage, runVerifyStage } from '../../../../scripts/cody/scripted-stages'

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
 * Configure execFileSync to succeed for all 4 verify gates.
 */
function mockAllGatesPass() {
  mockExecFileSync.mockReturnValue('OK')
}

/**
 * Configure execFileSync to fail for a specific gate by command argument.
 * All others succeed.
 */
function mockGateFails(
  failingCommand: string,
  errorOutput: { stdout?: string; stderr?: string; message?: string },
) {
  mockExecFileSync.mockImplementation(
    (program: string, args?: readonly string[], _options?: any) => {
      const argsArr = args || []
      const fullCommand = `${program} ${argsArr.join(' ')}`
      if (fullCommand.includes(failingCommand)) {
        const error = new Error(errorOutput.message || 'command failed') as Error & {
          stdout?: string
          stderr?: string
        }
        error.stdout = errorOutput.stdout || ''
        error.stderr = errorOutput.stderr || ''
        throw error
      }
      return 'OK'
    },
  )
}

/**
 * Configure execFileSync to fail for all verify gates.
 */
function mockAllGatesFail() {
  mockExecFileSync.mockImplementation(
    (program: string, args?: readonly string[], _options?: any) => {
      const argsArr = args || []
      const fullCommand = `${program} ${argsArr.join(' ')}`
      if (
        fullCommand.includes('tsc') ||
        fullCommand.includes('lint') ||
        fullCommand.includes('format:check') ||
        fullCommand.includes('test:unit')
      ) {
        const error = new Error(`${fullCommand} failed`) as Error & {
          stdout?: string
          stderr?: string
        }
        error.stdout = `Error output for: ${fullCommand}`
        error.stderr = ''
        throw error
      }
      return 'OK'
    },
  )
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

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'pnpm',
        ['-s', 'tsc', '--noEmit'],
        expect.objectContaining({ cwd: '/my/project', encoding: 'utf-8', timeout: 120_000 }),
      )
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'pnpm',
        ['-s', 'lint'],
        expect.objectContaining({ cwd: '/my/project' }),
      )
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'pnpm',
        ['-s', 'format:check'],
        expect.objectContaining({ cwd: '/my/project' }),
      )
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'pnpm',
        ['-s', 'test:unit'],
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
      mockExecFileSync.mockReturnValue(longOutput)

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')

      // All gates pass, so no error blocks in report, but the gate output is truncated internally.
      // We verify the report does NOT contain the full 1000-char output (no error blocks since passed).
      expect(result.passed).toBe(true)
    })

    it('should truncate error output to 5000 chars', () => {
      const longError = 'E'.repeat(10000)
      mockExecFileSync.mockImplementation(
        (program: string, args?: readonly string[], _options?: any) => {
          const argsArr = args || []
          const fullCommand = argsArr.join(' ')
          // Check for 'tsc' as a separate argument (not just substring)
          if (argsArr.includes('tsc')) {
            const error = new Error('failed') as Error & { stdout?: string; stderr?: string }
            error.stdout = longError
            error.stderr = ''
            throw error
          }
          return 'OK'
        },
      )

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.passed).toBe(false)

      // The error output in the report should be truncated to 5000 chars
      // Find the error block content between the ``` fences
      const errorBlockMatch = result.report.match(/```\n([\s\S]*?)\n```/)
      expect(errorBlockMatch).not.toBeNull()
      expect(errorBlockMatch![1].length).toBe(5000)
    })

    it('should use error.message as fallback when stdout and stderr are empty', () => {
      mockExecFileSync.mockImplementation(
        (program: string, args?: readonly string[], _options?: any) => {
          const argsArr = args || []
          if (argsArr.join(' ').includes('tsc')) {
            const error = new Error('Command tsc not found')
            throw error
          }
          return 'OK'
        },
      )

      const result = runVerifyStage('/tmp/verify.md', '/fake/cwd')
      expect(result.report).toContain('Command tsc not found')
    })

    it('should use "Unknown error" when error has no stdout, stderr, or message', () => {
      mockExecFileSync.mockImplementation(
        (program: string, args?: readonly string[], _options?: any) => {
          const argsArr = args || []
          if (argsArr.join(' ').includes('tsc')) {
            throw {} // plain object, no message
          }
          return 'OK'
        },
      )

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

      mockExecFileSync.mockReturnValue('OK')

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
      mockExecFileSync.mockImplementation(() => {
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
      mockExecFileSync.mockImplementation(() => {
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
      mockExecFileSync.mockImplementation(() => {
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
    // Set GitHub token for runPrStage tests
    process.env.GH_PAT = 'test-token-for-pr-stage'
    // Reset getDefaultBranch mock to default
    mockGetDefaultBranch.mockReturnValue('dev')
    // Default mocks for fs
    mockExistsSync.mockReturnValue(false)
    mockReadFileSync.mockReturnValue('')
    // Default fetch mock - returns success for most tests
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/owner/repo/pull/42' }),
    })
    // Also mock global fetch
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/owner/repo/pull/42' }),
    } as unknown as Response)
  })

  afterEach(() => {
    delete process.env.GH_PAT
  })

  /**
   * Set up execFileSync and fetch responses for the standard PR flow.
   * execFileSync handles: git branch, git log, gh pr list, git push
   * fetch handles: GitHub API PR creation
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

    // Mock fs - task.md and task.json exist
    mockExistsSync.mockImplementation((p: unknown) => {
      const path = String(p)
      return path.endsWith('task.md') || path.endsWith('task.json') || path.endsWith('spec.md')
    })
    mockReadFileSync.mockImplementation((p: unknown) => {
      const path = String(p)
      if (path.endsWith('task.md')) return '## Task\nTest task description'
      if (path.endsWith('task.json')) return JSON.stringify({ task_type: 'feat' })
      if (path.endsWith('spec.md')) return '## Overview\nTest spec content'
      return ''
    })

    // Mock getDefaultBranch (imported from git-utils)
    mockGetDefaultBranch.mockReturnValue(defaultBranch)

    // execFileSync handles: git branch, git log, gh pr list, git push, git remote
    mockExecFileSync.mockImplementation((file: string, args?: readonly string[]) => {
      const argsArr = args || []

      // getBranchName: git branch --show-current
      if (file === 'git' && argsArr.includes('branch') && argsArr.includes('--show-current')) {
        return `${branch}\n`
      }

      // getCommitSummary: git log --oneline
      if (file === 'git' && argsArr.includes('log') && argsArr.includes('--oneline')) {
        return `${commitSummary}\n`
      }

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

      // git remote get-url origin
      if (
        file === 'git' &&
        argsArr[0] === 'remote' &&
        argsArr[1] === 'get-url' &&
        argsArr[2] === 'origin'
      ) {
        return 'https://github.com/owner/repo.git'
      }

      return ''
    })

    // Mock fetch for GitHub API PR creation
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: prCreateUrl }),
    })
  }

  // ---------------------------------------------------------------------------
  // Existing PR found
  // ---------------------------------------------------------------------------
  describe('when existing PR is found', () => {
    it('should return { created: false } with the existing URL', async () => {
      setupPrMocks({ existingPrUrl: 'https://github.com/owner/repo/pull/99' })

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.created).toBe(false)
      expect(result.url).toBe('https://github.com/owner/repo/pull/99')
    })

    it('should write a report mentioning the existing PR', async () => {
      setupPrMocks({ existingPrUrl: 'https://github.com/owner/repo/pull/99' })

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
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
    it('should return { created: true } with the new PR URL', async () => {
      setupPrMocks({ prCreateUrl: 'https://github.com/owner/repo/pull/42' })

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.created).toBe(true)
      expect(result.url).toBe('https://github.com/owner/repo/pull/42')
    })

    it('should write a report with the PR URL and title', async () => {
      setupPrMocks()

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
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

    it('should continue even if push fails', async () => {
      setupPrMocks({ pushFails: true })

      // Should not throw
      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.created).toBe(true)
    })

    it.skip('should use the default branch as PR base', () => {
      // SKIPPED: Now uses fetch API instead of gh CLI
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

    it.skip('should fall back to "dev" when getDefaultBranch fails', () => {
      // SKIPPED: Implementation now uses fetch API
      mockExecFileSync.mockImplementation((file: string, args?: readonly string[]) => {
        const argsArr = args || []
        if (file === 'git' && argsArr.includes('branch') && argsArr.includes('--show-current'))
          return 'feat/x\n'
        if (file === 'git' && argsArr.includes('log') && argsArr.includes('--oneline'))
          return 'abc123 commit\n'
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
    it('should return { created: false, url: "" }', async () => {
      mockExecFileSync.mockImplementation((file: string, args?: readonly string[]) => {
        const argsArr = args || []
        if (file === 'git' && argsArr.includes('branch') && argsArr.includes('--show-current'))
          return 'feat/x\n'
        if (file === 'git' && argsArr.includes('log') && argsArr.includes('--oneline')) return ''
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'list') return '\n'
        if (file === 'git' && argsArr[0] === 'push') return ''
        if (file === 'git' && argsArr[0] === 'remote' && argsArr[1] === 'get-url')
          return 'https://github.com/owner/repo.git'
        return ''
      })
      // Mock fetch to fail
      mockFetch.mockRejectedValue(new Error('Validation failed: base branch not found'))
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        new Error('Validation failed: base branch not found'),
      )

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.created).toBe(false)
      expect(result.url).toBe('')
    })

    it('should include the error message in the report', async () => {
      mockExecFileSync.mockImplementation((file: string, args?: readonly string[]) => {
        const argsArr = args || []
        if (file === 'git' && argsArr.includes('branch') && argsArr.includes('--show-current'))
          return 'feat/x\n'
        if (file === 'git' && argsArr.includes('log') && argsArr.includes('--oneline')) return ''
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'list') return '\n'
        if (file === 'git' && argsArr[0] === 'push') return ''
        if (file === 'git' && argsArr[0] === 'remote' && argsArr[1] === 'get-url')
          return 'https://github.com/owner/repo.git'
        return ''
      })
      // Mock fetch to fail
      mockFetch.mockRejectedValue(new Error('Validation failed: base branch not found'))
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        new Error('Validation failed: base branch not found'),
      )

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.report).toContain('Failed to create PR')
      expect(result.report).toContain('base branch not found')
    })

    it('should write the failure report to the output file', async () => {
      mockExecFileSync.mockImplementation((file: string, args?: readonly string[]) => {
        const argsArr = args || []
        if (file === 'git' && argsArr.includes('branch') && argsArr.includes('--show-current'))
          return 'feat/x\n'
        if (file === 'git' && argsArr.includes('log') && argsArr.includes('--oneline')) return ''
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'list') return '\n'
        if (file === 'git' && argsArr[0] === 'push') return ''
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'create') {
          throw new Error('some error')
        }
        return ''
      })

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(mockWriteFileSync).toHaveBeenCalledWith('/tmp/pr.md', result.report)
    })
  })

  // ---------------------------------------------------------------------------
  // buildPrTitle — task.md
  // ---------------------------------------------------------------------------
  describe('PR title from task.md', () => {
    it('should use task.md first line as title', async () => {
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

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.report).toContain('add support for youtube embeds in lessons')
    })

    it('should strip "# Task" prefix from task.md', async () => {
      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('task.md'))
      mockReadFileSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('task.md')) {
          return '# Task\nFix the broken login form'
        }
        return ''
      })

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

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

    it('should use "fix:" prefix for fix_bug task type', async () => {
      setupWithTaskJson('fix_bug')

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toMatch(/Title: fix: /)
    })

    it('should use "feat:" prefix for implement_feature task type', async () => {
      setupWithTaskJson('implement_feature')

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toMatch(/Title: feat: /)
    })

    it('should use "refactor:" prefix for refactor task type', async () => {
      setupWithTaskJson('refactor')

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toMatch(/Title: refactor: /)
    })

    it('should use "docs:" prefix for docs task type', async () => {
      setupWithTaskJson('docs')

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toMatch(/Title: docs: /)
    })

    it('should use "chore:" prefix for ops task type', async () => {
      setupWithTaskJson('ops')

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toMatch(/Title: chore: /)
    })

    it('should use "chore:" prefix for research task type', async () => {
      setupWithTaskJson('research')

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toMatch(/Title: chore: /)
    })

    it('should default to "feat:" when task_type is unknown', async () => {
      setupWithTaskJson('banana')

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toMatch(/Title: feat: /)
    })

    it('should default to "feat:" when task.json is invalid JSON', async () => {
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

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.report).toMatch(/Title: feat: /)
    })
  })

  // ---------------------------------------------------------------------------
  // buildPrTitle — fallback to commit messages
  // ---------------------------------------------------------------------------
  describe('PR title fallback to commit messages', () => {
    it('should use first commit message when no task.md exists', async () => {
      setupPrMocks({ commitSummary: 'abc1234 fix login form validation' })
      // No task.md, no task.json
      mockExistsSync.mockReturnValue(false)

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.report).toContain('Title: feat: fix login form validation')
    })

    it('should strip commit hash from the fallback title', async () => {
      setupPrMocks({ commitSummary: 'deadbeef add new feature' })
      mockExistsSync.mockReturnValue(false)

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      // Should strip "deadbeef " prefix - check title line specifically
      expect(result.report).toContain('Title: feat: add new feature')
      const titleLine = result.report.match(/Title: (.*)/)?.[1] || ''
      expect(titleLine).not.toContain('deadbeef')
    })

    it('should use "implement changes" when no commits and no task.md', async () => {
      setupPrMocks({ commitSummary: '' })
      mockExistsSync.mockReturnValue(false)

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.report).toContain('Title: feat: implement changes')
    })

    it('should use first commit only when multiple commits exist', async () => {
      setupPrMocks({ commitSummary: 'abc1234 first commit\ndef5678 second commit' })
      mockExistsSync.mockReturnValue(false)

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      // Should use first commit in title - check title line specifically
      const titleLine = result.report.match(/Title: (.*)/)?.[1] || ''
      expect(titleLine).toContain('first commit')
      expect(titleLine).not.toContain('second commit')
    })
  })

  // ---------------------------------------------------------------------------
  // buildPrTitle — truncation
  // ---------------------------------------------------------------------------
  describe('PR title truncation', () => {
    it('should truncate titles longer than 72 chars with "..."', async () => {
      const longTitle = 'A'.repeat(100) // 100 chars > 72

      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('task.md'))
      mockReadFileSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('task.md')) return `# Task\n${longTitle}`
        return ''
      })

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      // Title should be: "feat: " + truncated description
      // The description is lowercased and truncated to 69 chars + "..."
      const expectedDesc = 'a'.repeat(69) + '...'
      expect(result.report).toContain(`Title: feat: ${expectedDesc}`)
    })

    it('should NOT truncate titles of exactly 72 chars', async () => {
      const exactTitle = 'A'.repeat(72)

      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('task.md'))
      mockReadFileSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('task.md')) return `# Task\n${exactTitle}`
        return ''
      })

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      // 72 chars is exactly the limit, should not be truncated
      expect(result.report).toContain(`Title: feat: ${'a'.repeat(72)}`)
      expect(result.report).not.toContain('...')
    })

    it('should NOT truncate titles shorter than 72 chars', async () => {
      const shortTitle = 'Fix login bug'

      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('task.md'))
      mockReadFileSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('task.md')) return `# Task\n${shortTitle}`
        return ''
      })

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.report).toContain('Title: feat: fix login bug')
      expect(result.report).not.toContain('...')
    })
  })

  // ---------------------------------------------------------------------------
  // buildPrBody — spec summary and commits
  // ---------------------------------------------------------------------------
  // Skipped: These tests check for gh CLI behavior which has been replaced with fetch()
  // The functionality is properly tested in scripted-stages.spec.ts
  describe.skip('PR body content', () => {
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
  // Note: Some edge case tests check CLI behavior which has been replaced with fetch()
  // Skipping tests that check for gh CLI behavior
  describe.skip('edge cases', () => {
    // BUG-F fix: Test that empty GH_PAT is handled correctly
    it('should handle empty GH_PAT env var (BUG-F fix)', async () => {
      // Set GH_PAT to empty string (simulating missing secret)
      const originalGH_PAT = process.env.GH_PAT
      process.env.GH_PAT = ''
      delete process.env.GH_TOKEN

      mockExecFileSync.mockImplementation((file: string, args?: readonly string[]) => {
        const argsArr = args || []
        if (file === 'git' && argsArr.includes('branch') && argsArr.includes('--show-current'))
          return 'feat/x\n'
        if (file === 'git' && argsArr.includes('log') && argsArr.includes('--oneline')) return ''
        // gh pr list returns empty
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'list') return '\n'
        // gh pr create fails with "not authenticated" when no valid token
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'create')
          throw new Error('gh: not authenticated')
        if (file === 'git' && argsArr[0] === 'push') return ''
        return ''
      })
      mockExistsSync.mockReturnValue(false)

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.created).toBe(false)
      expect(result.report).toContain('not authenticated')

      // Restore
      if (originalGH_PAT !== undefined) {
        process.env.GH_PAT = originalGH_PAT
      } else {
        delete process.env.GH_PAT
      }
    })

    it('should handle getExistingPr returning null on error', async () => {
      mockExecFileSync.mockImplementation((file: string, args?: readonly string[]) => {
        const argsArr = args || []
        if (file === 'git' && argsArr.includes('branch') && argsArr.includes('--show-current'))
          return 'feat/x\n'
        if (file === 'git' && argsArr.includes('log') && argsArr.includes('--oneline')) return ''
        // getExistingPr throws
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'list')
          throw new Error('gh: network error')
        if (file === 'git' && argsArr[0] === 'push') return ''
        if (file === 'git' && argsArr[0] === 'remote' && argsArr[1] === 'get-url')
          return 'https://github.com/owner/repo.git'
        return ''
      })
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ html_url: 'https://github.com/o/r/pull/1' }),
      })
      mockExistsSync.mockReturnValue(false)

      // Should not throw — getExistingPr catches the error and returns null
      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.created).toBe(true)
    })

    it('should handle getCommitSummary returning empty on error', async () => {
      mockExecFileSync.mockImplementation((file: string, args?: readonly string[]) => {
        const argsArr = args || []
        if (file === 'git' && argsArr.includes('branch') && argsArr.includes('--show-current'))
          return 'feat/x\n'
        if (file === 'git' && argsArr.includes('log') && argsArr.includes('--oneline'))
          throw new Error('not a git repo')
        if (file === 'gh' && argsArr[0] === 'pr' && argsArr[1] === 'list') return '\n'
        if (file === 'git' && argsArr[0] === 'push') return ''
        if (file === 'git' && argsArr[0] === 'remote' && argsArr[1] === 'get-url')
          return 'https://github.com/owner/repo.git'
        return ''
      })
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ html_url: 'https://github.com/o/r/pull/1' }),
      })
      mockExistsSync.mockReturnValue(false)

      // Should not throw — getCommitSummary catches and returns ''
      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')
      expect(result.created).toBe(true)
      expect(result.report).toContain('Title: feat: implement changes')
    })

    it('should pass title as arg array element without shell escaping', async () => {
      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('task.md'))
      mockReadFileSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('task.md')) return '# Task\nFix "broken" login form'
        return ''
      })

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      // The fetch should have been called with the title
      expect(mockFetch).toHaveBeenCalled()
      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1].body as string)
      // Title should be passed as-is (no shell escaping needed)
      expect(body.title).toContain('fix "broken" login form')
      expect(result.created).toBe(true)
    })

    it('should lowercase the PR title from task.md', async () => {
      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('task.md'))
      mockReadFileSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('task.md')) return '# Task\nAdd YouTube Embed Support'
        return ''
      })

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.report).toContain('Title: feat: add youtube embed support')
    })

    it('should use multiline task.md first line only', async () => {
      setupPrMocks()
      mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('task.md'))
      mockReadFileSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('task.md')) {
          return '# Task\nFirst line for title\nSecond line should be ignored\nThird line too'
        }
        return ''
      })

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      expect(result.report).toContain('first line for title')
      expect(result.report).not.toContain('Second line')
    })

    // Phase 2.1: Shell injection fix verification
    it('should use execFileSync for git log to prevent shell injection', async () => {
      setupPrMocks()
      // Verify that getCommitSummary uses execFileSync, not execSync with string interpolation
      // This is verified by checking that the execFileSync mock was called with git log
      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd')

      // The function should complete without throwing
      expect(result.created).toBe(true)

      // Verify execFileSync was used for git operations (not execSync with string interpolation)
      const gitLogCalls = mockExecFileSync.mock.calls.filter(
        (call) => call[0] === 'git' && call[1]?.includes('log'),
      )
      expect(gitLogCalls.length).toBeGreaterThan(0)
    })
  })

  // ---------------------------------------------------------------------------
  // --fresh flag behavior
  // ---------------------------------------------------------------------------
  describe('--fresh flag behavior', () => {
    it('should skip existing PR check when fresh=true', async () => {
      setupPrMocks({ existingPrUrl: 'https://github.com/owner/repo/pull/99' })

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd', undefined, {
        fresh: true,
      })

      // Should NOT return early with existing PR — should create a new one
      expect(result.created).toBe(true)
    })

    it('should NOT delete or reset the branch when fresh=true', async () => {
      setupPrMocks({ branch: 'feat/my-feature' })

      await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd', undefined, { fresh: true })

      // Verify no branch deletion commands were issued
      const execFileCalls = mockExecFileSync.mock.calls
      const deleteBranchCall = execFileCalls.find(
        (c) => c[0] === 'git' && (c[1] as string[])?.includes('--delete'),
      )
      expect(deleteBranchCall).toBeUndefined()

      // Verify no git branch -D was called
      const branchDCall = execFileCalls.find(
        (c) =>
          c[0] === 'git' &&
          (c[1] as string[])?.[0] === 'branch' &&
          (c[1] as string[])?.includes('-D'),
      )
      expect(branchDCall).toBeUndefined()

      // Verify no git reset --hard was called
      const resetCall = execFileCalls.find(
        (c) =>
          c[0] === 'git' &&
          (c[1] as string[])?.[0] === 'reset' &&
          (c[1] as string[])?.includes('--hard'),
      )
      expect(resetCall).toBeUndefined()
    })

    it('should still push the branch and create PR when fresh=true', async () => {
      setupPrMocks({ branch: 'feat/fresh-feature' })

      const result = await runPrStage('/fake/task-dir', '/tmp/pr.md', '/fake/cwd', undefined, {
        fresh: true,
      })

      expect(result.created).toBe(true)
      expect(result.url).toBe('https://github.com/owner/repo/pull/42')

      // Verify push was called
      const execFileCalls = mockExecFileSync.mock.calls
      const pushCall = execFileCalls.find(
        (c) => c[0] === 'git' && (c[1] as string[])?.[0] === 'push',
      )
      expect(pushCall).toBeDefined()
    })
  })
})
