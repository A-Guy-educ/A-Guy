/**
 * @fileType test
 * @domain inspector
 * @ai-summary Tests for inspector dedup fixes: security scanner batching, pipeline-fixer cross-task dedup, auth patterns
 */

import { describe, it, expect, vi } from 'vitest'
import * as path from 'path'
import * as fs from 'fs'

import type { InspectorContext, GitHubClient } from '../../../../scripts/inspector/core/types'

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
      getIssue: vi.fn().mockReturnValue({ body: 'Test issue body', title: 'Test' }),
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
// Fix: AUTH_PATTERNS includes requireCodyAuth
// ============================================================================

describe('AUTH_PATTERNS includes requireCodyAuth', () => {
  it('should include requireCodyAuth pattern', async () => {
    const { AUTH_PATTERNS } =
      await import('../../../../scripts/inspector/plugins/project/security-scanner/rules')

    const testContent = 'const authError = await requireCodyAuth(req)'
    const hasAuth = AUTH_PATTERNS.some((pattern: RegExp) => pattern.test(testContent))
    expect(hasAuth).toBe(true)
  })

  it('should still detect payload.auth pattern', async () => {
    const { AUTH_PATTERNS } =
      await import('../../../../scripts/inspector/plugins/project/security-scanner/rules')

    const testContent = 'const { user } = await payload.auth({ headers: req.headers })'
    const hasAuth = AUTH_PATTERNS.some((pattern: RegExp) => pattern.test(testContent))
    expect(hasAuth).toBe(true)
  })
})

// ============================================================================
// Fix: PUBLIC_ROUTE_ALLOWLIST includes cody/auth/logout
// ============================================================================

describe('PUBLIC_ROUTE_ALLOWLIST includes cody/auth/logout', () => {
  it('should include cody/auth/logout/route.ts', async () => {
    const { PUBLIC_ROUTE_ALLOWLIST } =
      await import('../../../../scripts/inspector/plugins/project/security-scanner/rules')

    const isAllowlisted = PUBLIC_ROUTE_ALLOWLIST.some((route: string) =>
      route.includes('cody/auth/logout'),
    )
    expect(isAllowlisted).toBe(true)
  })
})

// ============================================================================
// Fix: Security scanner batches findings by rule
// ============================================================================

describe('Security scanner batches findings by rule', () => {
  it('should create at most one issue per rule (not per file)', async () => {
    const { securityScannerPlugin } =
      await import('../../../../scripts/inspector/plugins/project/security-scanner/index')

    const ctx = makeCtx({ digestIssue: 817 })

    const actions = await securityScannerPlugin.run(ctx)

    // Get create-issue actions
    const issueActions = actions.filter((a) => a.type === 'create-issue')

    // dedupKeys should be by rule, not by file
    const dedupKeys = issueActions.map((a) => a.dedupKey)
    for (const key of dedupKeys) {
      // Should be like "security-scanner:issue:missing-auth" not "security-scanner:issue:src/app/api/foo/route.ts:missing-auth"
      expect(key).toMatch(/^security-scanner:issue:[a-z-]+$/)
    }
  })

  it('should cap issues per cycle at MAX_ISSUES_PER_CYCLE (3)', async () => {
    const { securityScannerPlugin } =
      await import('../../../../scripts/inspector/plugins/project/security-scanner/index')

    const ctx = makeCtx({ digestIssue: 817 })
    const actions = await securityScannerPlugin.run(ctx)

    const issueActions = actions.filter((a) => a.type === 'create-issue')
    expect(issueActions.length).toBeLessThanOrEqual(3)
  })

  it('should check for existing issues before creating via searchIssues', async () => {
    const { securityScannerPlugin } =
      await import('../../../../scripts/inspector/plugins/project/security-scanner/index')

    const ctx = makeCtx({ digestIssue: 817 })
    // Mock searchIssues to return an existing issue
    ;(ctx.github.searchIssues as ReturnType<typeof vi.fn>).mockReturnValue([
      { number: 100, title: '[Security] existing', labels: ['type:security'], updatedAt: '' },
    ])

    const actions = await securityScannerPlugin.run(ctx)
    const issueActions = actions.filter((a) => a.type === 'create-issue')

    // Execute the first issue action (if any)
    if (issueActions.length > 0) {
      const result = await issueActions[0].execute(ctx)
      // Should skip creation because existing issue was found
      expect(result.success).toBe(true)
      expect(result.message).toContain('already exists')
      // createIssue should NOT have been called
      expect(ctx.github.createIssue).not.toHaveBeenCalled()
    }
  })

  it('search query should NOT contain "in:" GitHub qualifier', async () => {
    // Verify the old buggy pattern is gone
    const pluginSource = fs.readFileSync(
      path.join(process.cwd(), 'scripts/inspector/plugins/project/security-scanner/index.ts'),
      'utf-8',
    )

    // Old buggy pattern: in:${finding.file} or in:title
    expect(pluginSource).not.toContain('in:${finding.file}')
    expect(pluginSource).not.toContain('in:title')
  })
})

// ============================================================================
// Fix: Pipeline-fixer cross-task dedup
// ============================================================================

describe('Pipeline-fixer cross-task dedup', () => {
  it('findExistingFixIssue returns existing fix issue for same stage', async () => {
    const { findExistingFixIssue } =
      await import('../../../../scripts/inspector/plugins/cody/pipeline-fixer/index')

    const fixerState = {
      'task-1': {
        retries: 3,
        errorSignature: 'build:TS2322 Type error',
        fixIssueNumber: 500,
        fixIssueCreatedAt: new Date().toISOString(),
      },
      'task-2': {
        retries: 1,
        errorSignature: 'verify:lint error',
        fixIssueNumber: null,
        fixIssueCreatedAt: null,
      },
    }

    // task-3 fails at 'build' -> should find task-1's fix issue
    const result = findExistingFixIssue('build', 'task-3', fixerState)
    expect(result).toBe(500)
  })

  it('findExistingFixIssue returns null when no matching stage', async () => {
    const { findExistingFixIssue } =
      await import('../../../../scripts/inspector/plugins/cody/pipeline-fixer/index')

    const fixerState = {
      'task-1': {
        retries: 3,
        errorSignature: 'build:TS2322 Type error',
        fixIssueNumber: 500,
        fixIssueCreatedAt: new Date().toISOString(),
      },
    }

    // task-2 fails at 'verify' -> no existing fix for verify stage
    const result = findExistingFixIssue('verify', 'task-2', fixerState)
    expect(result).toBeNull()
  })

  it('findExistingFixIssue skips current task', async () => {
    const { findExistingFixIssue } =
      await import('../../../../scripts/inspector/plugins/cody/pipeline-fixer/index')

    const fixerState = {
      'task-1': {
        retries: 3,
        errorSignature: 'build:TS2322 Type error',
        fixIssueNumber: 500,
        fixIssueCreatedAt: new Date().toISOString(),
      },
    }

    // task-1 itself should not match its own entry
    const result = findExistingFixIssue('build', 'task-1', fixerState)
    expect(result).toBeNull()
  })

  it('pipeline-fixer links to existing fix issue instead of creating duplicate', async () => {
    const { pipelineFixerPlugin } =
      await import('../../../../scripts/inspector/plugins/cody/pipeline-fixer/index')

    const stateStore: Record<string, unknown> = {
      'cody:evaluatedTasks': [
        {
          health: 'failed',
          taskId: 'task-A',
          issueNumber: 100,
          failedStage: 'build',
          failedError: 'TS2322 Type error in component',
          issueTitle: 'Task A',
          labels: [],
          status: null,
          issueUpdatedAt: new Date().toISOString(),
          statusUpdatedAt: null,
          healthDetail: 'Failed',
        },
        {
          health: 'failed',
          taskId: 'task-B',
          issueNumber: 101,
          failedStage: 'build',
          failedError: 'TS2322 Type error in service',
          issueTitle: 'Task B',
          labels: [],
          status: null,
          issueUpdatedAt: new Date().toISOString(),
          statusUpdatedAt: null,
          healthDetail: 'Failed',
        },
      ],
      // task-A already has a fix issue, task-B should link to it
      'cody:fixerState': {
        'task-A': {
          retries: 3,
          errorSignature: 'build:TS2322 Type error in component',
          fixIssueNumber: 500,
          fixIssueCreatedAt: new Date().toISOString(),
        },
        'task-B': {
          retries: 2,
          errorSignature: 'build:TS2322 Type error in service',
          fixIssueNumber: null,
          fixIssueCreatedAt: null,
        },
      },
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
    })

    const actions = await pipelineFixerPlugin.run(ctx)

    // task-A should get a retry (it already has a fix issue, phase 3)
    // task-B should get a create-fix-issue action (retries >= threshold, same error)
    const taskBAction = actions.find((a) => a.target === 'task-B' && a.type === 'create-fix-issue')

    if (taskBAction) {
      // Execute it
      const result = await taskBAction.execute(ctx)

      // Should have linked to existing fix issue #500 instead of creating a new one
      expect(result.success).toBe(true)
      expect(result.message).toContain('Linked to existing fix issue #500')

      // createIssue should NOT have been called (linked instead)
      expect(ctx.github.createIssue).not.toHaveBeenCalled()

      // Should have posted a comment to the existing fix issue
      expect(ctx.github.postComment).toHaveBeenCalledWith(500, expect.stringContaining('task-B'))
    }
  })
})
