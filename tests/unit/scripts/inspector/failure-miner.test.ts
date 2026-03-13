import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'

import {
  extractFailure,
  collectFailures,
} from '../../../../scripts/inspector/plugins/cody/failure-miner/collector'
import { analyzeFailures } from '../../../../scripts/inspector/plugins/cody/failure-miner/analyzer'
import {
  formatHotspotTitle,
  formatHotspotBody,
  formatErrorPatternTitle,
  formatErrorPatternBody,
  hotspotSearchQuery,
  errorPatternSearchQuery,
} from '../../../../scripts/inspector/plugins/cody/failure-miner/reporter'
import { failureMinerPlugin } from '../../../../scripts/inspector/plugins/cody/failure-miner/index'
import type { InspectorContext, GitHubClient } from '../../../../scripts/inspector/core/types'

vi.mock('fs')

// ============================================================================
// Helpers
// ============================================================================

function makeCtx(overrides: Partial<InspectorContext> = {}): InspectorContext {
  return {
    repo: 'owner/repo',
    dryRun: false,
    cycleNumber: 5,
    runTimestamp: new Date().toISOString(),
    state: { get: vi.fn(), set: vi.fn(), save: vi.fn() },
    github: {
      postComment: vi.fn(),
      getIssue: vi.fn().mockReturnValue({ body: null, title: null }),
      getOpenIssues: vi.fn().mockReturnValue([]),
      triggerWorkflow: vi.fn(),
      addLabel: vi.fn(),
      removeLabel: vi.fn(),
      setLifecycleLabel: vi.fn(),
      closeIssue: vi.fn(),
      getIssueComments: vi.fn().mockReturnValue([]),
      listWorkflowRuns: vi.fn().mockReturnValue([]),
      createIssue: vi.fn().mockReturnValue(42),
      searchIssues: vi.fn().mockReturnValue([]),
    } as GitHubClient,
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as InspectorContext['log'],
    ...overrides,
  }
}

// ============================================================================
// extractFailure
// ============================================================================

describe('extractFailure', () => {
  it('returns null for non-failed tasks', () => {
    expect(extractFailure({ state: 'completed' })).toBeNull()
    expect(extractFailure({ state: 'running' })).toBeNull()
  })

  it('extracts failed stage and error from v2 status', () => {
    const status = {
      version: 2,
      taskId: 'task-abc',
      state: 'failed',
      cursor: 'build',
      updatedAt: '2026-01-01T00:00:00Z',
      stages: {
        build: {
          state: 'failed',
          error: 'TypeScript error: type mismatch',
          completedAt: '2026-01-01T00:10:00Z',
        },
      },
    }
    const result = extractFailure(status)
    expect(result).not.toBeNull()
    expect(result!.failedStage).toBe('build')
    expect(result!.error).toBe('TypeScript error: type mismatch')
    expect(result!.statusVersion).toBe(2)
  })

  it('handles v1 format using currentStage fallback', () => {
    const status = {
      taskId: 'task-v1',
      state: 'failed',
      currentStage: 'spec',
      updatedAt: '2026-01-02T00:00:00Z',
      stages: {
        taskify: { state: 'completed' },
        spec: { state: 'completed' }, // no failed stage explicitly
      },
    }
    const result = extractFailure(status)
    expect(result).not.toBeNull()
    expect(result!.statusVersion).toBe(1)
    expect(result!.failedStage).toBe('spec')
  })

  it('uses cursor fallback for v2 when no explicit failed stage', () => {
    const status = {
      version: 2,
      taskId: 'task-v2-noerr',
      state: 'failed',
      cursor: 'review',
      updatedAt: '2026-01-03T00:00:00Z',
      stages: {
        build: { state: 'completed' },
      },
    }
    const result = extractFailure(status)
    expect(result!.failedStage).toBe('review')
  })

  it('returns unknown taskId when missing', () => {
    const result = extractFailure({ state: 'failed' })
    expect(result!.taskId).toBe('unknown')
  })
})

// ============================================================================
// collectFailures
// ============================================================================

describe('collectFailures', () => {
  const mockFs = vi.mocked(fs)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when tasks directory does not exist', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(false)
    expect(collectFailures('/some/tasks')).toEqual([])
  })

  it('skips _archive directory', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: '_archive', isDirectory: () => true }] as unknown as fs.Dirent[])

    const results = collectFailures('/tasks')
    expect(results).toHaveLength(0)
  })

  it('collects failed tasks from valid status.json files', () => {
    const statusContent = JSON.stringify({
      version: 2,
      taskId: 'task-1',
      state: 'failed',
      cursor: 'build',
      updatedAt: '2026-03-10T00:00:00Z',
      stages: { build: { state: 'failed', error: 'tsc error' } },
    })

    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'task-1', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readFileSync = vi.fn().mockReturnValue(statusContent)

    const results = collectFailures('/tasks')
    expect(results).toHaveLength(1)
    expect(results[0].taskId).toBe('task-1')
    expect(results[0].failedStage).toBe('build')
  })

  it('skips directories with no status.json', () => {
    mockFs.existsSync = vi
      .fn()
      .mockReturnValueOnce(true) // tasksDir exists
      .mockReturnValueOnce(false) // status.json does not exist
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'task-empty', isDirectory: () => true }] as unknown as fs.Dirent[])

    expect(collectFailures('/tasks')).toHaveLength(0)
  })

  it('skips non-directory entries', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([
        { name: 'somefile.txt', isDirectory: () => false },
      ] as unknown as fs.Dirent[])

    expect(collectFailures('/tasks')).toHaveLength(0)
  })
})

// ============================================================================
// analyzeFailures
// ============================================================================

describe('analyzeFailures', () => {
  it('returns empty analysis for no failures', () => {
    const result = analyzeFailures([])
    expect(result.totalFailures).toBe(0)
    expect(result.stageHotspots).toHaveLength(0)
    expect(result.errorPatterns).toHaveLength(0)
  })

  it('detects stage hotspot when same stage fails >= 2 times', () => {
    const records = [
      {
        taskId: 't1',
        failedStage: 'build',
        error: '',
        failedAt: '2026-01-01T00:00:00Z',
        statusVersion: 2 as const,
      },
      {
        taskId: 't2',
        failedStage: 'build',
        error: '',
        failedAt: '2026-01-02T00:00:00Z',
        statusVersion: 2 as const,
      },
      {
        taskId: 't3',
        failedStage: 'verify',
        error: '',
        failedAt: '2026-01-03T00:00:00Z',
        statusVersion: 2 as const,
      },
    ]
    const result = analyzeFailures(records)
    expect(result.stageHotspots).toHaveLength(1)
    expect(result.stageHotspots[0].stage).toBe('build')
    expect(result.stageHotspots[0].failureCount).toBe(2)
  })

  it('does NOT flag a stage that failed only once', () => {
    const records = [
      {
        taskId: 't1',
        failedStage: 'spec',
        error: '',
        failedAt: '2026-01-01T00:00:00Z',
        statusVersion: 2 as const,
      },
    ]
    const result = analyzeFailures(records)
    expect(result.stageHotspots).toHaveLength(0)
  })

  it('detects typescript error pattern', () => {
    const records = [
      {
        taskId: 't1',
        failedStage: 'build',
        error: 'TypeScript compilation failed: type error',
        failedAt: '2026-01-01T00:00:00Z',
        statusVersion: 2 as const,
      },
      {
        taskId: 't2',
        failedStage: 'build',
        error: 'tsc --noEmit failed with errors',
        failedAt: '2026-01-02T00:00:00Z',
        statusVersion: 2 as const,
      },
    ]
    const result = analyzeFailures(records)
    const tsPattern = result.errorPatterns.find((p) => p.label === 'type-error')
    expect(tsPattern).toBeDefined()
    expect(tsPattern!.occurrences).toBe(2)
  })

  it('does NOT flag error pattern that appears only once', () => {
    const records = [
      {
        taskId: 't1',
        failedStage: 'build',
        error: 'rate limit exceeded',
        failedAt: '2026-01-01T00:00:00Z',
        statusVersion: 2 as const,
      },
    ]
    const result = analyzeFailures(records)
    expect(result.errorPatterns).toHaveLength(0)
  })

  it('sorts hotspots by failure count descending', () => {
    const records = [
      {
        taskId: 't1',
        failedStage: 'verify',
        error: '',
        failedAt: '2026-01-01T00:00:00Z',
        statusVersion: 2 as const,
      },
      {
        taskId: 't2',
        failedStage: 'verify',
        error: '',
        failedAt: '2026-01-02T00:00:00Z',
        statusVersion: 2 as const,
      },
      {
        taskId: 't3',
        failedStage: 'verify',
        error: '',
        failedAt: '2026-01-03T00:00:00Z',
        statusVersion: 2 as const,
      },
      {
        taskId: 't4',
        failedStage: 'build',
        error: '',
        failedAt: '2026-01-04T00:00:00Z',
        statusVersion: 2 as const,
      },
      {
        taskId: 't5',
        failedStage: 'build',
        error: '',
        failedAt: '2026-01-05T00:00:00Z',
        statusVersion: 2 as const,
      },
    ]
    const result = analyzeFailures(records)
    expect(result.stageHotspots[0].stage).toBe('verify')
    expect(result.stageHotspots[0].failureCount).toBe(3)
  })
})

// ============================================================================
// reporter
// ============================================================================

describe('reporter formatting', () => {
  it('formatHotspotTitle includes stage and count', () => {
    const title = formatHotspotTitle('build', 5)
    expect(title).toContain('build')
    expect(title).toContain('5x')
  })

  it('formatErrorPatternTitle includes label and count', () => {
    const title = formatErrorPatternTitle('type-error', 3)
    expect(title).toContain('type-error')
    expect(title).toContain('3x')
  })

  it('formatHotspotBody includes stage name and percentage', () => {
    const analysis = {
      totalFailures: 10,
      stageHotspots: [],
      errorPatterns: [],
      analysisDate: '2026-01-01T00:00:00Z',
    }
    const body = formatHotspotBody(analysis, 'build', 5)
    expect(body).toContain('build')
    expect(body).toContain('50%')
  })

  it('formatErrorPatternBody includes task IDs', () => {
    const analysis = {
      totalFailures: 5,
      stageHotspots: [],
      errorPatterns: [],
      analysisDate: '2026-01-01T00:00:00Z',
    }
    const body = formatErrorPatternBody(analysis, 'type-error', 3, ['t1', 't2', 't3'])
    expect(body).toContain('t1')
    expect(body).toContain('type-error')
  })

  it('hotspotSearchQuery includes stage name', () => {
    expect(hotspotSearchQuery('build')).toContain('build')
    expect(hotspotSearchQuery('build')).toContain('cody:improvement')
  })

  it('errorPatternSearchQuery includes label', () => {
    expect(errorPatternSearchQuery('type-error')).toContain('type-error')
  })
})

// ============================================================================
// failureMinerPlugin integration
// ============================================================================

describe('failureMinerPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fs).existsSync = vi.fn().mockReturnValue(false)
  })

  it('returns no actions when no tasks directory', async () => {
    const ctx = makeCtx()
    const actions = await failureMinerPlugin.run(ctx)
    expect(actions).toHaveLength(0)
  })

  it('returns no actions when no failed tasks found', async () => {
    vi.mocked(fs).existsSync = vi.fn().mockReturnValue(true)
    vi.mocked(fs).readdirSync = vi.fn().mockReturnValue([])
    const ctx = makeCtx()
    const actions = await failureMinerPlugin.run(ctx)
    expect(actions).toHaveLength(0)
  })

  it('creates actions for detected hotspots', async () => {
    const status = JSON.stringify({
      version: 2,
      taskId: 'task-1',
      state: 'failed',
      cursor: 'build',
      updatedAt: '2026-03-10T00:00:00Z',
      stages: { build: { state: 'failed', error: '' } },
    })
    const status2 = JSON.stringify({
      version: 2,
      taskId: 'task-2',
      state: 'failed',
      cursor: 'build',
      updatedAt: '2026-03-11T00:00:00Z',
      stages: { build: { state: 'failed', error: '' } },
    })

    vi.mocked(fs).existsSync = vi.fn().mockReturnValue(true)
    vi.mocked(fs).readdirSync = vi.fn().mockReturnValue([
      { name: 'task-1', isDirectory: () => true },
      { name: 'task-2', isDirectory: () => true },
    ] as unknown as fs.Dirent[])
    vi.mocked(fs).readFileSync = vi.fn().mockReturnValueOnce(status).mockReturnValueOnce(status2)

    const ctx = makeCtx()
    const actions = await failureMinerPlugin.run(ctx)
    expect(actions.length).toBeGreaterThan(0)
    expect(actions.some((a) => a.type === 'create-improvement-issue')).toBe(true)
  })

  it('has correct schedule (every 6)', () => {
    expect(failureMinerPlugin.schedule?.every).toBe(6)
  })

  it('uses 23h dedup window', async () => {
    const status = JSON.stringify({
      version: 2,
      taskId: 'task-a',
      state: 'failed',
      cursor: 'verify',
      updatedAt: '2026-01-01T00:00:00Z',
      stages: { verify: { state: 'failed', error: '' } },
    })
    const status2 = JSON.stringify({
      version: 2,
      taskId: 'task-b',
      state: 'failed',
      cursor: 'verify',
      updatedAt: '2026-01-02T00:00:00Z',
      stages: { verify: { state: 'failed', error: '' } },
    })

    vi.mocked(fs).existsSync = vi.fn().mockReturnValue(true)
    vi.mocked(fs).readdirSync = vi.fn().mockReturnValue([
      { name: 'task-a', isDirectory: () => true },
      { name: 'task-b', isDirectory: () => true },
    ] as unknown as fs.Dirent[])
    vi.mocked(fs).readFileSync = vi.fn().mockReturnValueOnce(status).mockReturnValueOnce(status2)

    const ctx = makeCtx()
    const actions = await failureMinerPlugin.run(ctx)
    for (const action of actions) {
      expect(action.dedupWindowMinutes).toBe(23 * 60)
    }
  })

  it('execute skips creating issue if one already exists', async () => {
    const status = JSON.stringify({
      version: 2,
      taskId: 'task-x',
      state: 'failed',
      cursor: 'build',
      updatedAt: '2026-03-10T00:00:00Z',
      stages: { build: { state: 'failed', error: '' } },
    })
    const status2 = JSON.stringify({
      version: 2,
      taskId: 'task-y',
      state: 'failed',
      cursor: 'build',
      updatedAt: '2026-03-11T00:00:00Z',
      stages: { build: { state: 'failed', error: '' } },
    })

    vi.mocked(fs).existsSync = vi.fn().mockReturnValue(true)
    vi.mocked(fs).readdirSync = vi.fn().mockReturnValue([
      { name: 'task-x', isDirectory: () => true },
      { name: 'task-y', isDirectory: () => true },
    ] as unknown as fs.Dirent[])
    vi.mocked(fs).readFileSync = vi.fn().mockReturnValueOnce(status).mockReturnValueOnce(status2)

    const existingIssue = {
      number: 77,
      title: 'existing',
      labels: [],
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const ctx = makeCtx({
      github: {
        ...makeCtx().github,
        searchIssues: vi.fn().mockReturnValue([existingIssue]),
        createIssue: vi.fn(),
      } as GitHubClient,
    })

    const actions = await failureMinerPlugin.run(ctx)
    const hotspotAction = actions.find((a) => a.type === 'create-improvement-issue')
    expect(hotspotAction).toBeDefined()

    const result = await hotspotAction!.execute(ctx)
    expect(result.success).toBe(true)
    expect(result.message).toContain('#77')
    expect(ctx.github.createIssue).not.toHaveBeenCalled()
  })
})
