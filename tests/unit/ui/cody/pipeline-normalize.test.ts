/**
 * @fileType test
 * @domain cody | ui
 * @pattern pipeline-normalize
 * @ai-summary Tests for normalizePipelineStatus — derives currentStage from stage data when null
 */

import { describe, it, expect } from 'vitest'
import { normalizePipelineStatus } from '../../../../src/ui/cody/github-client'
import type { CodyPipelineStatus } from '../../../../src/ui/cody/types'

function makePipeline(overrides: Partial<CodyPipelineStatus> = {}): CodyPipelineStatus {
  return {
    taskId: 'test-task',
    mode: 'full',
    pipeline: 'spec_execute_verify',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: 'running',
    currentStage: null,
    stages: {},
    triggeredBy: 'test',
    ...overrides,
  }
}

describe('normalizePipelineStatus', () => {
  it('preserves existing currentStage if set', () => {
    const result = normalizePipelineStatus(
      makePipeline({ currentStage: 'build', state: 'running' }),
    )
    expect(result.currentStage).toBe('build')
  })

  it('derives currentStage from running stage entry', () => {
    const result = normalizePipelineStatus(
      makePipeline({
        currentStage: null,
        stages: {
          taskify: { state: 'completed', retries: 0 },
          build: { state: 'running', retries: 0 },
        },
      }),
    )
    expect(result.currentStage).toBe('build')
  })

  it('derives currentStage from paused stage entry (gate)', () => {
    const result = normalizePipelineStatus(
      makePipeline({
        currentStage: null,
        state: 'paused',
        stages: {
          taskify: { state: 'paused', retries: 0 },
        },
      }),
    )
    expect(result.currentStage).toBe('taskify')
  })

  it('derives currentStage from paused stage even when pipeline state is running', () => {
    // Edge case: stage is paused but pipeline state hasn't caught up
    const result = normalizePipelineStatus(
      makePipeline({
        currentStage: null,
        state: 'running',
        stages: {
          taskify: { state: 'paused', retries: 0 },
        },
      }),
    )
    expect(result.currentStage).toBe('taskify')
  })

  it('derives currentStage as first non-completed stage in ALL_STAGES order', () => {
    const result = normalizePipelineStatus(
      makePipeline({
        currentStage: null,
        stages: {
          taskify: { state: 'completed', retries: 0 },
          gap: { state: 'completed', retries: 0 },
          architect: { state: 'completed', retries: 0 },
          build: { state: 'pending', retries: 0 },
        },
      }),
    )
    expect(result.currentStage).toBe('build')
  })

  it('uses last completed stage when ALL stages are done (stale running status)', () => {
    const result = normalizePipelineStatus(
      makePipeline({
        currentStage: null,
        state: 'running',
        stages: {
          taskify: { state: 'completed', retries: 0 },
          gap: { state: 'completed', retries: 0 },
          architect: { state: 'completed', retries: 0 },
          'plan-gap': { state: 'skipped', retries: 0 },
          build: { state: 'completed', retries: 0 },
          commit: { state: 'completed', retries: 0 },
          review: { state: 'completed', retries: 0 },
        },
      }),
    )
    expect(result.currentStage).toBe('review')
  })

  it('returns null currentStage when stages is empty', () => {
    const result = normalizePipelineStatus(makePipeline({ currentStage: null, stages: {} }))
    expect(result.currentStage).toBeNull()
  })

  it('handles real #838 data: paused with taskify:paused', () => {
    const result = normalizePipelineStatus(
      makePipeline({
        currentStage: null,
        state: 'paused',
        stages: {
          taskify: { state: 'paused', retries: 0 },
        },
      }),
    )
    expect(result.currentStage).toBe('taskify')
  })

  it('handles real #824 data: paused with architect:paused', () => {
    const result = normalizePipelineStatus(
      makePipeline({
        currentStage: null,
        state: 'paused',
        stages: {
          taskify: { state: 'completed', retries: 0 },
          gap: { state: 'completed', retries: 0 },
          architect: { state: 'paused', retries: 0 },
          'plan-gap': { state: 'pending', retries: 0 },
        },
      }),
    )
    expect(result.currentStage).toBe('architect')
  })

  it('handles real #839 data: running with 8 completed stages', () => {
    const result = normalizePipelineStatus(
      makePipeline({
        currentStage: null,
        state: 'running',
        stages: {
          taskify: { state: 'completed', retries: 0 },
          gap: { state: 'completed', retries: 0 },
          architect: { state: 'completed', retries: 0 },
          'plan-gap': { state: 'skipped', retries: 0 },
          build: { state: 'completed', retries: 0 },
          commit: { state: 'completed', retries: 0 },
          review: { state: 'completed', retries: 0 },
        },
      }),
    )
    // Should derive a non-null currentStage
    expect(result.currentStage).not.toBeNull()
    expect(result.currentStage).toBe('review') // last completed in ALL_STAGES order
  })
})
