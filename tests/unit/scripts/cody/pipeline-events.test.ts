/**
 * @fileType test
 * @domain cody | observability | structured-logging
 * @ai-summary Tests for pipeline-events structured logging
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  PIPELINE_EVENTS,
  logStageStart,
  logStageComplete,
  logStageSkip,
  logStageFail,
  logStageRetry,
  logPipelineStart,
  logPipelineComplete,
  logGateWait,
  logRecovery,
  logPostAction,
} from '../../../../scripts/cody/pipeline-events'

// Mock the logger
vi.mock('../../../../scripts/cody/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('PIPELINE_EVENTS', () => {
  it('should have all required event types', () => {
    expect(PIPELINE_EVENTS.PIPELINE_START).toBe('pipeline:start')
    expect(PIPELINE_EVENTS.PIPELINE_COMPLETE).toBe('pipeline:complete')
    expect(PIPELINE_EVENTS.PIPELINE_FAIL).toBe('pipeline:fail')
    expect(PIPELINE_EVENTS.PIPELINE_TIMEOUT).toBe('pipeline:timeout')
    expect(PIPELINE_EVENTS.PIPELINE_PAUSE).toBe('pipeline:pause')
    expect(PIPELINE_EVENTS.STAGE_START).toBe('stage:start')
    expect(PIPELINE_EVENTS.STAGE_COMPLETE).toBe('stage:complete')
    expect(PIPELINE_EVENTS.STAGE_SKIP).toBe('stage:skip')
    expect(PIPELINE_EVENTS.STAGE_FAIL).toBe('stage:fail')
    expect(PIPELINE_EVENTS.STAGE_RETRY).toBe('stage:retry')
    expect(PIPELINE_EVENTS.GATE_WAIT).toBe('gate:wait')
    expect(PIPELINE_EVENTS.GATE_APPROVE).toBe('gate:approve')
    expect(PIPELINE_EVENTS.GATE_REJECT).toBe('gate:reject')
    expect(PIPELINE_EVENTS.POST_ACTION_START).toBe('post-action:start')
    expect(PIPELINE_EVENTS.POST_ACTION_COMPLETE).toBe('post-action:complete')
    expect(PIPELINE_EVENTS.POST_ACTION_FAIL).toBe('post-action:fail')
    expect(PIPELINE_EVENTS.RECOVERY_TRIGGERED).toBe('recovery:triggered')
  })
})

describe('logStageStart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log stage start with taskId', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logStageStart('architect', 'task-123')
    expect(logger.info).toHaveBeenCalledWith(
      { event: 'stage:start', stage: 'architect', taskId: 'task-123', attempt: undefined },
      '▶ Starting stage: architect',
    )
  })

  it('should log stage start with attempt number', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logStageStart('build', 'task-456', 2)
    expect(logger.info).toHaveBeenCalledWith(
      { event: 'stage:start', stage: 'build', taskId: 'task-456', attempt: 2 },
      '▶ Starting stage: build',
    )
  })
})

describe('logStageComplete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log stage completion', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logStageComplete('architect', 'task-123', 'completed')
    expect(logger.info).toHaveBeenCalledWith(
      {
        event: 'stage:complete',
        stage: 'architect',
        taskId: 'task-123',
        outcome: 'completed',
        duration: undefined,
      },
      '✅ Completed stage: architect (completed)',
    )
  })

  it('should log stage completion with duration', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logStageComplete('build', 'task-456', 'completed', 5000)
    expect(logger.info).toHaveBeenCalledWith(
      {
        event: 'stage:complete',
        stage: 'build',
        taskId: 'task-456',
        outcome: 'completed',
        duration: 5000,
      },
      '✅ Completed stage: build (completed)',
    )
  })
})

describe('logStageSkip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log stage skip without reason', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logStageSkip('docs', 'task-123')
    expect(logger.info).toHaveBeenCalledWith(
      { event: 'stage:skip', stage: 'docs', taskId: 'task-123', reason: undefined },
      '⏭ Skipped stage: docs',
    )
  })

  it('should log stage skip with reason', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logStageSkip('test', 'task-456', 'Complexity below threshold')
    expect(logger.info).toHaveBeenCalledWith(
      {
        event: 'stage:skip',
        stage: 'test',
        taskId: 'task-456',
        reason: 'Complexity below threshold',
      },
      '⏭ Skipped stage: test (Complexity below threshold)',
    )
  })
})

describe('logStageFail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log stage failure without error', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logStageFail('build', 'task-123')
    expect(logger.error).toHaveBeenCalledWith(
      {
        event: 'stage:fail',
        stage: 'build',
        taskId: 'task-123',
        error: undefined,
        retry: undefined,
      },
      '❌ Failed stage: build',
    )
  })

  it('should log stage failure with error message', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logStageFail('verify', 'task-456', 'TypeScript errors')
    expect(logger.error).toHaveBeenCalledWith(
      {
        event: 'stage:fail',
        stage: 'verify',
        taskId: 'task-456',
        error: 'TypeScript errors',
        retry: undefined,
      },
      '❌ Failed stage: verify - TypeScript errors',
    )
  })

  it('should log stage failure with retry hint', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logStageFail('build', 'task-789', 'Compilation failed', true)
    expect(logger.error).toHaveBeenCalledWith(
      {
        event: 'stage:fail',
        stage: 'build',
        taskId: 'task-789',
        error: 'Compilation failed',
        retry: true,
      },
      '❌ Failed stage: build - Compilation failed (will retry)',
    )
  })
})

describe('logStageRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log stage retry', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logStageRetry('build', 'task-123', 2, 3)
    expect(logger.warn).toHaveBeenCalledWith(
      { event: 'stage:retry', stage: 'build', taskId: 'task-123', attempt: 2, maxRetries: 3 },
      '🔄 Retrying stage: build (attempt 2/3)',
    )
  })
})

describe('logPipelineStart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log pipeline start', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logPipelineStart('task-123', 'spec', 'standard')
    expect(logger.info).toHaveBeenCalledWith(
      { event: 'pipeline:start', taskId: 'task-123', mode: 'spec', profile: 'standard' },
      '🚀 Pipeline started: task-123 (spec, standard)',
    )
  })
})

describe('logPipelineComplete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log pipeline completion without duration', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logPipelineComplete('task-123')
    expect(logger.info).toHaveBeenCalledWith(
      { event: 'pipeline:complete', taskId: 'task-123', duration: undefined, totalCost: undefined },
      '✅ Pipeline completed: task-123',
    )
  })

  it('should log pipeline completion with duration', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logPipelineComplete('task-456', 60000)
    expect(logger.info).toHaveBeenCalledWith(
      { event: 'pipeline:complete', taskId: 'task-456', duration: 60000, totalCost: undefined },
      '✅ Pipeline completed: task-456 (60000ms)',
    )
  })

  it('should log pipeline completion with duration and cost', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logPipelineComplete('task-789', 120000, 0.5)
    expect(logger.info).toHaveBeenCalledWith(
      { event: 'pipeline:complete', taskId: 'task-789', duration: 120000, totalCost: 0.5 },
      '✅ Pipeline completed: task-789 (120000ms)',
    )
  })
})

describe('logGateWait', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log gate wait', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logGateWait('quality', 'task-123')
    expect(logger.info).toHaveBeenCalledWith(
      { event: 'gate:wait', gate: 'quality', taskId: 'task-123' },
      '⏸ Waiting for gate: quality',
    )
  })
})

describe('logRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log recovery action', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logRecovery('stale-stage-recovery', 'task-123', 'Reset stale running stages')
    expect(logger.info).toHaveBeenCalledWith(
      {
        event: 'recovery:triggered',
        stage: 'stale-stage-recovery',
        taskId: 'task-123',
        reason: 'Reset stale running stages',
      },
      '🔧 Recovery triggered: stale-stage-recovery - Reset stale running stages',
    )
  })
})

describe('logPostAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log post-action start', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logPostAction('commit-task-files', 'task-123', 'start')
    expect(logger.info).toHaveBeenCalledWith(
      {
        event: 'post-action:start',
        actionType: 'commit-task-files',
        taskId: 'task-123',
        error: undefined,
      },
      '▶ Post-action [commit-task-files]: start',
    )
  })

  it('should log post-action complete', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logPostAction('validate-task-json', 'task-456', 'complete')
    expect(logger.info).toHaveBeenCalledWith(
      {
        event: 'post-action:complete',
        actionType: 'validate-task-json',
        taskId: 'task-456',
        error: undefined,
      },
      '✅ Post-action [validate-task-json]: complete',
    )
  })

  it('should log post-action fail with error', async () => {
    const { logger } = await import('../../../../scripts/cody/logger')
    logPostAction('check-gate', 'task-789', 'fail', 'Gate rejected')
    expect(logger.error).toHaveBeenCalledWith(
      {
        event: 'post-action:fail',
        actionType: 'check-gate',
        taskId: 'task-789',
        error: 'Gate rejected',
      },
      '❌ Post-action [check-gate]: fail - Gate rejected',
    )
  })
})
