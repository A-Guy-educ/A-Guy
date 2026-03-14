import { describe, it, expect, vi } from 'vitest'

import { securityScannerPlugin } from '../../../../scripts/inspector/plugins/project/security-scanner/index'
import type { InspectorContext } from '../../../../scripts/inspector/core/types'

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    ...overrides,
  }
}

// ============================================================================
// securityScannerPlugin
// ============================================================================

describe('securityScannerPlugin', () => {
  it('has correct name', () => {
    expect(securityScannerPlugin.name).toBe('security-scanner')
  })

  it('has correct description', () => {
    expect(securityScannerPlugin.description).toBe(
      'Scan for security vulnerabilities in API routes, collections, and source code',
    )
  })

  it('has correct domain', () => {
    expect(securityScannerPlugin.domain).toBe('project')
  })

  it('has schedule with every: 6', () => {
    expect(securityScannerPlugin.schedule?.every).toBe(6)
  })

  it('run is an async function', () => {
    expect(typeof securityScannerPlugin.run).toBe('function')
  })

  it('returns Promise when run is called', async () => {
    const ctx = makeCtx()
    const result = securityScannerPlugin.run(ctx)
    expect(result).toBeInstanceOf(Promise)
    // Clean up - await the result to prevent unhandled rejection
    await result
  })
})
