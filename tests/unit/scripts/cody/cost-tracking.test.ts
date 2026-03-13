/**
 * @fileType test
 * @domain cody | cost-tracking
 * @pattern cost-tracking
 * @ai-summary Tests for per-stage cost tracking (token usage, cost accumulation, display)
 */

import { describe, it, expect } from 'vitest'
import { formatJsonEvent } from '../../../../scripts/cody/agent-runner'
import { formatStatusComment } from '../../../../scripts/cody/cody-utils'
import type { CodyInput, CodyPipelineStatus } from '../../../../scripts/cody/cody-utils'

describe('cost tracking — formatJsonEvent', () => {
  it('should extract stepTokens and stepCost from step_finish events', () => {
    const event = JSON.stringify({
      type: 'step_finish',
      part: {
        tokens: {
          total: 1500,
          input: 1000,
          output: 500,
          cache: { read: 200 },
        },
        cost: 0.0042,
        reason: 'done',
      },
      sessionID: 'sess-123',
    })

    const result = formatJsonEvent(event)
    expect(result.stepTokens).toEqual({ input: 1000, output: 500, cacheRead: 200 })
    expect(result.stepCost).toBe(0.0042)
    expect(result.display).toContain('1500 tok')
    expect(result.display).toContain('$0.0042')
    expect(result.display).toContain('200 cached')
    expect(result.sessionId).toBe('sess-123')
  })

  it('should return stepCost of 0 when cost is missing', () => {
    const event = JSON.stringify({
      type: 'step_finish',
      part: {
        tokens: { total: 100, input: 80, output: 20 },
        reason: 'done',
      },
    })

    const result = formatJsonEvent(event)
    expect(result.stepTokens).toEqual({ input: 80, output: 20, cacheRead: 0 })
    expect(result.stepCost).toBe(0)
  })

  it('should not return stepTokens for non step_finish events', () => {
    const event = JSON.stringify({
      type: 'session_start',
      sessionID: 'sess-456',
    })

    const result = formatJsonEvent(event)
    expect(result.stepTokens).toBeUndefined()
    expect(result.stepCost).toBeUndefined()
  })
})

describe('cost tracking — formatStatusComment', () => {
  const mockInput: CodyInput = {
    mode: 'full',
    taskId: '260312-test',
    dryRun: false,
  }

  it('should display cost table when stages have cost data', () => {
    const status: CodyPipelineStatus = {
      taskId: '260312-test',
      mode: 'full',
      pipeline: 'spec_execute_verify',
      startedAt: '2026-03-12T10:00:00Z',
      updatedAt: '2026-03-12T10:05:00Z',
      completedAt: '2026-03-12T10:05:00Z',
      state: 'completed',
      currentStage: null,
      stages: {
        taskify: { state: 'completed', retries: 0, elapsed: 30000, cost: 0.0021 },
        build: { state: 'completed', retries: 0, elapsed: 120000, cost: 0.015 },
        commit: { state: 'completed', retries: 0, elapsed: 5000 },
        verify: { state: 'completed', retries: 0, elapsed: 15000 },
      },
      triggeredBy: 'dispatch',
      totalCost: 0.0171,
    }

    const comment = formatStatusComment(mockInput, status)

    // Should have markdown table
    expect(comment).toContain('| Stage | Status | Duration | Cost |')
    expect(comment).toContain('| taskify | ✅ |')
    expect(comment).toContain('$0.0021')
    expect(comment).toContain('$0.0150')
    expect(comment).toContain('| commit | ✅ |')
    expect(comment).toContain('| **Total** | | | **$0.0171** |')
  })

  it('should show "—" for stages without cost data', () => {
    const status: CodyPipelineStatus = {
      taskId: '260312-test',
      mode: 'full',
      pipeline: 'spec_execute_verify',
      startedAt: '2026-03-12T10:00:00Z',
      updatedAt: '2026-03-12T10:05:00Z',
      completedAt: '2026-03-12T10:05:00Z',
      state: 'completed',
      currentStage: null,
      stages: {
        build: { state: 'completed', retries: 0, elapsed: 120000, cost: 0.015 },
        commit: { state: 'completed', retries: 0, elapsed: 5000 }, // No cost - scripted
      },
      triggeredBy: 'dispatch',
      totalCost: 0.015,
    }

    const comment = formatStatusComment(mockInput, status)

    expect(comment).toContain('| commit | ✅ |')
    expect(comment).toContain('| — |') // "—" for cost column
  })

  it('should fall back to simple list when no stages have cost data', () => {
    const status: CodyPipelineStatus = {
      taskId: '260312-test',
      mode: 'full',
      pipeline: 'spec_execute_verify',
      startedAt: '2026-03-12T10:00:00Z',
      updatedAt: '2026-03-12T10:05:00Z',
      completedAt: '2026-03-12T10:05:00Z',
      state: 'completed',
      currentStage: null,
      stages: {
        build: { state: 'completed', retries: 0, elapsed: 120000 },
        commit: { state: 'completed', retries: 0, elapsed: 5000 },
      },
      triggeredBy: 'dispatch',
    }

    const comment = formatStatusComment(mockInput, status)

    // Should NOT have a table header
    expect(comment).not.toContain('| Stage |')
    // Should have simple list format
    expect(comment).toContain('✅ build')
    expect(comment).toContain('✅ commit')
  })
})

describe('cost tracking — types integration', () => {
  it('StageStateV2 schema accepts tokenUsage and cost', async () => {
    const { PipelineStateV2Schema } = await import('../../../../scripts/cody/engine/types')

    const state = {
      version: 2,
      taskId: 'test-123',
      mode: 'full',
      pipeline: 'spec_execute_verify',
      startedAt: '2026-03-12T10:00:00Z',
      updatedAt: '2026-03-12T10:05:00Z',
      state: 'completed' as const,
      cursor: null,
      totalCost: 0.05,
      stages: {
        build: {
          state: 'completed' as const,
          retries: 0,
          tokenUsage: { input: 1000, output: 500, cacheRead: 200 },
          cost: 0.05,
        },
      },
    }

    const result = PipelineStateV2Schema.safeParse(state)
    expect(result.success).toBe(true)
  })

  it('StageStateV2 schema still accepts stages without tokenUsage/cost', async () => {
    const { PipelineStateV2Schema } = await import('../../../../scripts/cody/engine/types')

    const state = {
      version: 2,
      taskId: 'test-123',
      mode: 'full',
      pipeline: 'spec_execute_verify',
      startedAt: '2026-03-12T10:00:00Z',
      updatedAt: '2026-03-12T10:05:00Z',
      state: 'running' as const,
      cursor: 'build',
      stages: {
        build: {
          state: 'running' as const,
          retries: 0,
        },
      },
    }

    const result = PipelineStateV2Schema.safeParse(state)
    expect(result.success).toBe(true)
  })
})

describe('cost tracking — completeState computes totalCost', () => {
  it('should compute totalCost from stage costs', async () => {
    const { completeState } = await import('../../../../scripts/cody/engine/status')

    const state = {
      version: 2 as const,
      taskId: 'test-123',
      mode: 'full',
      pipeline: 'spec_execute_verify',
      startedAt: '2026-03-12T10:00:00Z',
      updatedAt: '2026-03-12T10:05:00Z',
      state: 'running' as const,
      cursor: null,
      stages: {
        taskify: { state: 'completed' as const, retries: 0, cost: 0.001 },
        build: { state: 'completed' as const, retries: 0, cost: 0.015 },
        commit: { state: 'completed' as const, retries: 0 }, // No cost
      },
    }

    const completed = completeState(state, 'completed')
    expect(completed.totalCost).toBeCloseTo(0.016, 4)
  })

  it('should not set totalCost when no stages have cost', async () => {
    const { completeState } = await import('../../../../scripts/cody/engine/status')

    const state = {
      version: 2 as const,
      taskId: 'test-123',
      mode: 'full',
      pipeline: 'spec_execute_verify',
      startedAt: '2026-03-12T10:00:00Z',
      updatedAt: '2026-03-12T10:05:00Z',
      state: 'running' as const,
      cursor: null,
      stages: {
        commit: { state: 'completed' as const, retries: 0 },
      },
    }

    const completed = completeState(state, 'completed')
    expect(completed.totalCost).toBeUndefined()
  })
})

describe('cost tracking — stateToV1 maps cost data', () => {
  it('should map tokenUsage and cost from v2 to v1', async () => {
    const { stateToV1 } = await import('../../../../scripts/cody/engine/status')

    const v2State = {
      version: 2 as const,
      taskId: 'test-123',
      mode: 'full',
      pipeline: 'spec_execute_verify',
      startedAt: '2026-03-12T10:00:00Z',
      updatedAt: '2026-03-12T10:05:00Z',
      state: 'completed' as const,
      cursor: null,
      totalCost: 0.05,
      stages: {
        build: {
          state: 'completed' as const,
          retries: 0,
          tokenUsage: { input: 1000, output: 500, cacheRead: 200 },
          cost: 0.05,
        },
      },
    }

    const v1 = stateToV1(v2State)
    expect(v1.stages.build.tokenUsage).toEqual({ input: 1000, output: 500 })
    expect(v1.stages.build.cost).toBe(0.05)
    expect(v1.totalCost).toBe(0.05)
  })
})
