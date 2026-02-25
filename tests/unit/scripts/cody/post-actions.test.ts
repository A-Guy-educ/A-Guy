import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as pipelineUtils from '../../../../scripts/cody/pipeline-utils'

vi.mock('../../../../scripts/cody/pipeline-utils', () => ({
  readTask: vi.fn(),
  resolvePipelineProfile: vi.fn(() => 'lightweight'),
  stageOutputFile: vi.fn((taskDir: string, stage: string) => `${taskDir}/${stage}.json`),
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
  })
})
