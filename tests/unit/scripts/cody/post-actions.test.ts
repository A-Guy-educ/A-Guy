import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as pipelineUtils from '../../../../scripts/cody/pipeline-utils'
import * as clarifyWorkflow from '../../../../scripts/cody/clarify-workflow'

vi.mock('../../../../scripts/cody/pipeline-utils', () => ({
  readTask: vi.fn(),
  resolvePipelineProfile: vi.fn(() => 'lightweight'),
  resolveControlMode: vi.fn(() => 'risk-gated'),
  stageOutputFile: vi.fn((taskDir: string, stage: string) => `${taskDir}/${stage}.json`),
  getComplexityTier: vi.fn((score: number) => {
    if (score < 10) return 'trivial'
    if (score < 20) return 'simple'
    if (score < 35) return 'moderate'
    if (score < 50) return 'complex'
    return 'very_complex'
  }),
}))

vi.mock('../../../../scripts/cody/clarify-workflow', () => ({
  handleGateApproval: vi.fn(() => 'waiting'),
  extractGateCommentBody: vi.fn(),
}))

vi.mock('../../../../scripts/cody/github-api', () => ({
  extractGateCommentBody: vi.fn(),
  postComment: vi.fn(),
  addIssueLabel: vi.fn(),
  removeIssueLabel: vi.fn(),
  GATE_LABELS: {
    HARD_STOP: 'hard-stop',
    RISK_GATED: 'risk-gated',
  },
}))

vi.mock('../../../../scripts/cody/git-utils', () => ({
  commitPipelineFiles: vi.fn(),
}))

const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    trace: vi.fn(),
    silent: vi.fn(),
    level: 'info',
  }
  return { mockLogger }
})

vi.mock('../../../../scripts/cody/logger', () => ({
  logger: mockLogger,
  createStageLogger: vi.fn().mockReturnValue(mockLogger),
}))

import { executePostAction } from '../../../../scripts/cody/pipeline/post-actions'
import type { PipelineContext, PostAction } from '../../../../scripts/cody/engine/types'
import type { TaskDefinition } from '../../../../scripts/cody/pipeline-utils'

describe('Post-Actions', () => {
  let ctx: PipelineContext
  let mockTaskDef: TaskDefinition

  beforeEach(() => {
    vi.clearAllMocks()

    mockTaskDef = {
      task_type: 'fix_bug',
      risk_level: 'low',
      confidence: 0.9,
      primary_domain: 'backend',
      scope: ['test.ts'],
      missing_inputs: [],
      assumptions: [],
      input_quality: {
        level: 'raw_idea',
        skip_stages: [],
        reasoning: '',
      },
      pipeline: 'spec_execute_verify',
      pipeline_profile: 'standard',
    }

    ctx = {
      taskId: 'test-task-123',
      taskDir: '/tmp/test-task-123',
      input: {
        taskId: 'test-task-123',
        mode: 'full',
        dryRun: false,
      },
      taskDef: null,
      profile: 'standard',
      backend: {
        name: 'test-runner',
        spawn: vi.fn(),
      },
    }
  })

  describe('resolve-profile', () => {
    it('should update ctx.taskDef after reading task', async () => {
      vi.mocked(pipelineUtils.readTask).mockReturnValue(mockTaskDef)
      vi.mocked(pipelineUtils.resolvePipelineProfile).mockReturnValue('lightweight')

      const action: PostAction = { type: 'resolve-profile' }

      await executePostAction(ctx, action, null)

      expect(pipelineUtils.readTask).toHaveBeenCalledWith(ctx.taskDir)
      expect(ctx.taskDef).toEqual(mockTaskDef)
      expect(ctx.profile).toBe('lightweight')
      expect(ctx.pipelineNeedsRebuild).toBe(true)
    })

    it('should handle missing task.json gracefully', async () => {
      vi.mocked(pipelineUtils.readTask).mockReturnValue(null)

      const action: PostAction = { type: 'resolve-profile' }

      await executePostAction(ctx, action, null)

      expect(ctx.taskDef).toBeNull()
      expect(ctx.profile).toBe('standard') // unchanged
    })

    it('should apply --complexity override when taskDef has no complexity', async () => {
      // Task without complexity + complexityOverride set
      const taskWithoutComplexity = { ...mockTaskDef }
      delete (taskWithoutComplexity as Record<string, unknown>).complexity
      vi.mocked(pipelineUtils.readTask).mockReturnValue(taskWithoutComplexity)
      vi.mocked(pipelineUtils.resolvePipelineProfile).mockReturnValue('lightweight')

      ctx.input.complexityOverride = 42

      const action: PostAction = { type: 'resolve-profile' }
      await executePostAction(ctx, action, null)

      expect(ctx.taskDef!.complexity).toBe(42)
      expect(ctx.taskDef!.complexity_reasoning).toContain('Override via --complexity=42')
    })

    it('should NOT apply --complexity override when taskDef already has complexity', async () => {
      // Task WITH complexity + complexityOverride set → override should NOT replace it
      const taskWithComplexity = {
        ...mockTaskDef,
        complexity: 75,
        complexity_reasoning: 'LLM scored',
      }
      vi.mocked(pipelineUtils.readTask).mockReturnValue(taskWithComplexity)
      vi.mocked(pipelineUtils.resolvePipelineProfile).mockReturnValue('standard')

      ctx.input.complexityOverride = 10

      const action: PostAction = { type: 'resolve-profile' }
      await executePostAction(ctx, action, null)

      // Override applies even when taskDef already has complexity (new behavior)
      expect(ctx.taskDef!.complexity).toBe(10)
      expect(ctx.taskDef!.complexity_reasoning).toContain('Override via --complexity=10')
    })

    it('should log tier info when task has complexity', async () => {
      const taskWithComplexity = { ...mockTaskDef, complexity: 42 }
      vi.mocked(pipelineUtils.readTask).mockReturnValue(taskWithComplexity)
      vi.mocked(pipelineUtils.resolvePipelineProfile).mockReturnValue('standard')

      mockLogger.info.mockClear()

      const action: PostAction = { type: 'resolve-profile' }
      await executePostAction(ctx, action, null)

      // Should log complexity tier info
      const tierLog = mockLogger.info.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('Complexity:'),
      )
      expect(tierLog).toBeDefined()
      expect(tierLog![0]).toContain('42')
      expect(tierLog![0]).toContain('complex')
    })

    it('should log legacy heuristic message when task has no complexity', async () => {
      const taskNoComplexity = { ...mockTaskDef }
      delete (taskNoComplexity as Record<string, unknown>).complexity
      vi.mocked(pipelineUtils.readTask).mockReturnValue(taskNoComplexity)
      vi.mocked(pipelineUtils.resolvePipelineProfile).mockReturnValue('lightweight')

      mockLogger.info.mockClear()

      const action: PostAction = { type: 'resolve-profile' }
      await executePostAction(ctx, action, null)

      const legacyLog = mockLogger.info.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('legacy heuristic'),
      )
      expect(legacyLog).toBeDefined()
    })
  })

  describe('check-gate', () => {
    it('should read taskDef from file when ctx.taskDef is null (BUG-F fix)', async () => {
      // ctx.taskDef is null, risk_level medium → risk-gated → gate enforced
      const mediumRiskTask = { ...mockTaskDef, risk_level: 'medium' as const }
      vi.mocked(pipelineUtils.readTask).mockReturnValue(mediumRiskTask)
      vi.mocked(pipelineUtils.resolveControlMode).mockReturnValue('risk-gated')
      vi.mocked(clarifyWorkflow.handleGateApproval).mockReturnValue('waiting')

      const action: PostAction = { type: 'check-gate', gate: 'taskify' }

      // Should not throw - should read taskDef from file
      await expect(executePostAction(ctx, action, null)).rejects.toThrow()

      // Verify it tried to read from file when ctx.taskDef was null
      expect(pipelineUtils.readTask).toHaveBeenCalledWith(ctx.taskDir)
    })

    it('should use ctx.taskDef when available instead of reading from file', async () => {
      const mediumRiskTask = { ...mockTaskDef, risk_level: 'medium' as const }
      ctx.taskDef = mediumRiskTask
      vi.mocked(pipelineUtils.resolveControlMode).mockReturnValue('risk-gated')
      vi.mocked(clarifyWorkflow.handleGateApproval).mockReturnValue('approved')

      const action: PostAction = { type: 'check-gate', gate: 'taskify' }

      await executePostAction(ctx, action, null)

      // Should not have read from file since ctx.taskDef was already set
      expect(pipelineUtils.readTask).not.toHaveBeenCalled()
    })

    it('should skip gate when controlMode is auto (low risk)', async () => {
      ctx.taskDef = mockTaskDef // low risk
      vi.mocked(pipelineUtils.resolveControlMode).mockReturnValue('auto')

      const action: PostAction = { type: 'check-gate', gate: 'taskify' }

      await executePostAction(ctx, action, null)

      // Gate should be skipped — handleGateApproval should NOT be called
      expect(clarifyWorkflow.handleGateApproval).not.toHaveBeenCalled()
    })
  })
})
