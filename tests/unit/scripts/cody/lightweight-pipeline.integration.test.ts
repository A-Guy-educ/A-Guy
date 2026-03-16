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
import {
  IMPL_ORDER_STANDARD,
  IMPL_ORDER_LIGHTWEIGHT,
  SPEC_ORDER_STANDARD,
  SPEC_ORDER_LIGHTWEIGHT,
  flattenTypedPipeline,
  type TypedPipelineStep,
} from '../../../../scripts/cody/stages/registry'

// Backward-compat shims for tests that used removed pipeline-utils exports
function getImplPipeline(profile: string): TypedPipelineStep[] {
  return profile === 'lightweight' ? IMPL_ORDER_LIGHTWEIGHT : IMPL_ORDER_STANDARD
}
function _getAllImplStageNames(profile: string): string[] {
  return flattenTypedPipeline(getImplPipeline(profile))
}
function getSpecStagesForProfile(profile: string, clarify: boolean): string[] {
  const order = profile === 'lightweight' ? SPEC_ORDER_LIGHTWEIGHT : SPEC_ORDER_STANDARD
  return clarify ? [...order] : order.filter((s) => s !== 'clarify')
}
function flattenPipeline(steps: TypedPipelineStep[]): string[] {
  return flattenTypedPipeline(steps)
}
const IMPL_PIPELINE = IMPL_ORDER_STANDARD
const LIGHTWEIGHT_IMPL_PIPELINE = IMPL_ORDER_LIGHTWEIGHT

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
      const { SPEC_ORDER_LIGHTWEIGHT } = await import('../../../../scripts/cody/stages/registry')

      // Lightweight without clarify filter
      const stages = SPEC_ORDER_LIGHTWEIGHT.filter((s: string) => s !== 'clarify')

      expect(stages).toEqual(['taskify'])
    })

    it('returns taskify and clarify when clarify is true', async () => {
      const { SPEC_ORDER_LIGHTWEIGHT } = await import('../../../../scripts/cody/stages/registry')

      expect(SPEC_ORDER_LIGHTWEIGHT).toEqual(['taskify', 'clarify'])
    })

    it('does not include spec stage', async () => {
      const { SPEC_ORDER_LIGHTWEIGHT } = await import('../../../../scripts/cody/stages/registry')

      expect(SPEC_ORDER_LIGHTWEIGHT).not.toContain('spec')
    })

    it('does not include gap stage', async () => {
      const { SPEC_ORDER_LIGHTWEIGHT } = await import('../../../../scripts/cody/stages/registry')

      expect(SPEC_ORDER_LIGHTWEIGHT).not.toContain('gap')
    })
  })

  describe('getImplPipeline for lightweight', () => {
    it('returns 7 steps (no duplicate commit in registry)', async () => {
      const pipeline = getImplPipeline('lightweight')

      // architect, build, commit, review, fix, verify, pr
      // No duplicate commit — fix stage commits via post-action
      // test stage deferred to inspector plugin (cody-deferred-tests)
      expect(pipeline).toHaveLength(7)
    })

    it('returns stages in correct order', async () => {
      // Using module-level shims from registry

      const pipeline = getImplPipeline('lightweight')
      const flatNames = flattenPipeline(pipeline)

      // test stage deferred to inspector plugin (cody-deferred-tests)
      expect(flatNames).toEqual(['architect', 'build', 'commit', 'review', 'fix', 'verify', 'pr'])
    })

    it('does not include plan-gap', async () => {
      // Using module-level shims from registry

      const pipeline = getImplPipeline('lightweight')
      const flatNames = flattenPipeline(pipeline)

      expect(flatNames).not.toContain('plan-gap')
    })

    it('does not include autofix as separate stage (it is sub-stage of verify)', async () => {
      // Using module-level shims from registry

      const pipeline = getImplPipeline('lightweight')
      const flatNames = flattenPipeline(pipeline)

      expect(flatNames).not.toContain('autofix')
    })
  })

  describe('LIGHTWEIGHT_IMPL_PIPELINE constant', () => {
    it('flattens to 7 stage names', async () => {
      // Using module-level shims from registry

      const flatNames = flattenPipeline(LIGHTWEIGHT_IMPL_PIPELINE)

      // No duplicate commit in registry version; test deferred to inspector
      expect(flatNames).toHaveLength(7)
    })

    it('contains architect, build, commit, review, fix, verify, pr', async () => {
      // Using module-level shims from registry

      const flatNames = flattenPipeline(LIGHTWEIGHT_IMPL_PIPELINE)

      expect(flatNames).toContain('architect')
      expect(flatNames).toContain('build')
      expect(flatNames).toContain('commit')
      expect(flatNames).toContain('review')
      expect(flatNames).toContain('fix')
      expect(flatNames).toContain('verify')
      expect(flatNames).toContain('pr')
      // test deferred to inspector; docs deferred to inspector; reflect removed
      expect(flatNames).not.toContain('test')
      expect(flatNames).not.toContain('docs')
      expect(flatNames).not.toContain('reflect')
    })

    it('does not contain plan-gap or autofix', async () => {
      // Using module-level shims from registry

      const flatNames = flattenPipeline(LIGHTWEIGHT_IMPL_PIPELINE)

      expect(flatNames).not.toContain('plan-gap')
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
    it('returns taskify, gap when clarify is false', async () => {
      // Using module-level shims from registry

      const stages = getSpecStagesForProfile('standard', false)

      expect(stages).toEqual(['taskify', 'gap'])
    })

    it('returns taskify, gap, clarify when clarify is true', async () => {
      // Using module-level shims from registry

      const stages = getSpecStagesForProfile('standard', true)

      expect(stages).toEqual(['taskify', 'gap', 'clarify'])
    })
  })

  describe('getImplPipeline for standard', () => {
    it('includes plan-gap', async () => {
      // Using module-level shims from registry

      const pipeline = getImplPipeline('standard')
      const flatNames = flattenPipeline(pipeline)

      expect(flatNames).toContain('plan-gap')
    })

    it('does not include autofix as separate stage (it is sub-stage of verify)', async () => {
      // Using module-level shims from registry

      const pipeline = getImplPipeline('standard')
      const flatNames = flattenPipeline(pipeline)

      expect(flatNames).not.toContain('autofix')
    })

    it('has more stages than lightweight', async () => {
      // Using module-level shims from registry

      const standardPipeline = getImplPipeline('standard')
      const lightweightPipeline = getImplPipeline('lightweight')

      const standardFlat = flattenPipeline(standardPipeline)
      const lightweightFlat = flattenPipeline(lightweightPipeline)

      expect(standardFlat.length).toBeGreaterThan(lightweightFlat.length)
    })
  })

  describe('IMPL_PIPELINE constant', () => {
    it('flattens to 8 stage names', async () => {
      // Using module-level shims from registry

      const flatNames = flattenPipeline(IMPL_PIPELINE)

      // 8 stages (no duplicate commit in registry; test deferred to inspector)
      expect(flatNames).toHaveLength(8)
    })

    it('contains all heavyweight stages', async () => {
      // Using module-level shims from registry

      const flatNames = flattenPipeline(IMPL_PIPELINE)

      expect(flatNames).toContain('plan-gap')
      expect(flatNames).not.toContain('autofix')
    })
  })
})

describe('end-to-end pipeline selection', () => {
  it('low-risk fix_bug gets lightweight pipeline with correct stages', async () => {
    const { resolvePipelineProfile } = await import('../../../../scripts/cody/pipeline-utils')

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

    // No duplicate commit in registry version; test deferred to inspector
    expect(implStages).toEqual(['architect', 'build', 'commit', 'review', 'fix', 'verify', 'pr'])

    // Only plan-gap is skipped in lightweight
    expect(implStages).not.toContain('plan-gap')
  })

  it('implement_feature gets standard pipeline with all stages', async () => {
    const { resolvePipelineProfile } = await import('../../../../scripts/cody/pipeline-utils')

    // Step 1: Profile selection
    const taskDef = createTaskDef('implement_feature', 'medium')
    const profile = resolvePipelineProfile(taskDef)

    expect(profile).toBe('standard')

    // Step 2: Get spec stages
    const specStages = getSpecStagesForProfile(profile, false)
    expect(specStages).toEqual(['taskify', 'gap'])

    // Step 3: Get impl pipeline
    const implPipeline = getImplPipeline(profile)
    const implStages = flattenPipeline(implPipeline)

    // Should contain heavyweight stages
    expect(implStages).toContain('plan-gap')
    expect(implStages).not.toContain('autofix')
  })

  it('lightweight skips spec and gap stages', async () => {
    const lightweightSpecStages = getSpecStagesForProfile('lightweight', false)
    const standardSpecStages = getSpecStagesForProfile('standard', false)

    // Lightweight should NOT have spec or gap
    expect(lightweightSpecStages).not.toContain('spec')
    expect(lightweightSpecStages).not.toContain('gap')

    // Standard should have gap (spec merged into gap)
    expect(standardSpecStages).toContain('gap')
  })

  it('lightweight skips heavyweight spec/planning stages but not autofix (sub-stage of verify)', async () => {
    const lightweightImplStages = flattenPipeline(getImplPipeline('lightweight'))
    const standardImplStages = flattenPipeline(getImplPipeline('standard'))

    // Lightweight should NOT have plan-gap (planning overhead)
    expect(lightweightImplStages).not.toContain('plan-gap')

    // Autofix is a sub-stage of verify, not a separate pipeline stage
    expect(lightweightImplStages).not.toContain('autofix')

    // Standard should have all stages including plan-gap
    expect(standardImplStages).toContain('plan-gap')
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
    expect(flatOrder).toContain('gap')

    // Should also contain impl stages (to run after taskify)
    expect(flatOrder).toContain('architect')
    expect(flatOrder).toContain('build')
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
    expect(flatOrder).toContain('plan-gap')
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
    expect(flatOrder).not.toContain('plan-gap')

    // But should still include both spec and impl stages
    expect(flatOrder).toContain('taskify')
    expect(flatOrder).toContain('build')
    expect(flatOrder).toContain('pr')
  })
})
