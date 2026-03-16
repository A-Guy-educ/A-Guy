/**
 * @fileType test
 * @domain cody | pipeline
 * @pattern bugfix-tests
 * @ai-summary Tests for second round of bug fixes applied to the Cody pipeline
 */

import { describe, it, expect, vi } from 'vitest'
import type { PipelineContext } from '../../../../scripts/cody/engine/types'

// ============================================================================
// CRITICAL 1: stdoutBuffer memory cap
// ============================================================================

describe('CRITICAL 1: stdoutBuffer memory cap', () => {
  it('should export MAX_STDOUT_BUFFER_SIZE constant', async () => {
    const { MAX_STDOUT_BUFFER_SIZE } = await import('../../../../scripts/cody/agent-runner')
    expect(MAX_STDOUT_BUFFER_SIZE).toBe(1_048_576)
  })

  it('should be 1 MB', async () => {
    const { MAX_STDOUT_BUFFER_SIZE } = await import('../../../../scripts/cody/agent-runner')
    // 1 MB = 1024 * 1024
    expect(MAX_STDOUT_BUFFER_SIZE).toBe(1024 * 1024)
  })
})

// ============================================================================
// HIGH 4: Busy-wait replaced with syncSleep (runtime behavior test only)
// ============================================================================

describe('HIGH 4: syncSleep replaces busy-wait', () => {
  it('syncSleep should block for approximately the requested time', async () => {
    const { syncSleep } = await import('../../../../scripts/cody/github-api')
    const start = Date.now()
    syncSleep(50) // 50ms
    const elapsed = Date.now() - start
    // Should have waited at least ~40ms (allowing for timer imprecision)
    expect(elapsed).toBeGreaterThanOrEqual(40)
    // Should not have waited way too long
    expect(elapsed).toBeLessThan(500)
  })
})

// ============================================================================
// HIGH 6: Profile used in full/rerun buildPipeline
// ============================================================================

describe('HIGH 6: Profile used in full/rerun buildPipeline', () => {
  it('should use profile parameter for specOrder in full/rerun mode', async () => {
    const { buildPipeline, SPEC_ORDER_STANDARD, SPEC_ORDER_LIGHTWEIGHT } =
      await import('../../../../scripts/cody/pipeline/definitions')

    // Create minimal mock context
    const mockBackend = {
      spawn: vi.fn(),
      name: 'mock' as const,
    }
    const ctx = {
      taskId: 'test-123',
      taskDir: '/tmp/test',
      input: {
        taskId: 'test-123',
        mode: 'full' as const,
        issueNumber: 0,
        commentBody: '',
        triggerType: 'manual' as const,
        specType: 'ticket' as const,
        dryRun: false,
        controlMode: undefined,
        clarify: true,
      },
      taskDef: null,
      profile: 'lightweight' as const,
      backend: mockBackend,
    }

    // Build pipeline with lightweight profile
    const pipeline = buildPipeline('full', 'lightweight', true, ctx as unknown as PipelineContext)
    const orderNames = pipeline.order.flatMap((step) =>
      typeof step === 'string' ? [step] : (step as { parallel: string[] }).parallel,
    )

    // With lightweight profile, spec order should NOT include 'spec' or 'gap'
    // SPEC_ORDER_LIGHTWEIGHT is ['taskify', 'clarify']
    expect(orderNames).toContain('taskify')
    expect(orderNames).toContain('clarify')
    // The lightweight spec order should not include 'spec' and 'gap' stages
    // (those are only in SPEC_ORDER_STANDARD)
    const specStages = orderNames.filter(
      (s) =>
        (SPEC_ORDER_STANDARD as readonly string[]).includes(s) &&
        !(SPEC_ORDER_LIGHTWEIGHT as readonly string[]).includes(s),
    )
    expect(specStages).toHaveLength(0)
  })

  it('should use SPEC_ORDER_STANDARD for standard profile in full mode', async () => {
    const { buildPipeline, SPEC_ORDER_STANDARD } =
      await import('../../../../scripts/cody/pipeline/definitions')

    const mockBackend = {
      spawn: vi.fn(),
      name: 'mock' as const,
    }
    const ctx = {
      taskId: 'test-123',
      taskDir: '/tmp/test',
      input: {
        taskId: 'test-123',
        mode: 'full' as const,
        issueNumber: 0,
        commentBody: '',
        triggerType: 'manual' as const,
        specType: 'ticket' as const,
        dryRun: false,
        controlMode: undefined,
        clarify: true,
      },
      taskDef: null,
      profile: 'standard' as const,
      backend: mockBackend,
    }

    const pipeline = buildPipeline('full', 'standard', true, ctx as unknown as PipelineContext)
    const orderNames = pipeline.order.flatMap((step) =>
      typeof step === 'string' ? [step] : (step as { parallel: string[] }).parallel,
    )

    // With standard profile, should include all standard spec stages
    for (const stage of SPEC_ORDER_STANDARD) {
      expect(orderNames).toContain(stage)
    }
  })
})
