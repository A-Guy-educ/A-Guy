import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  InspectorContext,
  EvaluatedTask,
  GitHubClient,
  StateStore,
  IssueInfo,
} from '../../../../scripts/inspector/core/types'
import {
  getQueueState,
  saveQueueState,
  getQueuedTasks,
  getActiveTask,
  activateTask,
  completeTask,
  failTask,
  cleanTaskState,
} from '../../../../scripts/inspector/plugins/cody/queue-manager/queue-state'
import {
  DEFAULT_QUEUE_STATE,
  QUEUE_LABELS,
} from '../../../../scripts/inspector/plugins/cody/queue-manager/types'
import type {
  QueueState,
  QueuedTask,
} from '../../../../scripts/inspector/plugins/cody/queue-manager/types'
import { queueManagerPlugin } from '../../../../scripts/inspector/plugins/cody/queue-manager/index'

// ============================================================================
// Helpers
// ============================================================================

function createMockContext(overrides?: Partial<InspectorContext>): InspectorContext {
  const stateStore: Record<string, unknown> = {}

  return {
    repo: 'owner/repo',
    dryRun: false,
    state: {
      get: vi.fn((key: string) => stateStore[key]),
      set: vi.fn((key: string, value: unknown) => {
        stateStore[key] = value
      }),
      save: vi.fn(),
    } as unknown as StateStore,
    github: {
      postComment: vi.fn(),
      getIssue: vi.fn().mockReturnValue({ body: 'Test requirement body', title: 'Test issue' }),
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
    } as unknown as GitHubClient,
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as InspectorContext['log'],
    runTimestamp: new Date().toISOString(),
    cycleNumber: 1,
    ...overrides,
  }
}

function createEvaluatedTask(overrides?: Partial<EvaluatedTask>): EvaluatedTask {
  return {
    taskId: 'issue-42',
    issueNumber: 42,
    issueTitle: 'Test task',
    labels: ['cody:queue-active'],
    status: null,
    issueUpdatedAt: new Date().toISOString(),
    statusUpdatedAt: null,
    health: 'healthy',
    healthDetail: 'Pipeline running normally',
    ...overrides,
  }
}

function createQueuedTask(overrides?: Partial<QueuedTask>): QueuedTask {
  return {
    issueNumber: 42,
    title: 'Test task',
    labels: ['cody:queued'],
    updatedAt: new Date().toISOString(),
    taskId: 'issue-42',
    ...overrides,
  }
}

function createIssueInfo(overrides?: Partial<IssueInfo>): IssueInfo {
  return {
    number: 42,
    title: 'Test task',
    labels: ['cody:queued'],
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ============================================================================
// Queue State Helpers
// ============================================================================

describe('queue-state helpers', () => {
  let ctx: InspectorContext

  beforeEach(() => {
    ctx = createMockContext()
  })

  it('getQueueState returns defaults when state is empty', () => {
    const state = getQueueState(ctx)
    expect(state).toEqual(DEFAULT_QUEUE_STATE)
  })

  it('getQueueState returns stored state', () => {
    const stored: QueueState = {
      activeTaskId: 'issue-10',
      activeIssueNumber: 10,
      activeStartedAt: '2026-01-01T00:00:00Z',
    }
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockReturnValue(stored)

    const state = getQueueState(ctx)
    expect(state).toEqual(stored)
  })

  it('saveQueueState writes to state store', () => {
    const state: QueueState = {
      ...DEFAULT_QUEUE_STATE,
      activeTaskId: 'issue-5',
    }
    saveQueueState(ctx, state)
    expect(ctx.state.set).toHaveBeenCalledWith('queue:state', state)
  })

  it('getQueuedTasks returns tasks sorted by updatedAt ascending (FIFO)', () => {
    const issues: IssueInfo[] = [
      createIssueInfo({ number: 3, updatedAt: '2026-03-15T10:00:00Z' }),
      createIssueInfo({ number: 1, updatedAt: '2026-03-15T08:00:00Z' }),
      createIssueInfo({ number: 2, updatedAt: '2026-03-15T09:00:00Z' }),
    ]
    ;(ctx.github.getOpenIssues as ReturnType<typeof vi.fn>).mockReturnValue(issues)

    const tasks = getQueuedTasks(ctx)

    expect(tasks.map((t) => t.issueNumber)).toEqual([1, 2, 3])
    expect(ctx.github.getOpenIssues).toHaveBeenCalledWith([QUEUE_LABELS.QUEUED])
  })

  it('getActiveTask returns first active task', () => {
    const issues: IssueInfo[] = [createIssueInfo({ number: 42, labels: ['cody:queue-active'] })]
    ;(ctx.github.getOpenIssues as ReturnType<typeof vi.fn>).mockReturnValue(issues)

    const task = getActiveTask(ctx)

    expect(task).not.toBeNull()
    expect(task?.issueNumber).toBe(42)
    expect(ctx.github.getOpenIssues).toHaveBeenCalledWith([QUEUE_LABELS.ACTIVE])
  })

  it('getActiveTask returns null when no active task', () => {
    ;(ctx.github.getOpenIssues as ReturnType<typeof vi.fn>).mockReturnValue([])

    const task = getActiveTask(ctx)

    expect(task).toBeNull()
  })

  it('activateTask swaps labels correctly', () => {
    const task = createQueuedTask({ issueNumber: 42 })

    activateTask(ctx, task)

    expect(ctx.github.removeLabel).toHaveBeenCalledWith(42, QUEUE_LABELS.QUEUED)
    expect(ctx.github.addLabel).toHaveBeenCalledWith(42, QUEUE_LABELS.ACTIVE)
  })

  it('completeTask removes active label', () => {
    const task = createQueuedTask({ issueNumber: 42 })

    completeTask(ctx, task)

    expect(ctx.github.removeLabel).toHaveBeenCalledWith(42, QUEUE_LABELS.ACTIVE)
  })

  it('failTask swaps to failed label', () => {
    const task = createQueuedTask({ issueNumber: 42 })

    failTask(ctx, task)

    expect(ctx.github.removeLabel).toHaveBeenCalledWith(42, QUEUE_LABELS.ACTIVE)
    expect(ctx.github.addLabel).toHaveBeenCalledWith(42, QUEUE_LABELS.FAILED)
  })

  it('cleanTaskState clears active fields', () => {
    const state: QueueState = {
      activeTaskId: 'issue-42',
      activeIssueNumber: 42,
      activeStartedAt: '2026-01-01T00:00:00Z',
    }

    const cleaned = cleanTaskState(state, 'issue-42')

    expect(cleaned.activeTaskId).toBeNull()
    expect(cleaned.activeIssueNumber).toBeNull()
    expect(cleaned.activeStartedAt).toBeNull()
  })
})

// ============================================================================
// Main Plugin
// ============================================================================

describe('cody-queue-manager plugin', () => {
  let ctx: InspectorContext

  beforeEach(() => {
    ctx = createMockContext()
  })

  it('returns no actions when queue is empty and no active task', async () => {
    ;(ctx.github.getOpenIssues as ReturnType<typeof vi.fn>).mockReturnValue([])

    const actions = await queueManagerPlugin.run(ctx)

    expect(actions).toEqual([])
  })

  it('activates first task when queue has tasks and no active task', async () => {
    const getOpenIssuesFn = ctx.github.getOpenIssues as ReturnType<typeof vi.fn>
    getOpenIssuesFn
      .mockReturnValueOnce([]) // getActiveTask — no active
      .mockReturnValueOnce([
        createIssueInfo({ number: 10, updatedAt: '2026-03-15T08:00:00Z' }),
        createIssueInfo({ number: 20, updatedAt: '2026-03-15T09:00:00Z' }),
      ]) // getQueuedTasks

    const actions = await queueManagerPlugin.run(ctx)

    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('activate-task')
    expect(actions[0].target).toBe('issue-10')
  })

  it('returns no actions when active task is healthy', async () => {
    ;(ctx.github.getOpenIssues as ReturnType<typeof vi.fn>).mockReturnValue([
      createIssueInfo({ number: 42, labels: ['cody:queue-active'] }),
    ])
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') {
        return [createEvaluatedTask({ health: 'healthy' })]
      }
      if (key === 'queue:state') {
        return {
          ...DEFAULT_QUEUE_STATE,
          activeTaskId: 'issue-42',
          activeIssueNumber: 42,
          activeStartedAt: new Date().toISOString(),
        }
      }
      return undefined
    })

    const actions = await queueManagerPlugin.run(ctx)

    expect(actions).toEqual([])
  })

  it('creates fail-and-advance action when active task failed', async () => {
    ;(ctx.github.getOpenIssues as ReturnType<typeof vi.fn>).mockReturnValue([
      createIssueInfo({ number: 42, labels: ['cody:queue-active'] }),
    ])
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') {
        return [
          createEvaluatedTask({
            health: 'failed',
            failedStage: 'build',
            failedError: 'TypeScript error',
          }),
        ]
      }
      if (key === 'queue:state') {
        return {
          ...DEFAULT_QUEUE_STATE,
          activeTaskId: 'issue-42',
          activeIssueNumber: 42,
          activeStartedAt: new Date().toISOString(),
        }
      }
      return undefined
    })

    const actions = await queueManagerPlugin.run(ctx)

    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('fail-and-advance')
    expect(actions[0].urgency).toBe('warning')
  })

  it('creates complete action and advances when active task completed', async () => {
    ;(ctx.github.getOpenIssues as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      createIssueInfo({ number: 42, labels: ['cody:queue-active'] }),
    ])
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') {
        return [createEvaluatedTask({ health: 'completed' })]
      }
      if (key === 'queue:state') {
        return {
          ...DEFAULT_QUEUE_STATE,
          activeTaskId: 'issue-42',
          activeIssueNumber: 42,
          activeStartedAt: new Date().toISOString(),
        }
      }
      return undefined
    })

    const actions = await queueManagerPlugin.run(ctx)

    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('complete-task')
  })

  it('treats orphaned tasks as failed', async () => {
    ;(ctx.github.getOpenIssues as ReturnType<typeof vi.fn>).mockReturnValue([
      createIssueInfo({ number: 42, labels: ['cody:queue-active'] }),
    ])
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') {
        return [
          createEvaluatedTask({
            health: 'orphaned',
            healthDetail: 'No workflow run found',
          }),
        ]
      }
      if (key === 'queue:state') {
        return {
          ...DEFAULT_QUEUE_STATE,
          activeTaskId: 'issue-42',
          activeIssueNumber: 42,
          activeStartedAt: new Date().toISOString(),
        }
      }
      return undefined
    })

    const actions = await queueManagerPlugin.run(ctx)

    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('fail-and-advance')
  })

  it('waits during startup grace period for unknown health', async () => {
    ;(ctx.github.getOpenIssues as ReturnType<typeof vi.fn>).mockReturnValue([
      createIssueInfo({ number: 42, labels: ['cody:queue-active'] }),
    ])

    const recentStart = new Date().toISOString()

    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') {
        return [createEvaluatedTask({ health: 'unknown' })]
      }
      if (key === 'queue:state') {
        return {
          ...DEFAULT_QUEUE_STATE,
          activeTaskId: 'issue-42',
          activeIssueNumber: 42,
          activeStartedAt: recentStart,
        }
      }
      return undefined
    })

    const actions = await queueManagerPlugin.run(ctx)

    expect(actions).toEqual([])
  })

  it('treats unknown health as failed after grace period', async () => {
    ;(ctx.github.getOpenIssues as ReturnType<typeof vi.fn>).mockReturnValue([
      createIssueInfo({ number: 42, labels: ['cody:queue-active'] }),
    ])

    const staleStart = new Date(Date.now() - 15 * 60 * 1000).toISOString()

    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') {
        return [createEvaluatedTask({ health: 'unknown' })]
      }
      if (key === 'queue:state') {
        return {
          ...DEFAULT_QUEUE_STATE,
          activeTaskId: 'issue-42',
          activeIssueNumber: 42,
          activeStartedAt: staleStart,
        }
      }
      return undefined
    })

    const actions = await queueManagerPlugin.run(ctx)

    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('fail-and-advance')
  })

  it('waits for gated tasks (no gate handling)', async () => {
    ;(ctx.github.getOpenIssues as ReturnType<typeof vi.fn>).mockReturnValue([
      createIssueInfo({ number: 42, labels: ['cody:queue-active'] }),
    ])
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') {
        return [createEvaluatedTask({ health: 'gated', healthDetail: 'Waiting for approval' })]
      }
      if (key === 'queue:state') {
        return {
          ...DEFAULT_QUEUE_STATE,
          activeTaskId: 'issue-42',
          activeIssueNumber: 42,
          activeStartedAt: new Date().toISOString(),
        }
      }
      return undefined
    })

    const actions = await queueManagerPlugin.run(ctx)

    // No gate-review action — just waits
    expect(actions).toEqual([])
  })

  it('has correct plugin metadata', () => {
    expect(queueManagerPlugin.name).toBe('cody-queue-manager')
    expect(queueManagerPlugin.domain).toBe('cody')
    expect(typeof queueManagerPlugin.run).toBe('function')
  })
})

// ============================================================================
// Action Execution
// ============================================================================

describe('action execution', () => {
  let ctx: InspectorContext

  beforeEach(() => {
    ctx = createMockContext()
  })

  it('activate action triggers workflow and posts comment', async () => {
    const getOpenIssuesFn = ctx.github.getOpenIssues as ReturnType<typeof vi.fn>
    getOpenIssuesFn
      .mockReturnValueOnce([]) // getActiveTask — no active
      .mockReturnValueOnce([createIssueInfo({ number: 10, updatedAt: '2026-03-15T08:00:00Z' })])

    const actions = await queueManagerPlugin.run(ctx)
    expect(actions).toHaveLength(1)

    const result = await actions[0].execute(ctx)

    expect(result.success).toBe(true)
    expect(ctx.github.removeLabel).toHaveBeenCalledWith(10, QUEUE_LABELS.QUEUED)
    expect(ctx.github.addLabel).toHaveBeenCalledWith(10, QUEUE_LABELS.ACTIVE)
    expect(ctx.github.triggerWorkflow).toHaveBeenCalledWith('cody.yml', {
      issue_number: '10',
      task_id: 'issue-10',
      mode: 'full',
    })
    expect(ctx.github.postComment).toHaveBeenCalled()
  })

  it('complete action removes active label and advances queue', async () => {
    ;(ctx.github.getOpenIssues as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      createIssueInfo({ number: 42, labels: ['cody:queue-active'] }),
    ])
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') {
        return [createEvaluatedTask({ health: 'completed' })]
      }
      if (key === 'queue:state') {
        return {
          ...DEFAULT_QUEUE_STATE,
          activeTaskId: 'issue-42',
          activeIssueNumber: 42,
          activeStartedAt: new Date().toISOString(),
        }
      }
      return undefined
    })

    const actions = await queueManagerPlugin.run(ctx)
    expect(actions).toHaveLength(1)

    // For the execute callback: setup getQueuedTasks to return a next task
    ;(ctx.github.getOpenIssues as ReturnType<typeof vi.fn>).mockReturnValue([
      createIssueInfo({ number: 50, labels: ['cody:queued'], updatedAt: '2026-03-15T08:00:00Z' }),
    ])

    const result = await actions[0].execute(ctx)

    expect(result.success).toBe(true)
    expect(ctx.github.removeLabel).toHaveBeenCalledWith(42, QUEUE_LABELS.ACTIVE)
    expect(ctx.github.triggerWorkflow).toHaveBeenCalledWith('cody.yml', {
      issue_number: '50',
      task_id: 'issue-50',
      mode: 'full',
    })
  })

  it('fail-and-advance action marks task failed and advances', async () => {
    ;(ctx.github.getOpenIssues as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      createIssueInfo({ number: 42, labels: ['cody:queue-active'] }),
    ])
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') {
        return [
          createEvaluatedTask({
            health: 'failed',
            failedStage: 'build',
            failedError: 'Some error',
          }),
        ]
      }
      if (key === 'queue:state') {
        return {
          ...DEFAULT_QUEUE_STATE,
          activeTaskId: 'issue-42',
          activeIssueNumber: 42,
          activeStartedAt: new Date().toISOString(),
        }
      }
      return undefined
    })

    const actions = await queueManagerPlugin.run(ctx)
    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('fail-and-advance')

    // Setup next task for advancement
    ;(ctx.github.getOpenIssues as ReturnType<typeof vi.fn>).mockReturnValue([
      createIssueInfo({ number: 50, labels: ['cody:queued'], updatedAt: '2026-03-15T08:00:00Z' }),
    ])

    const result = await actions[0].execute(ctx)
    expect(result.success).toBe(true)
    expect(ctx.github.removeLabel).toHaveBeenCalledWith(42, QUEUE_LABELS.ACTIVE)
    expect(ctx.github.addLabel).toHaveBeenCalledWith(42, QUEUE_LABELS.FAILED)
    expect(ctx.github.postComment).toHaveBeenCalledWith(
      42,
      expect.stringContaining('pipeline-fixer'),
    )
  })
})
