import { describe, it, expect } from 'vitest'
import { isPipelineStateV2, PipelineStateV2Schema } from '../../../../../scripts/cody/engine/types'

describe('StageStateV2 feedback tracking fields', () => {
  const baseState = {
    version: 2 as const,
    taskId: 'test-123',
    mode: 'full',
    pipeline: 'full',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: 'completed' as const,
    cursor: null,
    stages: {},
  }

  it('validates state with feedbackLoops and feedbackErrors fields', () => {
    const state = {
      ...baseState,
      stages: {
        build: {
          state: 'completed' as const,
          retries: 0,
          feedbackLoops: 2,
          feedbackErrors: ['type_error', 'test_failure'],
        },
      },
    }
    expect(isPipelineStateV2(state)).toBe(true)
    const result = PipelineStateV2Schema.safeParse(state)
    expect(result.success).toBe(true)
  })

  it('validates state WITHOUT feedback fields (backward compat)', () => {
    const state = {
      ...baseState,
      stages: {
        build: {
          state: 'completed' as const,
          retries: 0,
        },
      },
    }
    expect(isPipelineStateV2(state)).toBe(true)
    const result = PipelineStateV2Schema.safeParse(state)
    expect(result.success).toBe(true)
  })

  it('rejects invalid feedbackLoops value', () => {
    const state = {
      ...baseState,
      stages: {
        build: {
          state: 'completed' as const,
          retries: 0,
          feedbackLoops: 'not-a-number',
        },
      },
    }
    const result = PipelineStateV2Schema.safeParse(state)
    expect(result.success).toBe(false)
  })

  it('rejects invalid feedbackErrors value', () => {
    const state = {
      ...baseState,
      stages: {
        build: {
          state: 'completed' as const,
          retries: 0,
          feedbackErrors: 'not-an-array',
        },
      },
    }
    const result = PipelineStateV2Schema.safeParse(state)
    expect(result.success).toBe(false)
  })
})
