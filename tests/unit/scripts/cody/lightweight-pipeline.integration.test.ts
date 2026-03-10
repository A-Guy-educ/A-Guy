/**
 * Integration tests for lightweight vs standard pipeline behavior
 *
 * These tests verify the end-to-end pipeline selection logic:
 * - resolvePipelineProfile determines which pipeline to use based on task definition
 * - getSpecStagesForProfile returns the correct spec phase stages
 * - getImplPipeline returns the correct impl phase stages
 * - flattenPipeline correctly flattens stage arrays including parallel groups
 *
 * @domain cody/pipeline
 * @pattern pipeline-profile-selection
 */
import { describe, it, expect } from 'vitest'
import type { TaskDefinition } from '../../../../scripts/cody/pipeline-utils'

// Helper to create minimal TaskDefinition for pipeline profile tests
function createTaskDef(
  taskType:
    | 'fix_bug'
    | 'refactor'
    | 'ops'
    | 'implement_feature'
    | 'docs'
    | 'research'
    | 'spec_only',
  riskLevel: 'low' | 'medium' | 'high',
  pipelineProfile?: 'lightweight' | 'standard',
): TaskDefinition {
  return {
    task_type: taskType,
    pipeline:
      taskType === 'spec_only' || taskType === 'docs' || taskType === 'research'
        ? 'spec_only'
        : 'spec_execute_verify',
    risk_level: riskLevel,
    confidence: 0.9,
    primary_domain: 'backend',
    scope: ['src/app'],
    missing_inputs: [],
    assumptions: [],
    ...(pipelineProfile && { pipeline_profile: pipelineProfile }),
  }
}

describe('lightweight pipeline integration', () => {
  describe('resolvePipelineProfile for low-risk tasks', () => {
    it('returns lightweight for low-risk fix_bug', async () => {
      const { resolvePipelineProfile } = await import('../../../../scripts/cody/pipeline-utils')

      const taskDef = createTaskDef('fix_bug', 'low')

      expect(resolvePipelineProfile(taskDef)).toBe('lightweight')
    })

    it('returns lightweight for low-risk refactor', async () => {
      const { resolvePipelineProfile } = await import('../../../../scripts/cody/pipeline-utils')

      const taskDef = createTaskDef('refactor', 'low')

      expect(resolvePipelineProfile(taskDef)).toBe('lightweight')
    })

    it('returns lightweight for low-risk ops', async () => {
      const { resolvePipelineProfile } = await import('../../../../scripts/cody/pipeline-utils')

      const taskDef = createTaskDef('ops', 'low')

      expect(resolvePipelineProfile(taskDef)).toBe('lightweight')
    })
  })

  describe('getSpecStagesForProfile for lightweight', () => {
    it('returns only taskify when clarify is false', async () => {
      const { getSpecStagesForProfile } = await import('../../../../scripts/cody/pipeline-utils')

      const stages = getSpecStagesForProfile('lightweight', false)

      expect(stages).toEqual(['taskify'])
    })

    it('returns taskify and clarify when clarify is true', async () => {
      const { getSpecStagesForProfile } = await import('../../../../scripts/cody/pipeline-utils')

      const stages = getSpecStagesForProfile('lightweight', true)

      expect(stages).toEqual(['taskify', 'clarify'])
    })

    it('does not include spec stage', async () => {
      const { getSpecStagesForProfile } = await import('../../../../scripts/cody/pipeline-utils')

      const stages = getSpecStagesForProfile('lightweight', false)

      expect(stages).not.toContain('spec')
    })

    it('does not include gap stage', async () => {
      const { getSpecStagesForProfile } = await import('../../../../scripts/cody/pipeline-utils')

      const stages = getSpecStagesForProfile('lightweight', false)

      expect(stages).not.toContain('gap')
    })
  })

  describe('getImplPipeline for lightweight', () => {
    it('returns exactly 5 stages', async () => {
      const { getImplPipeline } = await import('../../../../scripts/cody/pipeline-utils')

      const pipeline = getImplPipeline('lightweight')

      // Should be: architect, build, commit, review, fix, commit-fix, verify, pr (8 stages)
      expect(pipeline).toHaveLength(8)
    })

    it('returns stages in correct order', async () => {
      const { getImplPipeline, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const pipeline = getImplPipeline('lightweight')
      const flatNames = flattenPipeline(pipeline)

      expect(flatNames).toEqual([
        'gsd-plan',
        'gsd-execute',
        'commit',
        'review',
        'fix',
        'commit-fix',
        'verify',
        'pr',
      ])
    })

    it('does not include plan-gap', async () => {
      const { getImplPipeline, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const pipeline = getImplPipeline('lightweight')
      const flatNames = flattenPipeline(pipeline)

      expect(flatNames).not.toContain('gsd-research')
    })

    it('does not include autofix as separate stage (it is sub-stage of verify)', async () => {
      const { getImplPipeline, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const pipeline = getImplPipeline('lightweight')
      const flatNames = flattenPipeline(pipeline)

      expect(flatNames).not.toContain('autofix')
    })
  })

  describe('LIGHTWEIGHT_IMPL_PIPELINE constant', () => {
    it('flattens to 5 stage names', async () => {
      const { LIGHTWEIGHT_IMPL_PIPELINE, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const flatNames = flattenPipeline(LIGHTWEIGHT_IMPL_PIPELINE)

      expect(flatNames).toHaveLength(8)
    })

    it('contains architect, build, commit, review, fix, commit-fix, verify, pr', async () => {
      const { LIGHTWEIGHT_IMPL_PIPELINE, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const flatNames = flattenPipeline(LIGHTWEIGHT_IMPL_PIPELINE)

      expect(flatNames).toContain('gsd-plan')
      expect(flatNames).toContain('gsd-execute')
      expect(flatNames).toContain('commit')
      expect(flatNames).toContain('review')
      expect(flatNames).toContain('fix')
      expect(flatNames).toContain('commit-fix')
      expect(flatNames).toContain('verify')
      expect(flatNames).toContain('pr')
    })

    it('does not contain plan-gap or autofix', async () => {
      const { LIGHTWEIGHT_IMPL_PIPELINE, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const flatNames = flattenPipeline(LIGHTWEIGHT_IMPL_PIPELINE)

      expect(flatNames).not.toContain('gsd-research')
      expect(flatNames).not.toContain('autofix')
    })
  })
})

describe('standard pipeline integration', () => {
  describe('resolvePipelineProfile for standard tasks', () => {
    it('returns lightweight for low-risk implement_feature', async () => {
      const { resolvePipelineProfile } = await import('../../../../scripts/cody/pipeline-utils')

      const taskDef = createTaskDef('implement_feature', 'low')

      expect(resolvePipelineProfile(taskDef)).toBe('lightweight')
    })

    it('returns standard for medium-risk tasks', async () => {
      const { resolvePipelineProfile } = await import('../../../../scripts/cody/pipeline-utils')

      const taskDef = createTaskDef('fix_bug', 'medium')

      expect(resolvePipelineProfile(taskDef)).toBe('standard')
    })

    it('returns standard for high-risk tasks', async () => {
      const { resolvePipelineProfile } = await import('../../../../scripts/cody/pipeline-utils')

      const taskDef = createTaskDef('fix_bug', 'high')

      expect(resolvePipelineProfile(taskDef)).toBe('standard')
    })
  })

  describe('getSpecStagesForProfile for standard', () => {
    it('returns taskify, spec, gap when clarify is false', async () => {
      const { getSpecStagesForProfile } = await import('../../../../scripts/cody/pipeline-utils')

      const stages = getSpecStagesForProfile('standard', false)

      expect(stages).toEqual(['taskify', 'spec', 'gap'])
    })

    it('returns taskify, spec, gap, clarify when clarify is true', async () => {
      const { getSpecStagesForProfile } = await import('../../../../scripts/cody/pipeline-utils')

      const stages = getSpecStagesForProfile('standard', true)

      expect(stages).toEqual(['taskify', 'spec', 'gap', 'clarify'])
    })
  })

  describe('getImplPipeline for standard', () => {
    it('includes plan-gap', async () => {
      const { getImplPipeline, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const pipeline = getImplPipeline('standard')
      const flatNames = flattenPipeline(pipeline)

      expect(flatNames).toContain('gsd-research')
    })

    it('does not include autofix as separate stage (it is sub-stage of verify)', async () => {
      const { getImplPipeline, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const pipeline = getImplPipeline('standard')
      const flatNames = flattenPipeline(pipeline)

      expect(flatNames).not.toContain('autofix')
    })

    it('has more stages than lightweight', async () => {
      const { getImplPipeline, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const standardPipeline = getImplPipeline('standard')
      const lightweightPipeline = getImplPipeline('lightweight')

      const standardFlat = flattenPipeline(standardPipeline)
      const lightweightFlat = flattenPipeline(lightweightPipeline)

      expect(standardFlat.length).toBeGreaterThan(lightweightFlat.length)
    })
  })

  describe('IMPL_PIPELINE constant', () => {
    it('flattens to 6 stage names', async () => {
      const { IMPL_PIPELINE, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const flatNames = flattenPipeline(IMPL_PIPELINE)

      // Should be: architect, plan-gap, build, commit, review, fix, commit-fix, verify, pr (9 stages)
      expect(flatNames).toHaveLength(9)
    })

    it('contains all heavyweight stages', async () => {
      const { IMPL_PIPELINE, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const flatNames = flattenPipeline(IMPL_PIPELINE)

      expect(flatNames).toContain('gsd-research')
      expect(flatNames).not.toContain('autofix')
    })
  })
})

describe('end-to-end pipeline selection', () => {
  it('low-risk fix_bug gets lightweight pipeline with correct stages', async () => {
    const { resolvePipelineProfile, getImplPipeline, getSpecStagesForProfile, flattenPipeline } =
      await import('../../../../scripts/cody/pipeline-utils')

    // Step 1: Profile selection
    const taskDef = createTaskDef('fix_bug', 'low')
    const profile = resolvePipelineProfile(taskDef)

    expect(profile).toBe('lightweight')

    // Step 2: Get spec stages
    const specStages = getSpecStagesForProfile(profile, false)
    expect(specStages).toEqual(['taskify'])

    // Step 3: Get impl pipeline
    const implPipeline = getImplPipeline(profile)
    const implStages = flattenPipeline(implPipeline)

    // Should be: architect, build, commit, review, fix, commit-fix, verify, pr
    expect(implStages).toEqual([
      'gsd-plan',
      'gsd-execute',
      'commit',
      'review',
      'fix',
      'commit-fix',
      'verify',
      'pr',
    ])

    // Only plan-gap is skipped in lightweight
    expect(implStages).not.toContain('gsd-research')
  })

  it('implement_feature gets standard pipeline with all stages', async () => {
    const { resolvePipelineProfile, getImplPipeline, getSpecStagesForProfile, flattenPipeline } =
      await import('../../../../scripts/cody/pipeline-utils')

    // Step 1: Profile selection
    const taskDef = createTaskDef('implement_feature', 'medium')
    const profile = resolvePipelineProfile(taskDef)

    expect(profile).toBe('standard')

    // Step 2: Get spec stages
    const specStages = getSpecStagesForProfile(profile, false)
    expect(specStages).toEqual(['taskify', 'spec', 'gap'])

    // Step 3: Get impl pipeline
    const implPipeline = getImplPipeline(profile)
    const implStages = flattenPipeline(implPipeline)

    // Should contain heavyweight stages
    expect(implStages).toContain('gsd-research')
    expect(implStages).not.toContain('autofix')
  })

  it('lightweight skips spec and gap stages', async () => {
    const { getSpecStagesForProfile } = await import('../../../../scripts/cody/pipeline-utils')

    const lightweightSpecStages = getSpecStagesForProfile('lightweight', false)
    const standardSpecStages = getSpecStagesForProfile('standard', false)

    // Lightweight should NOT have spec or gap
    expect(lightweightSpecStages).not.toContain('spec')
    expect(lightweightSpecStages).not.toContain('gap')

    // Standard should have spec and gap
    expect(standardSpecStages).toContain('spec')
    expect(standardSpecStages).toContain('gap')
  })

  it('lightweight skips heavyweight spec/planning stages but not autofix (sub-stage of verify)', async () => {
    const { getImplPipeline, flattenPipeline } =
      await import('../../../../scripts/cody/pipeline-utils')

    const lightweightImplStages = flattenPipeline(getImplPipeline('lightweight'))
    const standardImplStages = flattenPipeline(getImplPipeline('standard'))

    // Lightweight should NOT have plan-gap (planning overhead)
    expect(lightweightImplStages).not.toContain('gsd-research')

    // Autofix is a sub-stage of verify, not a separate pipeline stage
    expect(lightweightImplStages).not.toContain('autofix')

    // Standard should have all stages including plan-gap
    expect(standardImplStages).toContain('gsd-research')
    expect(standardImplStages).not.toContain('autofix')
  })
})

describe('rebuildPipelineAfterTaskify', () => {
  it('should return full pipeline with both spec and impl stages', async () => {
    const { rebuildPipelineAfterTaskify } =
      await import('../../../../scripts/cody/pipeline/definitions')
    const { flattenPipelineOrder } = await import('../../../../scripts/cody/pipeline/definitions')

    // Create mock context with required fields
    const mockCtx = {
      taskId: 'test-task',
      taskDir: '/tmp/test',
      taskDef: createTaskDef('implement_feature', 'medium'),
      profile: 'standard' as const,
      backend: {
        name: 'test',
        spawn: () => {
          throw new Error('not implemented')
        },
      } as unknown as import('../../../../scripts/cody/runner-backend').RunnerBackend,
      input: {
        clarify: false,
        dryRun: false,
        local: false,
        taskId: 'test-task',
        mode: 'full' as const,
        triggerType: 'comment' as const,
      },
    }

    const result = rebuildPipelineAfterTaskify({ stages: new Map(), order: [] }, mockCtx)
    const flatOrder = flattenPipelineOrder(result.order)

    // Should contain spec stages (completed from first phase)
    expect(flatOrder).toContain('taskify')
    expect(flatOrder).toContain('spec')
    expect(flatOrder).toContain('gap')

    // Should also contain impl stages (to run after taskify)
    expect(flatOrder).toContain('gsd-plan')
    expect(flatOrder).toContain('gsd-execute')
    expect(flatOrder).toContain('commit')
    expect(flatOrder).toContain('pr')
  })

  it('should use standard profile for medium-risk implement_feature', async () => {
    const { rebuildPipelineAfterTaskify } =
      await import('../../../../scripts/cody/pipeline/definitions')
    const { flattenPipelineOrder } = await import('../../../../scripts/cody/pipeline/definitions')

    const mockCtx = {
      taskId: 'test-task',
      taskDir: '/tmp/test',
      taskDef: createTaskDef('implement_feature', 'medium'),
      profile: 'standard' as const,
      backend: {
        name: 'test',
        spawn: () => {
          throw new Error('not implemented')
        },
      } as unknown as import('../../../../scripts/cody/runner-backend').RunnerBackend,
      input: {
        clarify: false,
        dryRun: false,
        local: false,
        taskId: 'test-task',
        mode: 'full' as const,
        triggerType: 'comment' as const,
      },
    }

    const result = rebuildPipelineAfterTaskify({ stages: new Map(), order: [] }, mockCtx)
    const flatOrder = flattenPipelineOrder(result.order)

    // Standard profile should include heavyweight stages
    expect(flatOrder).toContain('gsd-research')
  })

  it('should use lightweight profile when specified', async () => {
    const { rebuildPipelineAfterTaskify } =
      await import('../../../../scripts/cody/pipeline/definitions')
    const { flattenPipelineOrder } = await import('../../../../scripts/cody/pipeline/definitions')

    const mockCtx = {
      taskId: 'test-task',
      taskDir: '/tmp/test',
      taskDef: createTaskDef('fix_bug', 'low'),
      profile: 'lightweight' as const,
      backend: {
        name: 'test',
        spawn: () => {
          throw new Error('not implemented')
        },
      } as unknown as import('../../../../scripts/cody/runner-backend').RunnerBackend,
      input: {
        clarify: false,
        dryRun: false,
        local: false,
        taskId: 'test-task',
        mode: 'full' as const,
        triggerType: 'comment' as const,
      },
    }

    const result = rebuildPipelineAfterTaskify({ stages: new Map(), order: [] }, mockCtx)
    const flatOrder = flattenPipelineOrder(result.order)

    // Lightweight should NOT include plan-gap
    expect(flatOrder).not.toContain('gsd-research')

    // But should still include both spec and impl stages
    expect(flatOrder).toContain('taskify')
    expect(flatOrder).toContain('gsd-execute')
    expect(flatOrder).toContain('pr')
  })
})
