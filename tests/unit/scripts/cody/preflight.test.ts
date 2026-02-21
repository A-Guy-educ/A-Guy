import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock child_process.execSync and fs before importing the module
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}))

import { execSync } from 'child_process'
import * as fs from 'fs'
import { preflight } from '../../../../scripts/cody/preflight'

describe('preflight', () => {
  let consoleSpy: { log: ReturnType<typeof vi.spyOn>; error: ReturnType<typeof vi.spyOn> }

  beforeEach(() => {
    vi.clearAllMocks()

    // Suppress console output during tests
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    }

    // Default: all checks pass
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('node --version')) {
        return 'v20.11.0'
      }
      return Buffer.from('')
    })
    vi.mocked(fs.existsSync).mockReturnValue(true)
  })

  afterEach(() => {
    consoleSpy.log.mockRestore()
    consoleSpy.error.mockRestore()
  })

  it('should pass all checks without throwing', () => {
    preflight()

    // Should print the success message
    expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Pre-flight complete'))
  })

  it('should throw Error (not process.exit) when ocode CLI is missing', () => {
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('pnpm ocode --version')) {
        throw new Error('command not found: ocode')
      }
      if (typeof cmd === 'string' && cmd.includes('node --version')) {
        return 'v20.11.0'
      }
      return Buffer.from('')
    })

    expect(() => preflight()).toThrow('Pre-flight checks failed')
    expect(() => preflight()).toThrow(/Run: pnpm install/)
  })

  it('should throw Error when git repo is missing', () => {
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('git rev-parse --git-dir')) {
        throw new Error('fatal: not a git repository')
      }
      if (typeof cmd === 'string' && cmd.includes('node --version')) {
        return 'v20.11.0'
      }
      return Buffer.from('')
    })

    expect(() => preflight()).toThrow('Pre-flight checks failed')
  })

  it('should throw Error when Node.js is too old (v16)', () => {
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('node --version')) {
        return 'v16.20.0'
      }
      return Buffer.from('')
    })

    expect(() => preflight()).toThrow('Pre-flight checks failed')
  })

  it('should throw Error when package.json is missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    expect(() => preflight()).toThrow('Pre-flight checks failed')
  })

  it('should collect all error messages in thrown Error when multiple checks fail', () => {
    // Fail ocode CLI, git repo, and pnpm
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('pnpm ocode --version')) {
        throw new Error('command not found: ocode')
      }
      if (typeof cmd === 'string' && cmd.includes('git rev-parse --git-dir')) {
        throw new Error('fatal: not a git repository')
      }
      if (typeof cmd === 'string' && cmd.includes('which pnpm')) {
        throw new Error('pnpm not found')
      }
      if (typeof cmd === 'string' && cmd.includes('node --version')) {
        return 'v20.11.0'
      }
      return Buffer.from('')
    })
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
    const failureLogs = consoleSpy.log.mock.calls.filter(
      (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('❌'),
    )
    expect(failureLogs.length).toBeGreaterThanOrEqual(4)
  })

  it('should log ✅ for each passing check', () => {
    preflight()

    const passLogs = consoleSpy.log.mock.calls.filter(
      (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('✅'),
    )
    // 5 checks pass + the final "Pre-flight complete" line
    expect(passLogs.length).toBeGreaterThanOrEqual(5)
  })

  it('should throw Error when pnpm is missing', () => {
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('which pnpm')) {
        throw new Error('pnpm not found')
      }
      if (typeof cmd === 'string' && cmd.includes('node --version')) {
        return 'v20.11.0'
      }
      return Buffer.from('')
    })

    expect(() => preflight()).toThrow('Pre-flight checks failed')
  })

  it('should accept Node.js v18 as valid', () => {
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('node --version')) {
        return 'v18.0.0'
      }
      return Buffer.from('')
    })

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
