import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import type { PipelineContext, PostAction } from '../../../../../scripts/cody/engine/types'

// Mock child_process
const mockExecFileSync = vi.fn()
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}))

// Mock agent-runner
const mockRunAgent = vi.fn()
vi.mock('../../../../../scripts/cody/agent-runner', () => ({
  runAgentWithFileWatch: (...args: unknown[]) => mockRunAgent(...args),
  STAGE_TIMEOUTS: { autofix: 300000, build: 2700000 },
  DEFAULT_TIMEOUT: 600000,
}))

// Mock fs partially
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs')
  return {
    ...actual,
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    existsSync: vi.fn(() => false),
    readFileSync: actual.readFileSync,
    renameSync: vi.fn(),
  }
})

// Mock other deps
vi.mock('../../../../../scripts/cody/pipeline-utils', () => ({
  readTask: vi.fn(),
  resolvePipelineProfile: vi.fn(),
  resolveControlMode: vi.fn(),
  stageOutputFile: vi.fn(),
}))
vi.mock('../../../../../scripts/cody/clarify-workflow', () => ({
  handleGateApproval: vi.fn(),
}))
vi.mock('../../../../../scripts/cody/github-api', () => ({
  extractGateCommentBody: vi.fn(),
  postComment: vi.fn(),
}))
vi.mock('../../../../../scripts/cody/git-utils', () => ({
  commitPipelineFiles: vi.fn(),
}))
vi.mock('../../../../../scripts/cody/engine/status', () => ({
  loadState: vi.fn(() => null),
  updateStage: vi.fn((s: unknown) => s),
  completeState: vi.fn((s: unknown) => s),
  writeState: vi.fn(),
}))

import { executePostAction } from '../../../../../scripts/cody/pipeline/post-actions'

function makeCtx(overrides: Partial<PipelineContext> = {}): PipelineContext {
  return {
    taskId: 'test-123',
    taskDir: '/tmp/test-123',
    input: { taskId: 'test-123', mode: 'full' as const, dryRun: false },
    taskDef: null,
    profile: 'standard',
    backend: { name: 'test', spawn: vi.fn() } as unknown as PipelineContext['backend'],
    ...overrides,
  } as PipelineContext
}

describe('run-quality-with-autofix post-action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const action: PostAction = {
    type: 'run-quality-with-autofix',
    gates: [
      { name: 'TypeScript', command: 'pnpm -s tsc --noEmit', source: 'tsc' as const },
      { name: 'Unit Tests', command: 'pnpm -s test:unit', source: 'test' as const },
    ],
    maxFeedbackLoops: 2,
  }

  it('completes immediately when all gates pass on first try', async () => {
    mockExecFileSync.mockReturnValue('')
    const ctx = makeCtx()

    await executePostAction(ctx, action, null)

    expect(mockRunAgent).not.toHaveBeenCalled()
  })

  it('runs build agent when tsc fails, then retries and passes', async () => {
    let tscCallCount = 0
    mockExecFileSync.mockImplementation((program: string, args: string[] | undefined) => {
      const argsArr = args || []
      const fullCommand = `${program} ${argsArr.join(' ')}`
      if (fullCommand.includes('tsc')) {
        tscCallCount++
        if (tscCallCount === 1) {
          const err = new Error('tsc failed') as Error & { stdout: Buffer; stderr: Buffer }
          err.stdout = Buffer.from('src/foo.ts(10,5): error TS2345: Argument...')
          err.stderr = Buffer.from('')
          throw err
        }
        return '' // passes on second call
      }
      return '' // unit tests pass
    })
    mockRunAgent.mockResolvedValue({ succeeded: true, timedOut: false, retries: 0 })
    const ctx = makeCtx()

    await executePostAction(ctx, action, null)

    // Build agent was called once
    expect(mockRunAgent).toHaveBeenCalledTimes(1)
    // build-errors.md was written
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('build-errors.md'),
      expect.stringContaining('type_error'),
    )
  })

  it('throws after exhausting maxFeedbackLoops', async () => {
    // tsc always fails
    mockExecFileSync.mockImplementation((program: string, args: string[] | undefined) => {
      const argsArr = args || []
      const fullCommand = `${program} ${argsArr.join(' ')}`
      if (fullCommand.includes('tsc')) {
        const err = new Error('tsc failed') as Error & { stdout: Buffer; stderr: Buffer }
        err.stdout = Buffer.from('src/foo.ts(10,5): error TS2345: Argument...')
        err.stderr = Buffer.from('')
        throw err
      }
      return '' // unit tests pass
    })
    mockRunAgent.mockResolvedValue({ succeeded: true, timedOut: false, retries: 0 })
    const ctx = makeCtx()

    await expect(executePostAction(ctx, action, null)).rejects.toThrow(
      /Quality gates failed after 2 build agent fix attempts/,
    )
    expect(mockRunAgent).toHaveBeenCalledTimes(2)
  })

  it('skips execution in dryRun mode', async () => {
    const ctx = makeCtx({
      input: { taskId: 'test-123', mode: 'full' as const, dryRun: true },
    })

    await executePostAction(ctx, action, null)

    expect(mockExecFileSync).not.toHaveBeenCalled()
    expect(mockRunAgent).not.toHaveBeenCalled()
  })

  it('re-runs all gates after build agent fix (catches regressions)', async () => {
    const commandCalls: string[] = []
    let tscCallCount = 0
    mockExecFileSync.mockImplementation((program: string, args: string[] | undefined) => {
      const argsArr = args || []
      const fullCommand = `${program} ${argsArr.join(' ')}`
      commandCalls.push(fullCommand)
      if (fullCommand.includes('tsc')) {
        tscCallCount++
        if (tscCallCount === 1) {
          const err = new Error('tsc failed') as Error & { stdout: Buffer; stderr: Buffer }
          err.stdout = Buffer.from('src/foo.ts(10,5): error TS2345: Argument...')
          err.stderr = Buffer.from('')
          throw err
        }
        return ''
      }
      return '' // tests always pass
    })
    mockRunAgent.mockResolvedValue({ succeeded: true, timedOut: false, retries: 0 })
    const ctx = makeCtx()

    await executePostAction(ctx, action, null)

    // First run: both gates called (tsc fails, tests pass)
    // Re-run: ALL gates re-run (build agent fix might break previously passing gates)
    const tscCalls = commandCalls.filter((c) => c.includes('tsc'))
    const testCalls = commandCalls.filter((c) => c.includes('test:unit'))
    expect(tscCalls).toHaveLength(2) // initial + retry
    expect(testCalls).toHaveLength(2) // initial + retry (all gates re-run)
  })
})
