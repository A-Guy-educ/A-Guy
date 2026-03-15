/**
 * @fileType test
 * @domain inspector
 * @ai-summary Tests for the failure-analysis plugin: classifier, stage-router, analyzer, and plugin integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { InspectorContext } from '../../../../scripts/inspector/core/types'
import { classifyRetryability } from '../../../../scripts/inspector/plugins/cody/failure-analysis/classifier'
import { resolveFromStage } from '../../../../scripts/inspector/plugins/cody/failure-analysis/stage-router'

// ============================================================================
// Classifier Tests (ported from supervisor.spec.ts)
// ============================================================================

describe('classifyRetryability', () => {
  describe('infrastructure failures (non-retryable)', () => {
    it('should reject missing API key', () => {
      const result = classifyRetryability('build', 'MINIMAX_API_KEY is not set')
      expect(result.canRetry).toBe(false)
      expect(result.category).toBe('infrastructure')
    })

    it('should reject rate limits', () => {
      const result = classifyRetryability('build', 'Error 429: Too many requests')
      expect(result.canRetry).toBe(false)
      expect(result.category).toBe('infrastructure')
    })

    it('should reject disk space issues', () => {
      const result = classifyRetryability('build', 'ENOSPC: no space left on device')
      expect(result.canRetry).toBe(false)
      expect(result.category).toBe('infrastructure')
    })

    it('should reject permission denied (non-Payload)', () => {
      const result = classifyRetryability('build', 'Permission denied: /home/runner/.cache')
      expect(result.canRetry).toBe(false)
      expect(result.category).toBe('infrastructure')
    })

    it('should NOT reject permission denied for Payload access control', () => {
      const result = classifyRetryability('build', 'Permission denied by Payload access control')
      expect(result.canRetry).toBe(true)
    })

    it('should reject cancelled workflows', () => {
      const result = classifyRetryability('build', 'Workflow run was cancelled')
      expect(result.canRetry).toBe(false)
      expect(result.category).toBe('infrastructure')
    })

    it('should reject Actions timeout', () => {
      const result = classifyRetryability(
        'build',
        'Actions timeout exceeded for GitHub hosted runner',
      )
      expect(result.canRetry).toBe(false)
      expect(result.category).toBe('infrastructure')
    })
  })

  describe('format-only failures (auto-retryable)', () => {
    it('should detect format-only failure at verify stage', () => {
      const result = classifyRetryability('verify', 'lint: 3 warnings found')
      expect(result.canRetry).toBe(true)
      expect(result.category).toBe('format-only')
    })

    it('should NOT classify as format-only if TypeScript errors present', () => {
      const result = classifyRetryability('verify', 'error TS2345: Argument of type string')
      expect(result.category).not.toBe('format-only')
    })

    it('should NOT classify as format-only for non-verify stages', () => {
      const result = classifyRetryability('build', 'lint: 3 warnings found')
      expect(result.category).toBe('unknown')
    })
  })

  describe('unknown failures (let LLM decide)', () => {
    it('should default to retryable unknown for generic errors', () => {
      const result = classifyRetryability('build', 'Some unexpected error occurred')
      expect(result.canRetry).toBe(true)
      expect(result.category).toBe('unknown')
    })
  })
})

// ============================================================================
// Stage Router Tests (ported from supervisor)
// ============================================================================

describe('resolveFromStage', () => {
  it('should route commit failures to commit', () => {
    expect(resolveFromStage('commit')).toBe('commit')
  })

  it('should route pr failures to pr', () => {
    expect(resolveFromStage('pr')).toBe('pr')
  })

  it('should route verify failures to build', () => {
    expect(resolveFromStage('verify')).toBe('build')
  })

  it('should route autofix failures to build', () => {
    expect(resolveFromStage('autofix')).toBe('build')
  })

  it('should pass through other stages unchanged', () => {
    expect(resolveFromStage('build')).toBe('build')
    expect(resolveFromStage('architect')).toBe('architect')
    expect(resolveFromStage('spec')).toBe('spec')
  })
})

// ============================================================================
// Analyzer Tests (mock MiniMax API)
// ============================================================================

describe('analyzeFailure', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return fallback analysis when MINIMAX_API_KEY is not set', async () => {
    delete process.env.MINIMAX_API_KEY

    const { analyzeFailure } =
      await import('../../../../scripts/inspector/plugins/cody/failure-analysis/analyzer')

    const result = await analyzeFailure({
      requirement: 'Add button component',
      errorMessage: "Cannot find module 'react'",
      failedStage: 'build',
      stageOutput: 'Error: Cannot find module react',
      retryNumber: 1,
    })

    expect(result.rootCause).toContain('MINIMAX_API_KEY not set')
    // canRetry should be false when API key is not set - we shouldn't blindly retry
    expect(result.canRetry).toBe(false)
  })

  it('should call MiniMax API when key is available', async () => {
    process.env.MINIMAX_API_KEY = 'test-key'

    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              rootCause: 'Missing import for React',
              refinedFeedback: 'Add import React from react at the top of the file',
            }),
          },
        },
      ],
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    )

    const { analyzeFailure } =
      await import('../../../../scripts/inspector/plugins/cody/failure-analysis/analyzer')

    const result = await analyzeFailure({
      requirement: 'Add button component',
      errorMessage: "Cannot find module 'react'",
      failedStage: 'build',
      stageOutput: 'Error: Cannot find module react',
      retryNumber: 1,
    })

    expect(result.rootCause).toBe('Missing import for React')
    expect(result.refinedFeedback).toContain('import React')
    expect(result.canRetry).toBe(true)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('should handle MiniMax API error gracefully', async () => {
    process.env.MINIMAX_API_KEY = 'test-key'

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    )

    const { analyzeFailure } =
      await import('../../../../scripts/inspector/plugins/cody/failure-analysis/analyzer')

    const result = await analyzeFailure({
      requirement: 'Test',
      errorMessage: 'Error',
      failedStage: 'build',
      stageOutput: 'Output',
      retryNumber: 1,
    })

    expect(result.rootCause).toContain('API error')
    // canRetry should be false on API error - we shouldn't blindly retry without analysis
    expect(result.canRetry).toBe(false)
  })
})

// ============================================================================
// Plugin Integration Tests
// ============================================================================

describe('failureAnalysisPlugin', () => {
  it('should export a valid InspectorPlugin', async () => {
    const { failureAnalysisPlugin } =
      await import('../../../../scripts/inspector/plugins/cody/failure-analysis/index')

    expect(failureAnalysisPlugin.name).toBe('cody-failure-analysis')
    expect(failureAnalysisPlugin.domain).toBe('cody')
    expect(typeof failureAnalysisPlugin.run).toBe('function')
  })

  it('should return empty actions when no failed tasks in state', async () => {
    const { failureAnalysisPlugin } =
      await import('../../../../scripts/inspector/plugins/cody/failure-analysis/index')

    const mockCtx = {
      repo: 'test/repo',
      dryRun: false,
      state: {
        get: vi.fn().mockReturnValue([
          { health: 'healthy', taskId: 'task-1' },
          { health: 'completed', taskId: 'task-2' },
        ]),
        set: vi.fn(),
        save: vi.fn(),
      },
      github: {
        postComment: vi.fn(),
        getIssue: vi.fn(),
        getOpenIssues: vi.fn(),
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

    const actions = await failureAnalysisPlugin.run(mockCtx as unknown as InspectorContext)
    expect(actions).toHaveLength(0)
  })

  it('should create action for failed tasks', async () => {
    const { failureAnalysisPlugin } =
      await import('../../../../scripts/inspector/plugins/cody/failure-analysis/index')

    const mockCtx = {
      repo: 'test/repo',
      dryRun: false,
      state: {
        get: vi.fn().mockReturnValue([
          {
            health: 'failed',
            taskId: '260307-login-redesign',
            issueNumber: 729,
            failedStage: 'verify',
            failedError: 'TypeScript error',
          },
        ]),
        set: vi.fn(),
        save: vi.fn(),
      },
      github: {
        postComment: vi.fn(),
        getIssue: vi.fn().mockReturnValue({ body: 'Redesign login page' }),
        getOpenIssues: vi.fn(),
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

    const actions = await failureAnalysisPlugin.run(mockCtx as unknown as InspectorContext)
    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('analyze-and-retry')
    expect(actions[0].target).toBe('260307-login-redesign')
    expect(actions[0].urgency).toBe('critical')
  })

  it('should skip failed tasks that already have cody:needs-manual label', async () => {
    const { failureAnalysisPlugin } =
      await import('../../../../scripts/inspector/plugins/cody/failure-analysis/index')

    const mockCtx = {
      repo: 'test/repo',
      dryRun: false,
      state: {
        get: vi.fn().mockReturnValue([
          {
            health: 'failed',
            taskId: '260307-needs-manual-task',
            issueNumber: 800,
            failedStage: 'build',
            failedError: 'API key missing',
            labels: ['cody:failed', 'cody:needs-manual'],
          },
        ]),
        set: vi.fn(),
        save: vi.fn(),
      },
      github: {
        postComment: vi.fn(),
        getIssue: vi.fn(),
        getOpenIssues: vi.fn(),
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

    const actions = await failureAnalysisPlugin.run(mockCtx as unknown as InspectorContext)
    // Should return empty because the task is skipped due to cody:needs-manual label
    expect(actions).toHaveLength(0)
    expect(mockCtx.log.debug).toHaveBeenCalledWith(
      { taskId: '260307-needs-manual-task' },
      expect.stringContaining('Skipping'),
    )
  })

  it('should add cody:needs-manual label when max retries exhausted', async () => {
    const { failureAnalysisPlugin } =
      await import('../../../../scripts/inspector/plugins/cody/failure-analysis/index')

    const mockCtx = {
      repo: 'test/repo',
      dryRun: false,
      state: {
        get: vi.fn().mockReturnValue([
          {
            health: 'failed',
            taskId: '260307-max-retries-task',
            issueNumber: 900,
            failedStage: 'verify',
            failedError: 'Test failure',
          },
        ]),
        set: vi.fn(),
        save: vi.fn(),
      },
      github: {
        postComment: vi.fn(),
        getIssue: vi.fn().mockReturnValue({ body: 'Fix the tests' }),
        getOpenIssues: vi.fn(),
        triggerWorkflow: vi.fn(),
        addLabel: vi.fn(),
        removeLabel: vi.fn(),
        setLifecycleLabel: vi.fn(),
        closeIssue: vi.fn(),
        // Return retry count >= MAX_RETRIES to trigger max retries exhausted path
        // Must include taskId in body for countRetries to find it
        getIssueComments: vi
          .fn()
          .mockReturnValue([
            { body: '[inspector-retry: 3/3] Max retries for `260307-max-retries-task`' },
          ]),
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

    const actions = await failureAnalysisPlugin.run(mockCtx as unknown as InspectorContext)
    expect(actions).toHaveLength(1)

    // Execute the action to trigger max retries logic
    await actions[0].execute(mockCtx as unknown as InspectorContext)

    // Verify cody:needs-manual label is added
    expect(mockCtx.github.addLabel).toHaveBeenCalledWith(900, 'cody:needs-manual')
  })
})
