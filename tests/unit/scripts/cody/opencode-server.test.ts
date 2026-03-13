import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execFileSync: vi.fn(),
}))

// Mock fs (partial)
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    copyFileSync: vi.fn(),
  }
})

// Mock logger
vi.mock('../../../../scripts/cody/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock global fetch for health checks
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { execFileSync } from 'child_process'
import {
  findLastSessionId,
  checkpointDb,
  waitForHealthy,
} from '../../../../scripts/cody/opencode-server'

describe('findLastSessionId', () => {
  it('should return the sessionId of the last completed stage in pipeline order', () => {
    const stages = {
      taskify: { state: 'completed', sessionId: 'sess-1' },
      spec: { state: 'completed', sessionId: 'sess-2' },
      build: { state: 'completed', sessionId: 'sess-3' },
      review: { state: 'pending' },
    }
    const order = ['taskify', 'spec', 'build', 'review']

    const result = findLastSessionId(stages, order)
    expect(result).toBe('sess-3')
  })

  it('should return the sessionId of the last failed stage with a sessionId', () => {
    const stages = {
      taskify: { state: 'completed', sessionId: 'sess-1' },
      spec: { state: 'completed', sessionId: 'sess-2' },
      build: { state: 'failed', sessionId: 'sess-3' },
    }
    const order = ['taskify', 'spec', 'build']

    const result = findLastSessionId(stages, order)
    expect(result).toBe('sess-3')
  })

  it('should skip stages without sessionId', () => {
    const stages = {
      taskify: { state: 'completed', sessionId: 'sess-1' },
      'plan-gap': { state: 'completed' }, // scripted stage, no sessionId
      build: { state: 'completed', sessionId: 'sess-3' },
    }
    const order = ['taskify', 'plan-gap', 'build']

    const result = findLastSessionId(stages, order)
    expect(result).toBe('sess-3')
  })

  it('should return undefined when no stages have sessionIds', () => {
    const stages = {
      taskify: { state: 'completed' },
      spec: { state: 'completed' },
    }
    const order = ['taskify', 'spec']

    const result = findLastSessionId(stages, order)
    expect(result).toBeUndefined()
  })

  it('should return undefined for empty stages', () => {
    const result = findLastSessionId({}, ['taskify', 'spec'])
    expect(result).toBeUndefined()
  })

  it('should return undefined for empty pipeline order', () => {
    const stages = {
      taskify: { state: 'completed', sessionId: 'sess-1' },
    }
    const result = findLastSessionId(stages, [])
    expect(result).toBeUndefined()
  })

  it('should skip skipped and pending stages', () => {
    const stages = {
      taskify: { state: 'completed', sessionId: 'sess-1' },
      spec: { state: 'skipped' },
      build: { state: 'pending' },
    }
    const order = ['taskify', 'spec', 'build']

    const result = findLastSessionId(stages, order)
    expect(result).toBe('sess-1')
  })

  it('should return sessionId from timed-out stage (I1: timeout state)', () => {
    // A timed-out stage may have a valid sessionId — it should be considered for rerun recovery
    const stages = {
      taskify: { state: 'completed', sessionId: 'sess-1' },
      spec: { state: 'completed', sessionId: 'sess-2' },
      build: { state: 'timeout', sessionId: 'sess-3' },
    }
    const order = ['taskify', 'spec', 'build']

    const result = findLastSessionId(stages, order)
    expect(result).toBe('sess-3')
  })
})

describe('checkpointDb', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should run sqlite3 PRAGMA wal_checkpoint when DB exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)

    checkpointDb('/task/dir')

    expect(execFileSync).toHaveBeenCalledWith(
      'sqlite3',
      [
        path.join('/task/dir', 'opencode-data', 'opencode', 'opencode.db'),
        'PRAGMA wal_checkpoint(TRUNCATE);',
      ],
      expect.objectContaining({
        stdio: 'pipe',
        timeout: 10_000,
      }),
    )
  })

  it('should not run sqlite3 when DB does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    checkpointDb('/task/dir')

    expect(execFileSync).not.toHaveBeenCalled()
  })

  it('should not throw when sqlite3 fails (non-fatal)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('sqlite3 not found')
    })

    // Should not throw
    expect(() => checkpointDb('/task/dir')).not.toThrow()
  })
})

describe('waitForHealthy', () => {
  // Use real timers here — waitForHealthy uses Date.now() + AbortSignal.timeout()
  // which interact poorly with fake timers. Use short real timeouts instead.
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return true when health endpoint responds with healthy: true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ healthy: true }),
    })

    const result = await waitForHealthy('http://127.0.0.1:4097', 5000)

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:4097/global/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('should return false when timeout expires', async () => {
    // Always reject fetch (server never becomes ready)
    mockFetch.mockRejectedValue(new Error('Connection refused'))

    // Very short timeout — should fail fast
    const result = await waitForHealthy('http://127.0.0.1:4097', 200)

    expect(result).toBe(false)
    // Should have tried at least once
    expect(mockFetch).toHaveBeenCalled()
  }, 10_000)

  it('should retry on fetch failure until healthy', async () => {
    // First call fails, second succeeds
    mockFetch.mockRejectedValueOnce(new Error('Connection refused')).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ healthy: true }),
    })

    const result = await waitForHealthy('http://127.0.0.1:4097', 5000)

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

// Import verifyClientAttach after the mocks are set up
import { verifyClientAttach } from '../../../../scripts/cody/opencode-server'

describe('verifyClientAttach', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // resolveOpenCodeBinary is called by verifyClientAttach
    // Mock fs.existsSync for the binary resolution
    ;(fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true)
  })

  it('should return true when client connects successfully (model error is fine)', () => {
    // execFileSync throws with a model error (exit code 1) but no instance error
    const error = new Error('command failed') as Error & { stderr: Buffer; stdout: Buffer }
    error.stderr = Buffer.from('Error: Model not found: some-model')
    error.stdout = Buffer.from('{"type":"error","error":{"name":"ModelError"}}')
    ;(execFileSync as ReturnType<typeof vi.fn>).mockImplementation(
      (cmd: string, args: string[]) => {
        if (args?.includes('--version')) return '1.2.21'
        throw error
      },
    )

    expect(verifyClientAttach('http://127.0.0.1:4097', '/tmp/test-data')).toBe(true)
  })

  it('should return false when instance context not found', () => {
    const error = new Error('command failed') as Error & { stderr: Buffer; stdout: Buffer }
    error.stderr = Buffer.from('No context found for instance')
    error.stdout = Buffer.from('')
    ;(execFileSync as ReturnType<typeof vi.fn>).mockImplementation(
      (cmd: string, args: string[]) => {
        if (args?.includes('--version')) return '1.2.21'
        throw error
      },
    )

    expect(verifyClientAttach('http://127.0.0.1:4097', '/tmp/test-data')).toBe(false)
  })

  it('should return true when execFileSync succeeds (no output issues)', () => {
    ;(execFileSync as ReturnType<typeof vi.fn>).mockImplementation(
      (cmd: string, args: string[]) => {
        if (args?.includes('--version')) return '1.2.21'
        return '{"type":"session.created"}'
      },
    )

    expect(verifyClientAttach('http://127.0.0.1:4097', '/tmp/test-data')).toBe(true)
  })

  it('should return false when stdout contains instance error', () => {
    ;(execFileSync as ReturnType<typeof vi.fn>).mockImplementation(
      (cmd: string, args: string[]) => {
        if (args?.includes('--version')) return '1.2.21'
        return 'No context found for instance'
      },
    )

    expect(verifyClientAttach('http://127.0.0.1:4097', '/tmp/test-data')).toBe(false)
  })

  it('should return false when command times out (killed by timeout)', () => {
    const error = new Error('command failed') as Error & {
      stderr: Buffer
      stdout: Buffer
      killed: boolean
      signal: string
    }
    error.stderr = Buffer.from('')
    error.stdout = Buffer.from('')
    error.killed = true
    error.signal = 'SIGTERM'
    ;(execFileSync as ReturnType<typeof vi.fn>).mockImplementation(
      (cmd: string, args: string[]) => {
        if (args?.includes('--version')) return '1.2.21'
        throw error
      },
    )

    expect(verifyClientAttach('http://127.0.0.1:4097', '/tmp/test-data')).toBe(false)
  })

  it('should return false when stderr contains "Unexpected error, check log file"', () => {
    const error = new Error('command failed') as Error & { stderr: Buffer; stdout: Buffer }
    error.stderr = Buffer.from('Unexpected error, check log file at /tmp/opencode.log')
    error.stdout = Buffer.from('')
    ;(execFileSync as ReturnType<typeof vi.fn>).mockImplementation(
      (cmd: string, args: string[]) => {
        if (args?.includes('--version')) return '1.2.21'
        throw error
      },
    )

    expect(verifyClientAttach('http://127.0.0.1:4097', '/tmp/test-data')).toBe(false)
  })
})
