import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock all external dependencies before importing
vi.mock('pino', () => ({
  default: vi.fn().mockReturnValue({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}))

vi.mock('../../../../scripts/inspector/core/state', () => ({
  JsonStateStore: {
    load: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(0),
      set: vi.fn(),
      save: vi.fn(),
    }),
  },
}))

vi.mock('../../../../scripts/inspector/clients/github', () => ({
  createGitHubClient: vi.fn().mockReturnValue({
    postComment: vi.fn(),
    getIssue: vi.fn().mockReturnValue({ body: null, title: null }),
    getOpenIssues: vi.fn().mockReturnValue([]),
    triggerWorkflow: vi.fn(),
    addLabel: vi.fn(),
    removeLabel: vi.fn(),
    setLifecycleLabel: vi.fn(),
    closeIssue: vi.fn(),
    getIssueComments: vi.fn().mockReturnValue([]),
  }),
}))

vi.mock('../../../../scripts/inspector/clients/slack', () => ({
  createSlackClient: vi.fn().mockReturnValue(undefined),
}))

vi.mock('../../../../scripts/inspector/core/dedup', () => ({
  shouldDedup: vi.fn().mockReturnValue(false),
  markExecuted: vi.fn(),
  cleanupExpiredDedup: vi.fn().mockReturnValue(0),
}))

import { runInspector } from '../../../../scripts/inspector/core/inspector'
import type {
  InspectorConfig,
  InspectorContext,
  InspectorPlugin,
} from '../../../../scripts/inspector/core/types'

describe('runInspector', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      GH_TOKEN: 'fake-token',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should include watchdogIssue on context when configured', async () => {
    let capturedCtx: InspectorContext | undefined

    const spyPlugin: InspectorPlugin = {
      name: 'spy-plugin',
      description: 'Captures context for testing',
      domain: 'test',
      async run(ctx) {
        capturedCtx = ctx
        return []
      },
    }

    const config: InspectorConfig = {
      repo: 'owner/repo',
      dryRun: false,
      stateFile: '/tmp/test-state.json',
      plugins: [spyPlugin],
      watchdogIssue: 42,
    }

    await runInspector(config)

    expect(capturedCtx).toBeDefined()
    expect(capturedCtx!.watchdogIssue).toBe(42)
  })

  it('should have watchdogIssue undefined on context when not configured', async () => {
    let capturedCtx: InspectorContext | undefined

    const spyPlugin: InspectorPlugin = {
      name: 'spy-plugin',
      description: 'Captures context for testing',
      domain: 'test',
      async run(ctx) {
        capturedCtx = ctx
        return []
      },
    }

    const config: InspectorConfig = {
      repo: 'owner/repo',
      dryRun: false,
      stateFile: '/tmp/test-state.json',
      plugins: [spyPlugin],
      // No watchdogIssue
    }

    await runInspector(config)

    expect(capturedCtx).toBeDefined()
    expect(capturedCtx!.watchdogIssue).toBeUndefined()
  })

  it('should return correct result summary', async () => {
    const config: InspectorConfig = {
      repo: 'owner/repo',
      dryRun: false,
      stateFile: '/tmp/test-state.json',
      plugins: [],
      watchdogIssue: 42,
    }

    const result = await runInspector(config)

    expect(result.cycleNumber).toBe(1)
    expect(result.pluginsRun).toBe(0)
    expect(result.actionsProduced).toBe(0)
    expect(result.actionsExecuted).toBe(0)
    expect(result.actionsDeduplicated).toBe(0)
    expect(result.errors).toEqual([])
  })

  it('should isolate plugin errors without crashing', async () => {
    const failingPlugin: InspectorPlugin = {
      name: 'failing-plugin',
      description: 'Always throws',
      domain: 'test',
      async run() {
        throw new Error('Plugin exploded')
      },
    }

    const config: InspectorConfig = {
      repo: 'owner/repo',
      dryRun: false,
      stateFile: '/tmp/test-state.json',
      plugins: [failingPlugin],
    }

    const result = await runInspector(config)

    expect(result.pluginsRun).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Plugin exploded')
  })

  it('should skip action execution in dry run mode', async () => {
    const executeAction = vi.fn().mockResolvedValue({ success: true })

    const actionPlugin: InspectorPlugin = {
      name: 'action-plugin',
      description: 'Returns an action',
      domain: 'test',
      async run() {
        return [
          {
            plugin: 'action-plugin',
            type: 'test-action',
            urgency: 'info' as const,
            title: 'Test action',
            detail: 'Test detail',
            execute: executeAction,
          },
        ]
      },
    }

    const config: InspectorConfig = {
      repo: 'owner/repo',
      dryRun: true,
      stateFile: '/tmp/test-state.json',
      plugins: [actionPlugin],
    }

    const result = await runInspector(config)

    expect(result.actionsProduced).toBe(1)
    expect(result.actionsExecuted).toBe(0)
    expect(executeAction).not.toHaveBeenCalled()
  })
})
