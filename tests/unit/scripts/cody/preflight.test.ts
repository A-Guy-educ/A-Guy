import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock child_process.execFileSync and fs before importing the module
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}))

// Mock logger to capture log output - use vi.hoisted to avoid hoisting issues
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    trace: vi.fn(),
    silent: vi.fn(),
    level: 'info',
  },
}))

vi.mock('../../../../scripts/cody/logger', () => ({
  logger: mockLogger,
  createStageLogger: vi.fn().mockReturnValue(mockLogger),
}))

import { execFileSync } from 'child_process'
import * as fs from 'fs'
import { preflight } from '../../../../scripts/cody/preflight'

describe('preflight', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    mockLogger.info.mockClear()
    mockLogger.warn.mockClear()
    mockLogger.error.mockClear()

    // Default: all checks pass (including GitHub token)
    process.env.GH_PAT = 'test-token'

    vi.mocked(execFileSync).mockImplementation(
      (program: string, args?: readonly string[], _options?: unknown) => {
        const argsArr = args || []
        if (program === 'node' && argsArr.includes('--version')) {
          return 'v20.11.0'
        }
        return Buffer.from('')
      },
    )
    vi.mocked(fs.existsSync).mockReturnValue(true)
  })

  afterEach(() => {
    // Restore original env to avoid leaking between tests
    process.env = { ...originalEnv }
  })

  it('should pass all checks without throwing', () => {
    preflight()

    // Should print the success message
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Pre-flight complete'))
  })

  it('should throw Error (not process.exit) when ocode CLI is missing', () => {
    vi.mocked(execFileSync).mockImplementation(
      (program: string, args?: readonly string[], _options?: unknown) => {
        const argsArr = args || []
        if (program === 'pnpm' && argsArr.includes('ocode') && argsArr.includes('--version')) {
          throw new Error('command not found: ocode')
        }
        if (program === 'node' && argsArr.includes('--version')) {
          return 'v20.11.0'
        }
        return Buffer.from('')
      },
    )

    expect(() => preflight()).toThrow('Pre-flight checks failed')
    expect(() => preflight()).toThrow(/Run: pnpm install/)
  })

  it('should throw Error when git repo is missing', () => {
    vi.mocked(execFileSync).mockImplementation(
      (program: string, args?: readonly string[], _options?: unknown) => {
        const argsArr = args || []
        if (program === 'git' && argsArr.includes('rev-parse') && argsArr.includes('--git-dir')) {
          throw new Error('fatal: not a git repository')
        }
        if (program === 'node' && argsArr.includes('--version')) {
          return 'v20.11.0'
        }
        return Buffer.from('')
      },
    )

    expect(() => preflight()).toThrow('Pre-flight checks failed')
  })

  it('should throw Error when Node.js is too old (v16)', () => {
    vi.mocked(execFileSync).mockImplementation(
      (program: string, args?: readonly string[], _options?: unknown) => {
        const argsArr = args || []
        if (program === 'node' && argsArr.includes('--version')) {
          return 'v16.20.0'
        }
        return Buffer.from('')
      },
    )

    expect(() => preflight()).toThrow('Pre-flight checks failed')
  })

  it('should throw Error when package.json is missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    expect(() => preflight()).toThrow('Pre-flight checks failed')
  })

  it('should throw Error when GitHub token is missing', () => {
    delete process.env.GH_PAT
    delete process.env.GH_TOKEN

    expect(() => preflight()).toThrow('Pre-flight checks failed')
    expect(() => preflight()).toThrow(/GH_PAT or GH_TOKEN/)
  })

  it('should accept GH_TOKEN as alternative to GH_PAT', () => {
    delete process.env.GH_PAT
    process.env.GH_TOKEN = 'gh-token-value'

    preflight()
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Pre-flight complete'))
  })

  it('should collect all error messages in thrown Error when multiple checks fail', () => {
    // Fail ocode CLI, git repo, and pnpm
    vi.mocked(execFileSync).mockImplementation(
      (program: string, args?: readonly string[], _options?: unknown) => {
        const argsArr = args || []
        if (program === 'pnpm' && argsArr.includes('ocode') && argsArr.includes('--version')) {
          throw new Error('command not found: ocode')
        }
        if (program === 'git' && argsArr.includes('rev-parse') && argsArr.includes('--git-dir')) {
          throw new Error('fatal: not a git repository')
        }
        if (program === 'which' && argsArr.includes('pnpm')) {
          throw new Error('pnpm not found')
        }
        if (program === 'node' && argsArr.includes('--version')) {
          return 'v20.11.0'
        }
        return Buffer.from('')
      },
    )
    vi.mocked(fs.existsSync).mockReturnValue(false)

    let thrownError: Error | undefined
    try {
      preflight()
    } catch (e) {
      thrownError = e as Error
    }

    expect(thrownError).toBeDefined()
    expect(thrownError!.message).toContain('Pre-flight checks failed')
    expect(thrownError!.message).toContain('Run: pnpm install')
    expect(thrownError!.message).toContain('Initialize git: git init')
    expect(thrownError!.message).toContain('Install: npm install -g pnpm')
    expect(thrownError!.message).toContain('Run from project root with package.json')

    // Should have logged multiple failure lines (❌)
    const failureLogs = mockLogger.info.mock.calls.filter(
      (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('❌'),
    )
    expect(failureLogs.length).toBeGreaterThanOrEqual(4)
  })

  it('should log ✅ for each passing check', () => {
    preflight()

    const passLogs = mockLogger.info.mock.calls.filter(
      (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('✅'),
    )
    // 6 checks pass + the final "Pre-flight complete" line
    expect(passLogs.length).toBeGreaterThanOrEqual(6)
  })

  it('should throw Error when pnpm is missing', () => {
    vi.mocked(execFileSync).mockImplementation(
      (program: string, args?: readonly string[], _options?: unknown) => {
        const argsArr = args || []
        if (program === 'which' && argsArr.includes('pnpm')) {
          throw new Error('pnpm not found')
        }
        if (program === 'node' && argsArr.includes('--version')) {
          return 'v20.11.0'
        }
        return Buffer.from('')
      },
    )

    expect(() => preflight()).toThrow('Pre-flight checks failed')
  })

  it('should accept Node.js v18 as valid', () => {
    vi.mocked(execFileSync).mockImplementation(
      (program: string, args?: readonly string[], _options?: unknown) => {
        const argsArr = args || []
        if (program === 'node' && argsArr.includes('--version')) {
          return 'v18.0.0'
        }
        return Buffer.from('')
      },
    )

    preflight()
    // Should not throw
  })

  it('should throw an Error instance (not call process.exit)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    try {
      preflight()
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(Error)
      // Verify it's NOT a process.exit mock error
      expect((e as Error).message).not.toContain('process.exit')
      expect((e as Error).message).toContain('Pre-flight checks failed')
    }
  })
})
