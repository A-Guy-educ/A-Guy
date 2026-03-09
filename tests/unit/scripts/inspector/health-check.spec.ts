/**
 * @fileType test
 * @domain inspector
 * @ai-summary Tests for the health-check plugin: health evaluation, orphan detection, state sharing
 */

import { describe, it, expect, vi } from 'vitest'
import type { InspectorContext } from '../../../../scripts/inspector/core/types'

describe('healthCheckPlugin', () => {
  it('should export a valid InspectorPlugin', async () => {
    const { healthCheckPlugin } =
      await import('../../../../scripts/inspector/plugins/cody/health-check/index')

    expect(healthCheckPlugin.name).toBe('cody-health-check')
    expect(healthCheckPlugin.domain).toBe('cody')
    expect(typeof healthCheckPlugin.run).toBe('function')
  })

  it('should share evaluated tasks via state for failure-analysis', async () => {
    const { healthCheckPlugin } =
      await import('../../../../scripts/inspector/plugins/cody/health-check/index')

    const mockState = {
      get: vi.fn(),
      set: vi.fn(),
      save: vi.fn(),
    }

    const mockCtx = {
      repo: 'test/repo',
      dryRun: false,
      state: mockState,
      github: {
        postComment: vi.fn(),
        getIssue: vi.fn(),
        getOpenIssues: vi.fn().mockReturnValue([]),
        triggerWorkflow: vi.fn(),
        addLabel: vi.fn(),
        removeLabel: vi.fn(),
        setLifecycleLabel: vi.fn(),
        closeIssue: vi.fn(),
        getIssueComments: vi.fn().mockReturnValue([]),
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

    await healthCheckPlugin.run(mockCtx as unknown as InspectorContext)

    // Health check should set evaluated tasks in state
    expect(mockState.set).toHaveBeenCalledWith('cody:evaluatedTasks', expect.any(Array))
  })

  it('should NOT produce retry actions (delegated to failure-analysis)', async () => {
    const { healthCheckPlugin } =
      await import('../../../../scripts/inspector/plugins/cody/health-check/index')

    const mockCtx = {
      repo: 'test/repo',
      dryRun: false,
      state: {
        get: vi.fn(),
        set: vi.fn(),
        save: vi.fn(),
      },
      github: {
        postComment: vi.fn(),
        getIssue: vi.fn(),
        getOpenIssues: vi.fn().mockReturnValue([]),
        triggerWorkflow: vi.fn(),
        addLabel: vi.fn(),
        removeLabel: vi.fn(),
        setLifecycleLabel: vi.fn(),
        closeIssue: vi.fn(),
        getIssueComments: vi.fn().mockReturnValue([]),
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

    const actions = await healthCheckPlugin.run(mockCtx as unknown as InspectorContext)

    // No retry actions should be produced by health-check
    const retryActions = actions.filter((a) => a.type === 'retry')
    expect(retryActions).toHaveLength(0)
  })
})
