import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  InspectorContext,
  EvaluatedTask,
  GitHubClient,
  StateStore,
} from '../../../../scripts/inspector/core/types'
import {
  createNudgeAction,
  createDigestAction,
} from '../../../../scripts/inspector/plugins/cody/health-check/index'

// ============================================================================
// Helpers
// ============================================================================

function createMockContext(overrides?: Partial<InspectorContext>): InspectorContext {
  return {
    repo: 'owner/repo',
    dryRun: false,
    state: {
      get: vi.fn(),
      set: vi.fn(),
      save: vi.fn(),
    } as unknown as StateStore,
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
    taskId: '260312-test-task',
    issueNumber: 42,
    issueTitle: 'Test task',
    labels: ['cody:building'],
    status: null,
    issueUpdatedAt: new Date().toISOString(),
    statusUpdatedAt: null,
    health: 'healthy',
    healthDetail: 'Pipeline running normally',
    ...overrides,
  }
}

// ============================================================================
// createDigestAction
// ============================================================================

describe('createDigestAction', () => {
  let ctx: InspectorContext

  beforeEach(() => {
    ctx = createMockContext()
  })

  it('should return null when ctx.digestIssue is undefined', () => {
    // No digestIssue on context
    const tasks = [createEvaluatedTask({ health: 'failed', healthDetail: 'Pipeline failed' })]

    const action = createDigestAction(tasks, ctx)

    expect(action).toBeNull()
    expect(ctx.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('INSPECTOR_DIGEST_ISSUE not configured'),
    )
  })

  it('should return null when ctx.digestIssue is 0', () => {
    ctx = createMockContext({ digestIssue: 0 })
    const tasks = [createEvaluatedTask({ health: 'failed', healthDetail: 'Pipeline failed' })]

    const action = createDigestAction(tasks, ctx)

    expect(action).toBeNull()
  })

  it('should return action that posts to correct issue number when ctx.digestIssue is set', async () => {
    ctx = createMockContext({ digestIssue: 99 })
    const tasks = [createEvaluatedTask({ health: 'failed', healthDetail: 'Pipeline failed' })]

    const action = createDigestAction(tasks, ctx)

    expect(action).not.toBeNull()
    expect(action!.type).toBe('digest')
    expect(action!.plugin).toBe('cody-health-check')

    // Execute the action and verify postComment is called with correct issue number
    const result = await action!.execute(ctx)
    expect(result.success).toBe(true)
    expect(ctx.github.postComment).toHaveBeenCalledWith(
      99,
      expect.stringContaining('Inspector Digest'),
    )
  })

  it('should return null when all tasks are completed or unknown', () => {
    ctx = createMockContext({ digestIssue: 42 })
    const tasks = [
      createEvaluatedTask({ health: 'completed' }),
      createEvaluatedTask({ health: 'unknown' }),
    ]

    const action = createDigestAction(tasks, ctx)

    expect(action).toBeNull()
  })

  it('should return null when there are no tasks', () => {
    ctx = createMockContext({ digestIssue: 42 })

    const action = createDigestAction([], ctx)

    expect(action).toBeNull()
  })

  it('should include task details in digest table', async () => {
    ctx = createMockContext({ digestIssue: 42 })
    const tasks = [
      createEvaluatedTask({
        taskId: '260312-task-a',
        health: 'failed',
        healthDetail: 'Pipeline failed at build',
      }),
      createEvaluatedTask({
        taskId: '260312-task-b',
        health: 'gated',
        healthDetail: 'Pipeline paused at review',
      }),
    ]

    const action = createDigestAction(tasks, ctx)
    expect(action).not.toBeNull()

    await action!.execute(ctx)

    const body = (ctx.github.postComment as ReturnType<typeof vi.fn>).mock.calls[0][1] as string
    expect(body).toContain('260312-task-a')
    expect(body).toContain('260312-task-b')
    expect(body).toContain('🔴 failed')
    expect(body).toContain('🟠 gated')
  })
})

// ============================================================================
// createNudgeAction
// ============================================================================

describe('createNudgeAction', () => {
  let ctx: InspectorContext

  beforeEach(() => {
    ctx = createMockContext()
  })

  it('should return null when task.issueNumber is 0', () => {
    const task = createEvaluatedTask({
      health: 'gated',
      gatedMinutes: 60,
      issueNumber: 0,
    })

    const action = createNudgeAction(task, ctx)

    expect(action).toBeNull()
  })

  it('should return null when task.issueNumber is negative', () => {
    const task = createEvaluatedTask({
      health: 'gated',
      gatedMinutes: 60,
      issueNumber: -1,
    })

    const action = createNudgeAction(task, ctx)

    expect(action).toBeNull()
  })

  it('should return null when task health is not gated', () => {
    const task = createEvaluatedTask({
      health: 'healthy',
      issueNumber: 42,
    })

    const action = createNudgeAction(task, ctx)

    expect(action).toBeNull()
  })

  it('should return null when gated for less than 30 minutes', () => {
    const task = createEvaluatedTask({
      health: 'gated',
      gatedMinutes: 15,
      issueNumber: 42,
    })

    const action = createNudgeAction(task, ctx)

    expect(action).toBeNull()
  })

  it('should return action for valid gated task with issueNumber', async () => {
    const task = createEvaluatedTask({
      health: 'gated',
      gatedMinutes: 60,
      issueNumber: 123,
      taskId: '260312-gated-task',
    })

    const action = createNudgeAction(task, ctx)

    expect(action).not.toBeNull()
    expect(action!.type).toBe('nudge')
    expect(action!.urgency).toBe('warning')
    expect(action!.target).toBe('260312-gated-task')

    // Execute and verify postComment is called with the correct issue number
    const result = await action!.execute(ctx)
    expect(result.success).toBe(true)
    expect(ctx.github.postComment).toHaveBeenCalledWith(
      123,
      expect.stringContaining('Gate Approval Needed'),
    )
  })

  it('should set critical urgency when gated for more than 120 minutes', () => {
    const task = createEvaluatedTask({
      health: 'gated',
      gatedMinutes: 150,
      issueNumber: 42,
    })

    const action = createNudgeAction(task, ctx)

    expect(action).not.toBeNull()
    expect(action!.urgency).toBe('critical')
  })
})
