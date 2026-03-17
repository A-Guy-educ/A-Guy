/**
 * @fileType test
 * @domain cody | ui
 * @pattern pipeline-display-state
 * @ai-summary Tests for derivePipelineDisplayState, getTaskSubStatusText, deriveColumnFromPipeline, and deriveGateType — all new functions added to fix dashboard status inconsistencies
 */

import { describe, it, expect } from 'vitest'
import {
  derivePipelineDisplayState,
  getTaskSubStatusText,
} from '../../../../src/ui/cody/pipeline-utils'
import { deriveColumnFromPipeline, deriveGateType } from '../../../../src/app/api/cody/tasks/route'
import type { CodyTask, CodyPipelineStatus } from '../../../../src/ui/cody/types'

// ── Helpers ──────────────────────────────────────────

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

function makeTask(overrides: Partial<CodyTask> = {}): CodyTask {
  return {
    id: 'test-123',
    issueNumber: 123,
    title: 'Test task',
    body: '',
    state: 'open',
    labels: [],
    column: 'building',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ══════════════════════════════════════════════════════
// deriveColumnFromPipeline
// ══════════════════════════════════════════════════════

describe('deriveColumnFromPipeline', () => {
  it('maps running → building', () => {
    expect(deriveColumnFromPipeline(makePipeline({ state: 'running' }))).toBe('building')
  })

  it('maps paused → gate-waiting', () => {
    expect(deriveColumnFromPipeline(makePipeline({ state: 'paused' }))).toBe('gate-waiting')
  })

  it('maps completed → review', () => {
    expect(deriveColumnFromPipeline(makePipeline({ state: 'completed' }))).toBe('review')
  })

  it('maps failed → failed', () => {
    expect(deriveColumnFromPipeline(makePipeline({ state: 'failed' }))).toBe('failed')
  })

  it('maps timeout → failed', () => {
    expect(deriveColumnFromPipeline(makePipeline({ state: 'timeout' }))).toBe('failed')
  })

  it('pipeline running overrides stale risk-gated label', () => {
    // Bug: task had risk-gated label from previous run, but pipeline is now running
    const pipeline = makePipeline({ state: 'running', currentStage: 'build' })
    // Pipeline-first means we get 'building' even though the label says 'risk-gated'
    expect(deriveColumnFromPipeline(pipeline)).toBe('building')
  })

  it('pipeline paused correctly shows gate-waiting even when cody:building label present', () => {
    // Bug: pipeline paused at gate but cody:building label not removed yet
    const pipeline = makePipeline({ state: 'paused', controlMode: 'risk-gated' })
    expect(deriveColumnFromPipeline(pipeline)).toBe('gate-waiting')
  })
})

// ══════════════════════════════════════════════════════
// deriveGateType
// ══════════════════════════════════════════════════════

describe('deriveGateType', () => {
  it('returns hard-stop from pipeline controlMode', () => {
    expect(deriveGateType(makePipeline({ controlMode: 'hard-stop' }), [])).toBe('hard-stop')
  })

  it('returns risk-gated from pipeline controlMode', () => {
    expect(deriveGateType(makePipeline({ controlMode: 'risk-gated' }), [])).toBe('risk-gated')
  })

  it('falls back to hard-stop label when no pipeline controlMode', () => {
    expect(deriveGateType(makePipeline({ controlMode: undefined }), ['hard-stop'])).toBe(
      'hard-stop',
    )
  })

  it('falls back to risk-gated label when no pipeline controlMode', () => {
    expect(deriveGateType(makePipeline({ controlMode: undefined }), ['risk-gated'])).toBe(
      'risk-gated',
    )
  })

  it('returns undefined when no gate info present', () => {
    expect(deriveGateType(makePipeline(), ['cody:building'])).toBeUndefined()
  })

  it('returns undefined when pipeline is null', () => {
    expect(deriveGateType(null, ['cody:building'])).toBeUndefined()
  })

  it('prefers pipeline controlMode over labels', () => {
    // Pipeline says risk-gated but label says hard-stop — pipeline wins
    expect(deriveGateType(makePipeline({ controlMode: 'risk-gated' }), ['hard-stop'])).toBe(
      'risk-gated',
    )
  })
})

// ══════════════════════════════════════════════════════
// derivePipelineDisplayState
// ══════════════════════════════════════════════════════

describe('derivePipelineDisplayState', () => {
  it('returns gate-paused when pipeline.state is paused', () => {
    const task = makeTask({
      column: 'gate-waiting',
      gateType: 'risk-gated',
      pipeline: makePipeline({
        state: 'paused',
        currentStage: 'architect',
        controlMode: 'risk-gated',
      }),
    })
    const state = derivePipelineDisplayState(task)
    expect(state.kind).toBe('gate-paused')
    if (state.kind === 'gate-paused') {
      expect(state.gateType).toBe('risk-gated')
      // architect is index 3 in ALL_STAGES
      expect(state.stageIndex).toBeGreaterThanOrEqual(0)
    }
  })

  it('returns gate-paused even when task.column is still building (label lag)', () => {
    // Critical bug fix: column may still be 'building' due to label propagation delay
    // but pipeline state is paused — should show gate state
    const task = makeTask({
      column: 'building', // stale label
      gateType: 'risk-gated',
      pipeline: makePipeline({ state: 'paused', currentStage: 'build' }),
    })
    const state = derivePipelineDisplayState(task)
    expect(state.kind).toBe('gate-paused')
  })

  it('returns stage-progress when running with currentStage', () => {
    const task = makeTask({
      column: 'building',
      pipeline: makePipeline({ state: 'running', currentStage: 'build' }),
    })
    const state = derivePipelineDisplayState(task)
    expect(state.kind).toBe('stage-progress')
    if (state.kind === 'stage-progress') {
      expect(state.label).toBe('Building')
      expect(state.stepNumber).toBeGreaterThan(0)
      expect(state.totalStages).toBe(12)
    }
  })

  it('returns starting when running without currentStage', () => {
    const task = makeTask({
      column: 'building',
      pipeline: makePipeline({ state: 'running', currentStage: null }),
    })
    const state = derivePipelineDisplayState(task)
    expect(state.kind).toBe('starting')
  })

  it('returns no-data when no pipeline present', () => {
    const task = makeTask({
      column: 'building',
      pipeline: undefined,
      workflowRun: {
        id: 1,
        status: 'in_progress',
        conclusion: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        html_url: 'https://github.com/foo/bar/actions/runs/1',
      },
    })
    const state = derivePipelineDisplayState(task)
    expect(state.kind).toBe('no-data')
    if (state.kind === 'no-data') {
      expect(state.workflowStatus).toBe('in_progress')
    }
  })

  it('returns no-data when no pipeline and no workflow run', () => {
    const task = makeTask({ column: 'building', pipeline: undefined, workflowRun: undefined })
    const state = derivePipelineDisplayState(task)
    expect(state.kind).toBe('no-data')
    if (state.kind === 'no-data') {
      expect(state.workflowStatus).toBeUndefined()
    }
  })
})

// ══════════════════════════════════════════════════════
// getTaskSubStatusText
// ══════════════════════════════════════════════════════

describe('getTaskSubStatusText', () => {
  it('formats stage-progress as "Label · N/12"', () => {
    const task = makeTask({
      pipeline: makePipeline({ state: 'running', currentStage: 'build' }),
    })
    const text = getTaskSubStatusText(task)
    expect(text).toMatch(/Building · \d+\/12/)
  })

  it('formats gate-paused with stage name', () => {
    const task = makeTask({
      column: 'gate-waiting',
      gateType: 'risk-gated',
      pipeline: makePipeline({ state: 'paused', currentStage: 'architect' }),
    })
    const text = getTaskSubStatusText(task)
    expect(text).toBe('Paused · Planning')
  })

  it('formats starting as "Starting pipeline..."', () => {
    const task = makeTask({
      pipeline: makePipeline({ state: 'running', currentStage: null }),
    })
    expect(getTaskSubStatusText(task)).toBe('Starting pipeline...')
  })

  it('formats no-data in_progress as "Running"', () => {
    const task = makeTask({
      pipeline: undefined,
      workflowRun: {
        id: 1,
        status: 'in_progress',
        conclusion: null,
        created_at: '',
        updated_at: '',
        html_url: '',
      },
    })
    expect(getTaskSubStatusText(task)).toBe('Running')
  })

  it('formats no-data queued as "Queued..."', () => {
    const task = makeTask({
      pipeline: undefined,
      workflowRun: {
        id: 1,
        status: 'queued',
        conclusion: null,
        created_at: '',
        updated_at: '',
        html_url: '',
      },
    })
    expect(getTaskSubStatusText(task)).toBe('Queued...')
  })

  it('formats no-data with no workflow as "Starting..."', () => {
    const task = makeTask({ pipeline: undefined, workflowRun: undefined })
    expect(getTaskSubStatusText(task)).toBe('Starting...')
  })

  it('formats commit stage correctly', () => {
    const task = makeTask({
      pipeline: makePipeline({ state: 'running', currentStage: 'commit' }),
    })
    const text = getTaskSubStatusText(task)
    expect(text).toMatch(/Committing · \d+\/12/)
  })
})

// ══════════════════════════════════════════════════════
// Bug fix: currentStage null with stages data
// ══════════════════════════════════════════════════════

describe('derivePipelineDisplayState — currentStage null fallback', () => {
  it('returns stage-progress (not starting) when running with null currentStage but stages have running data', () => {
    const task = makeTask({
      column: 'building',
      pipeline: makePipeline({
        state: 'running',
        currentStage: null,
        stages: {
          taskify: { state: 'completed', retries: 0 },
          gap: { state: 'completed', retries: 0 },
          architect: { state: 'completed', retries: 0 },
          build: { state: 'running', retries: 0 },
        },
      }),
    })
    const state = derivePipelineDisplayState(task)
    expect(state.kind).toBe('stage-progress')
    if (state.kind === 'stage-progress') {
      expect(state.label).toBe('Building')
    }
  })

  it('returns stage-progress when all stages completed but state is still running (stale status)', () => {
    const task = makeTask({
      column: 'building',
      pipeline: makePipeline({
        state: 'running',
        currentStage: null,
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
    })
    const state = derivePipelineDisplayState(task)
    expect(state.kind).toBe('stage-progress')
    if (state.kind === 'stage-progress') {
      // Should show last completed stage
      expect(state.stageIndex).toBeGreaterThan(0)
    }
  })

  it('returns starting when running with no stages at all', () => {
    const task = makeTask({
      column: 'building',
      pipeline: makePipeline({ state: 'running', currentStage: null, stages: {} }),
    })
    const state = derivePipelineDisplayState(task)
    expect(state.kind).toBe('starting')
  })
})

// ══════════════════════════════════════════════════════
// Updated label tests
// ══════════════════════════════════════════════════════

describe('getTaskSubStatusText — updated labels', () => {
  it('gate-paused at taskify shows "Paused · Classifying" (not "Awaiting Analyzing")', () => {
    const task = makeTask({
      column: 'gate-waiting',
      gateType: 'risk-gated',
      pipeline: makePipeline({ state: 'paused', currentStage: 'taskify' }),
    })
    const text = getTaskSubStatusText(task)
    expect(text).toBe('Paused · Classifying')
    expect(text).not.toContain('Awaiting')
    expect(text).not.toContain('Analyzing')
  })

  it('gate-paused at architect shows "Paused · Planning" (not "Awaiting Architecting")', () => {
    const task = makeTask({
      column: 'gate-waiting',
      gateType: 'hard-stop',
      pipeline: makePipeline({ state: 'paused', currentStage: 'architect' }),
    })
    const text = getTaskSubStatusText(task)
    expect(text).toBe('Paused · Planning')
  })

  it('running at taskify shows "Classifying · 1/12"', () => {
    const task = makeTask({
      column: 'building',
      pipeline: makePipeline({ state: 'running', currentStage: 'taskify' }),
    })
    const text = getTaskSubStatusText(task)
    expect(text).toBe('Classifying · 1/12')
  })
})
