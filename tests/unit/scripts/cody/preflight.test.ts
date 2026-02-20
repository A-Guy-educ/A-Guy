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
  let exitSpy: ReturnType<typeof vi.spyOn>
  let consoleSpy: { log: ReturnType<typeof vi.spyOn>; error: ReturnType<typeof vi.spyOn> }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock process.exit to prevent actual exit — throw to stop execution flow
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((code?: number | string | null | undefined) => {
        throw new Error(`process.exit(${code})`)
      })

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
    exitSpy.mockRestore()
    consoleSpy.log.mockRestore()
    consoleSpy.error.mockRestore()
  })

  it('should pass all checks without calling process.exit', () => {
    preflight()

    expect(exitSpy).not.toHaveBeenCalled()
    // Should print the success message
    expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Pre-flight complete'))
  })

  it('should call process.exit(1) when ocode CLI is missing', () => {
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('pnpm ocode --version')) {
        throw new Error('command not found: ocode')
      }
      if (typeof cmd === 'string' && cmd.includes('node --version')) {
        return 'v20.11.0'
      }
      return Buffer.from('')
    })

    expect(() => preflight()).toThrow('process.exit(1)')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('should call process.exit(1) when git repo is missing', () => {
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('git rev-parse --git-dir')) {
        throw new Error('fatal: not a git repository')
      }
      if (typeof cmd === 'string' && cmd.includes('node --version')) {
        return 'v20.11.0'
      }
      return Buffer.from('')
    })

    expect(() => preflight()).toThrow('process.exit(1)')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('should call process.exit(1) when Node.js is too old (v16)', () => {
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('node --version')) {
        return 'v16.20.0'
      }
      return Buffer.from('')
    })

    expect(() => preflight()).toThrow('process.exit(1)')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('should call process.exit(1) when package.json is missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    expect(() => preflight()).toThrow('process.exit(1)')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('should collect all errors when multiple checks fail', () => {
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

    expect(() => preflight()).toThrow('process.exit(1)')

    // Should have logged multiple failure lines (❌)
    const failureLogs = consoleSpy.log.mock.calls.filter(
      (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('❌'),
    )
    expect(failureLogs.length).toBeGreaterThanOrEqual(4)

    // Should have printed all error messages
    const errorMessages = consoleSpy.error.mock.calls.map((args: unknown[]) => args[0]).join('\n')
    expect(errorMessages).toContain('Install: curl -fsSL https://opencode.ai/install | bash')
    expect(errorMessages).toContain('Initialize git: git init')
    expect(errorMessages).toContain('Install: npm install -g pnpm')
    expect(errorMessages).toContain('Run from project root with package.json')
  })

  it('should log ✅ for each passing check', () => {
    preflight()

    const passLogs = consoleSpy.log.mock.calls.filter(
      (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('✅'),
    )
    // 5 checks pass + the final "Pre-flight complete" line
    expect(passLogs.length).toBeGreaterThanOrEqual(5)
  })

  it('should call process.exit(1) when pnpm is missing', () => {
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('which pnpm')) {
        throw new Error('pnpm not found')
      }
      if (typeof cmd === 'string' && cmd.includes('node --version')) {
        return 'v20.11.0'
      }
      return Buffer.from('')
    })

    expect(() => preflight()).toThrow('process.exit(1)')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('should accept Node.js v18 as valid', () => {
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('node --version')) {
        return 'v18.0.0'
      }
      return Buffer.from('')
    })

    preflight()
    expect(exitSpy).not.toHaveBeenCalled()
  })
})
