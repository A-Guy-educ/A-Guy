/**
 * @fileType test
 * @domain inspector
 * @ai-summary Tests for the pipeline-fixer plugin: retry logic, fix-issue creation, give up, non-retryable
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  InspectorContext,
  EvaluatedTask,
  GitHubClient,
  StateStore,
} from '../../../../scripts/inspector/core/types'
import { pipelineFixerPlugin } from '../../../../scripts/inspector/plugins/cody/pipeline-fixer/index'

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
      createIssue: vi.fn().mockReturnValue(999),
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

function createFailedTask(overrides?: Partial<EvaluatedTask>): EvaluatedTask {
  return {
    taskId: '260316-auto-648',
    issueNumber: 822,
    issueTitle: 'QA Implementation Plan',
    labels: ['cody:failed'],
    status: null,
    issueUpdatedAt: new Date().toISOString(),
    statusUpdatedAt: null,
    health: 'failed',
    healthDetail: 'Pipeline failed at stage: build',
    failedStage: 'build',
    failedError: 'Agent "build" failed. Artifacts: build-stderr.log',
    ...overrides,
  }
}

// ============================================================================
// Plugin metadata
// ============================================================================

describe('pipelineFixerPlugin', () => {
  it('should have correct plugin metadata', () => {
    expect(pipelineFixerPlugin.name).toBe('cody-pipeline-fixer')
    expect(pipelineFixerPlugin.domain).toBe('cody')
    expect(typeof pipelineFixerPlugin.run).toBe('function')
  })
})

// ============================================================================
// No failed tasks
// ============================================================================

describe('no failed tasks', () => {
  it('should return no actions when no failed tasks', async () => {
    const ctx = createMockContext()
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') {
        return [
          { ...createFailedTask(), health: 'healthy', healthDetail: 'Running normally' },
          { ...createFailedTask(), health: 'completed', healthDetail: 'Done' },
        ]
      }
      return undefined
    })

    const actions = await pipelineFixerPlugin.run(ctx)
    expect(actions).toHaveLength(0)
  })

  it('should return no actions when evaluatedTasks is empty', async () => {
    const ctx = createMockContext()
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockReturnValue([])

    const actions = await pipelineFixerPlugin.run(ctx)
    expect(actions).toHaveLength(0)
  })
})

// ============================================================================
// Retry logic
// ============================================================================

describe('retry actions', () => {
  let ctx: InspectorContext

  beforeEach(() => {
    ctx = createMockContext()
  })

  it('should create retry action on first failure (retries=0)', async () => {
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') return [createFailedTask()]
      if (key === 'cody:fixerState') return {}
      return undefined
    })

    const actions = await pipelineFixerPlugin.run(ctx)

    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('retry')
    expect(actions[0].target).toBe('260316-auto-648')
    expect(actions[0].urgency).toBe('critical')

    // Execute the action
    const result = await actions[0].execute(ctx)
    expect(result.success).toBe(true)
    expect(ctx.github.triggerWorkflow).toHaveBeenCalledWith('cody.yml', {
      task_id: '260316-auto-648',
      mode: 'rerun',
      from_stage: 'build',
      issue_number: '822',
      feedback: expect.any(String),
    })
    expect(ctx.github.postComment).toHaveBeenCalledWith(822, expect.stringContaining('retry 1/5'))
  })

  it('should create retry action on second failure (retries=1)', async () => {
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') return [createFailedTask()]
      if (key === 'cody:fixerState') {
        return {
          '260316-auto-648': {
            retries: 1,
            errorSignature: 'build:Agent "build" failed. Artifacts: build-stderr.log',
            fixIssueNumber: null,
            fixIssueCreatedAt: null,
          },
        }
      }
      return undefined
    })

    const actions = await pipelineFixerPlugin.run(ctx)

    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('retry')

    const result = await actions[0].execute(ctx)
    expect(result.success).toBe(true)
    expect(ctx.github.postComment).toHaveBeenCalledWith(822, expect.stringContaining('retry 2/5'))
  })
})

// ============================================================================
// Fix-issue creation
// ============================================================================

describe('fix-issue creation', () => {
  let ctx: InspectorContext

  beforeEach(() => {
    ctx = createMockContext()
  })

  it('should create fix-issue when same error repeats at retry 2', async () => {
    const signature = 'build:Agent "build" failed. Artifacts: build-stderr.log'
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') return [createFailedTask()]
      if (key === 'cody:fixerState') {
        return {
          '260316-auto-648': {
            retries: 2,
            errorSignature: signature,
            fixIssueNumber: null,
            fixIssueCreatedAt: null,
          },
        }
      }
      return undefined
    })

    const actions = await pipelineFixerPlugin.run(ctx)

    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('create-fix-issue')

    const result = await actions[0].execute(ctx)
    expect(result.success).toBe(true)
    expect(ctx.github.createIssue).toHaveBeenCalledWith(
      expect.stringContaining('[pipeline-fix]'),
      expect.stringContaining('260316-auto-648'),
      ['cody:pipeline-fix'],
    )
    // Should trigger @cody on the fix issue
    expect(ctx.github.postComment).toHaveBeenCalledWith(999, '@cody')
    // Should notify original issue
    expect(ctx.github.postComment).toHaveBeenCalledWith(822, expect.stringContaining('#999'))
  })

  it('should retry (not create fix-issue) when error signature changes at retry 2', async () => {
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') return [createFailedTask()]
      if (key === 'cody:fixerState') {
        return {
          '260316-auto-648': {
            retries: 2,
            errorSignature: 'verify:TypeScript error TS2345', // different error
            fixIssueNumber: null,
            fixIssueCreatedAt: null,
          },
        }
      }
      return undefined
    })

    const actions = await pipelineFixerPlugin.run(ctx)

    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('retry') // NOT create-fix-issue
  })
})

// ============================================================================
// Post-fix retries
// ============================================================================

describe('post-fix retries', () => {
  it('should create retry action after fix issue (retries 3-4)', async () => {
    const ctx = createMockContext()
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') return [createFailedTask()]
      if (key === 'cody:fixerState') {
        return {
          '260316-auto-648': {
            retries: 3,
            errorSignature: 'build:Agent "build" failed.',
            fixIssueNumber: 999,
            fixIssueCreatedAt: '2026-03-16T18:00:00Z',
          },
        }
      }
      return undefined
    })

    const actions = await pipelineFixerPlugin.run(ctx)

    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('retry')

    const result = await actions[0].execute(ctx)
    expect(result.success).toBe(true)
    expect(ctx.github.postComment).toHaveBeenCalledWith(
      822,
      expect.stringContaining('fix issue #999'),
    )
  })
})

// ============================================================================
// Give up
// ============================================================================

describe('give up', () => {
  it('should give up after 5 retries', async () => {
    const ctx = createMockContext()
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') return [createFailedTask()]
      if (key === 'cody:fixerState') {
        return {
          '260316-auto-648': {
            retries: 5,
            errorSignature: 'build:Agent "build" failed.',
            fixIssueNumber: 999,
            fixIssueCreatedAt: '2026-03-16T18:00:00Z',
          },
        }
      }
      return undefined
    })

    const actions = await pipelineFixerPlugin.run(ctx)

    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('give-up')

    const result = await actions[0].execute(ctx)
    expect(result.success).toBe(true)
    expect(ctx.github.postComment).toHaveBeenCalledWith(
      822,
      expect.stringContaining('Manual intervention required'),
    )
  })
})

// ============================================================================
// Non-retryable
// ============================================================================

describe('non-retryable failures', () => {
  it('should skip non-retryable infrastructure errors', async () => {
    const ctx = createMockContext()
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') {
        return [createFailedTask({ failedError: 'MINIMAX_API_KEY is not set' })]
      }
      if (key === 'cody:fixerState') return {}
      return undefined
    })

    const actions = await pipelineFixerPlugin.run(ctx)

    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('non-retryable')

    const result = await actions[0].execute(ctx)
    expect(result.success).toBe(true)
    expect(ctx.github.postComment).toHaveBeenCalledWith(
      822,
      expect.stringContaining('Non-retryable'),
    )
    // Should NOT trigger a workflow
    expect(ctx.github.triggerWorkflow).not.toHaveBeenCalled()
  })
})

// ============================================================================
// Queue-managed tasks
// ============================================================================

describe('queue-managed tasks', () => {
  it('should skip queue-managed active tasks', async () => {
    const ctx = createMockContext()
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') {
        return [createFailedTask({ taskId: 'issue-42' })]
      }
      if (key === 'cody:fixerState') return {}
      if (key === 'queue:state') {
        return {
          activeTaskId: 'issue-42',
          activeIssueNumber: 42,
          activeStartedAt: new Date().toISOString(),
        }
      }
      return undefined
    })

    const actions = await pipelineFixerPlugin.run(ctx)
    expect(actions).toHaveLength(0)
  })
})

// ============================================================================
// Dedup key
// ============================================================================

describe('dedup', () => {
  it('should use correct dedupKey format', async () => {
    const ctx = createMockContext()
    ;(ctx.state.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'cody:evaluatedTasks') return [createFailedTask()]
      if (key === 'cody:fixerState') return {}
      return undefined
    })

    const actions = await pipelineFixerPlugin.run(ctx)

    expect(actions).toHaveLength(1)
    expect(actions[0].dedupKey).toBe('pipeline-fixer:260316-auto-648')
    expect(actions[0].dedupWindowMinutes).toBe(15)
  })
})
