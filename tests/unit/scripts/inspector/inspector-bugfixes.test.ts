/**
 * @fileType test
 * @domain inspector
 * @ai-summary Tests for inspector bug fixes (#2, #4, #5, #6, #7, #10, #11, #12, #13, #15, #16)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import type { InspectorContext, GitHubClient } from '../../../../scripts/inspector/core/types'
import { zombieReaperPlugin } from '../../../../scripts/inspector/plugins/cody/zombie-reaper/index'

// ============================================================================
// Helpers
// ============================================================================

function makeCtx(overrides: Partial<InspectorContext> = {}): InspectorContext {
  const stateStore: Record<string, unknown> = {}
  return {
    repo: 'owner/repo',
    dryRun: false,
    cycleNumber: 6,
    runTimestamp: new Date().toISOString(),
    state: {
      get: vi.fn((key: string) => stateStore[key]) as unknown as <T>(key: string) => T | undefined,
      set: vi.fn((key: string, value: unknown) => {
        stateStore[key] = value
      }),
      save: vi.fn(),
    },
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
      createIssue: vi.fn().mockReturnValue(null),
      searchIssues: vi.fn().mockReturnValue([]),
    } as GitHubClient,
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as InspectorContext['log'],
    slack: {
      postMessage: vi.fn().mockResolvedValue(undefined),
      isConfigured: vi.fn().mockReturnValue(false),
    },
    ...overrides,
  }
}

function makeStaleDateIso(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()
}

function writeStatus(dir: string, data: Record<string, unknown>) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify(data), 'utf-8')
}

// ============================================================================
// Fix #6: Zombie Reaper persists reaped IDs to state store
// ============================================================================

describe('Fix #6: Zombie reaper state persistence', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zombie-fix6-'))
    fs.mkdirSync(path.join(tmpDir, '.tasks'), { recursive: true })
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('persists reaped task IDs to state store after execution', async () => {
    const taskDir = path.join(tmpDir, '.tasks', 'task-persist')
    writeStatus(taskDir, {
      state: 'running',
      updatedAt: makeStaleDateIso(48),
      issueNumber: 100,
    })
    const ctx = makeCtx({
      github: {
        ...makeCtx().github,
        listWorkflowRuns: vi.fn().mockReturnValue([]),
      } as GitHubClient,
    })

    const actions = await zombieReaperPlugin.run(ctx)
    expect(actions).toHaveLength(1)

    await actions[0].execute(ctx)

    // State store should have been called with reaped task IDs
    const setCalls = (ctx.state.set as ReturnType<typeof vi.fn>).mock.calls
    const reapedCall = setCalls.find((call: unknown[]) => call[0] === 'cody:reapedTasks')
    expect(reapedCall).toBeDefined()
    const reapedEntries = reapedCall![1] as Array<{ taskId: string; reapedAt: number }>
    expect(reapedEntries).toHaveLength(1)
    expect(reapedEntries[0].taskId).toBe('task-persist')
    expect(reapedEntries[0].reapedAt).toBeGreaterThan(0)
  })

  it('skips already-reaped tasks from state store', async () => {
    writeStatus(path.join(tmpDir, '.tasks', 'task-already-reaped'), {
      state: 'running',
      updatedAt: makeStaleDateIso(48),
      issueNumber: 101,
    })

    // Pre-populate state store with already-reaped task
    const stateStore: Record<string, unknown> = {
      'cody:reapedTasks': [{ taskId: 'task-already-reaped', reapedAt: Date.now() - 1000 }],
    }
    const ctx = makeCtx({
      state: {
        get: vi.fn((key: string) => stateStore[key]) as unknown as <T>(
          key: string,
        ) => T | undefined,
        set: vi.fn((key: string, value: unknown) => {
          stateStore[key] = value
        }),
        save: vi.fn(),
      },
      github: {
        ...makeCtx().github,
        listWorkflowRuns: vi.fn().mockReturnValue([]),
      } as GitHubClient,
    })

    const actions = await zombieReaperPlugin.run(ctx)
    // Should produce no actions since the task was already reaped
    expect(actions).toHaveLength(0)
  })

  it('does not skip reaped tasks with expired TTL (>7 days)', async () => {
    writeStatus(path.join(tmpDir, '.tasks', 'task-expired-reap'), {
      state: 'running',
      updatedAt: makeStaleDateIso(48),
      issueNumber: 102,
    })

    // Reaped entry expired (8 days ago)
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
    const stateStore: Record<string, unknown> = {
      'cody:reapedTasks': [{ taskId: 'task-expired-reap', reapedAt: eightDaysAgo }],
    }
    const ctx = makeCtx({
      state: {
        get: vi.fn((key: string) => stateStore[key]) as unknown as <T>(
          key: string,
        ) => T | undefined,
        set: vi.fn((key: string, value: unknown) => {
          stateStore[key] = value
        }),
        save: vi.fn(),
      },
      github: {
        ...makeCtx().github,
        listWorkflowRuns: vi.fn().mockReturnValue([]),
      } as GitHubClient,
    })

    const actions = await zombieReaperPlugin.run(ctx)
    // Should detect as zombie since the reaped entry expired
    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('reap-zombies')
  })
})

// ============================================================================
// Fix #12: Pipeline-fixer skips queue-managed tasks
// ============================================================================

describe('Fix #12: Pipeline-fixer skips queue-managed tasks', () => {
  it('should skip failed task when it is the active queue task', async () => {
    const { pipelineFixerPlugin } =
      await import('../../../../scripts/inspector/plugins/cody/pipeline-fixer/index')

    const stateStore: Record<string, unknown> = {
      'cody:evaluatedTasks': [
        {
          health: 'failed',
          taskId: 'queue-task-1',
          issueNumber: 500,
          failedStage: 'build',
          failedError: 'TS error',
          issueTitle: 'Queue task',
          labels: ['cody:queue-active'],
          status: null,
          issueUpdatedAt: new Date().toISOString(),
          statusUpdatedAt: null,
          healthDetail: 'Failed',
        },
      ],
      'queue:state': {
        activeTaskId: 'queue-task-1',
        activeIssueNumber: 500,
        activeStartedAt: new Date().toISOString(),
      },
    }

    const mockCtx = {
      repo: 'test/repo',
      dryRun: false,
      state: {
        get: vi.fn((key: string) => stateStore[key]) as unknown as <T>(
          key: string,
        ) => T | undefined,
        set: vi.fn(),
        save: vi.fn(),
      },
      github: {
        postComment: vi.fn(),
        getIssue: vi.fn().mockReturnValue({ body: 'Test' }),
        getOpenIssues: vi.fn(),
        triggerWorkflow: vi.fn(),
        addLabel: vi.fn(),
        removeLabel: vi.fn(),
        setLifecycleLabel: vi.fn(),
        closeIssue: vi.fn(),
        getIssueComments: vi.fn().mockReturnValue([]),
        createIssue: vi.fn().mockReturnValue(null),
        searchIssues: vi.fn().mockReturnValue([]),
      },
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      runTimestamp: new Date().toISOString(),
      cycleNumber: 1,
    }

    const actions = await pipelineFixerPlugin.run(mockCtx as unknown as InspectorContext)
    // Should produce NO actions since the task is queue-managed
    expect(actions).toHaveLength(0)
  })

  it('should NOT skip failed task when no queue state exists', async () => {
    const { pipelineFixerPlugin } =
      await import('../../../../scripts/inspector/plugins/cody/pipeline-fixer/index')

    const stateStore: Record<string, unknown> = {
      'cody:evaluatedTasks': [
        {
          health: 'failed',
          taskId: 'non-queue-task',
          issueNumber: 501,
          failedStage: 'build',
          failedError: 'TS error',
          issueTitle: 'Non-queue task',
          labels: [],
          status: null,
          issueUpdatedAt: new Date().toISOString(),
          statusUpdatedAt: null,
          healthDetail: 'Failed',
        },
      ],
      // No queue:state
    }

    const mockCtx = {
      repo: 'test/repo',
      dryRun: false,
      state: {
        get: vi.fn((key: string) => stateStore[key]) as unknown as <T>(
          key: string,
        ) => T | undefined,
        set: vi.fn(),
        save: vi.fn(),
      },
      github: {
        postComment: vi.fn(),
        getIssue: vi.fn().mockReturnValue({ body: 'Test' }),
        getOpenIssues: vi.fn(),
        triggerWorkflow: vi.fn(),
        addLabel: vi.fn(),
        removeLabel: vi.fn(),
        setLifecycleLabel: vi.fn(),
        closeIssue: vi.fn(),
        getIssueComments: vi.fn().mockReturnValue([]),
        createIssue: vi.fn().mockReturnValue(null),
        searchIssues: vi.fn().mockReturnValue([]),
      },
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      runTimestamp: new Date().toISOString(),
      cycleNumber: 1,
    }

    const actions = await pipelineFixerPlugin.run(mockCtx as unknown as InspectorContext)
    // Should create action since there's no queue state
    expect(actions).toHaveLength(1)
    expect(actions[0].target).toBe('non-queue-task')
  })

  it('should NOT skip failed task when it is different from active queue task', async () => {
    const { pipelineFixerPlugin } =
      await import('../../../../scripts/inspector/plugins/cody/pipeline-fixer/index')

    const stateStore: Record<string, unknown> = {
      'cody:evaluatedTasks': [
        {
          health: 'failed',
          taskId: 'other-task',
          issueNumber: 502,
          failedStage: 'verify',
          failedError: 'lint error',
          issueTitle: 'Other task',
          labels: [],
          status: null,
          issueUpdatedAt: new Date().toISOString(),
          statusUpdatedAt: null,
          healthDetail: 'Failed',
        },
      ],
      'queue:state': {
        activeTaskId: 'different-task',
        activeIssueNumber: 999,
        activeStartedAt: new Date().toISOString(),
      },
    }

    const mockCtx = {
      repo: 'test/repo',
      dryRun: false,
      state: {
        get: vi.fn((key: string) => stateStore[key]) as unknown as <T>(
          key: string,
        ) => T | undefined,
        set: vi.fn(),
        save: vi.fn(),
      },
      github: {
        postComment: vi.fn(),
        getIssue: vi.fn().mockReturnValue({ body: 'Test' }),
        getOpenIssues: vi.fn(),
        triggerWorkflow: vi.fn(),
        addLabel: vi.fn(),
        removeLabel: vi.fn(),
        setLifecycleLabel: vi.fn(),
        closeIssue: vi.fn(),
        getIssueComments: vi.fn().mockReturnValue([]),
        createIssue: vi.fn().mockReturnValue(null),
        searchIssues: vi.fn().mockReturnValue([]),
      },
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      runTimestamp: new Date().toISOString(),
      cycleNumber: 1,
    }

    const actions = await pipelineFixerPlugin.run(mockCtx as unknown as InspectorContext)
    // Should create action since this task is NOT queue-managed
    expect(actions).toHaveLength(1)
    expect(actions[0].target).toBe('other-task')
  })
})

// ============================================================================
// Fix #4, #5: Health API state parsing
// ============================================================================

describe('Fix #4, #5: Health API getInspectorState', () => {
  it('should parse plain JSON (not base64) from GH variable', async () => {
    const routeContent = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/cody/inspector/health/route.ts'),
      'utf-8',
    )

    expect(routeContent).not.toContain('Buffer.from')
    expect(routeContent).not.toContain("'base64'")
    expect(routeContent).toContain('return JSON.parse(output)')
  })

  it('should use .inspector/state.json path (not .inspector-state.json)', async () => {
    const routeContent = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/cody/inspector/health/route.ts'),
      'utf-8',
    )

    expect(routeContent).toContain('.inspector/state.json')
    expect(routeContent).not.toContain('.inspector-state.json')
  })
})

// ============================================================================
// Fix #2: Plugin order validation
// ============================================================================

describe('Fix #2: Plugin order validation', () => {
  it('should have health-check registered before pipeline-fixer and queue-manager', () => {
    const indexContent = fs.readFileSync(
      path.join(process.cwd(), 'scripts/inspector/index.ts'),
      'utf-8',
    )

    // Verify the order assertion exists
    expect(indexContent).toContain('healthIdx >= fixerIdx')
    expect(indexContent).toContain('healthIdx >= queueIdx')
    expect(indexContent).toContain('Plugin order violation')

    // Verify health-check is registered first
    const healthLine = indexContent.indexOf('registry.register(healthCheckPlugin)')
    const fixerLine = indexContent.indexOf('registry.register(pipelineFixerPlugin)')
    const queueLine = indexContent.indexOf('registry.register(queueManagerPlugin)')

    expect(healthLine).toBeLessThan(fixerLine)
    expect(healthLine).toBeLessThan(queueLine)
  })
})

// ============================================================================
// Fix #7: Registry dead code removed
// ============================================================================

describe('Fix #7: Registry dead code cleanup', () => {
  it('should not expose getScheduled method (scheduling is in inspector core)', async () => {
    const { createPluginRegistry } = await import('../../../../scripts/inspector/plugins/registry')
    const registry = createPluginRegistry()

    expect((registry as unknown as Record<string, unknown>).getScheduled).toBeUndefined()
  })
})

// ============================================================================
// Fix #10, #16: Warning messages
// ============================================================================

describe('Fix #10, #16: Warning messages', () => {
  it('should warn about GH_PAT', () => {
    const indexContent = fs.readFileSync(
      path.join(process.cwd(), 'scripts/inspector/index.ts'),
      'utf-8',
    )
    expect(indexContent).toContain('GH_PAT not set')
    expect(indexContent).toContain('workflow dispatches')
    expect(indexContent).toContain('silently fail')
  })

  it('should have MINIMAX warning mentioning audit', () => {
    const indexContent = fs.readFileSync(
      path.join(process.cwd(), 'scripts/inspector/index.ts'),
      'utf-8',
    )
    expect(indexContent).toContain('MINIMAX_API_KEY not set')
    expect(indexContent).toContain('audit')
  })
})

// ============================================================================
// Fix #11: Git config --local
// ============================================================================

describe('Fix #11: Git config uses --local flag', () => {
  it('should use --local flag in knowledge-gardener git config', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'scripts/inspector/plugins/cody/knowledge-gardener/index.ts'),
      'utf-8',
    )
    expect(content).toContain("'--local', 'user.name'")
    expect(content).toContain("'--local', 'user.email'")
    expect(content).not.toMatch(/'config', 'user\.name'/)
    expect(content).not.toMatch(/'config', 'user\.email'/)
  })
})

// ============================================================================
// Fix #13: Workflow permissions
// ============================================================================

describe('Fix #13: Workflow variables:write permission', () => {
  it('should not include invalid variables: write permission', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), '.github/workflows/inspector.yml'),
      'utf-8',
    )
    expect(content).not.toContain('variables: write')
  })
})

// ============================================================================
// Fix #15: Pipeline retry budget documentation
// ============================================================================

describe('Fix #15: Pipeline retry budget documentation', () => {
  it('should document MAX_RETRIES in pipeline-fixer', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'scripts/inspector/plugins/cody/pipeline-fixer/index.ts'),
      'utf-8',
    )
    expect(content).toContain('MAX_RETRIES')
    expect(content).toContain('5')
  })
})
