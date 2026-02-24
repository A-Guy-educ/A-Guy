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

      // Should be: architect, build, commit, verify, pr (5 stages)
      expect(pipeline).toHaveLength(5)
    })

    it('returns stages in correct order', async () => {
      const { getImplPipeline } = await import('../../../../scripts/cody/pipeline-utils')

      const pipeline = getImplPipeline('lightweight')

      expect(pipeline).toEqual(['architect', 'build', 'commit', 'verify', 'pr'])
    })

    it('does not include plan-gap', async () => {
      const { getImplPipeline, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const pipeline = getImplPipeline('lightweight')
      const flatNames = flattenPipeline(pipeline)

      expect(flatNames).not.toContain('plan-gap')
    })

    it('does not include auditor', async () => {
      const { getImplPipeline, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const pipeline = getImplPipeline('lightweight')
      const flatNames = flattenPipeline(pipeline)

      expect(flatNames).not.toContain('auditor')
    })

    it('does not include apply-audit', async () => {
      const { getImplPipeline, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const pipeline = getImplPipeline('lightweight')
      const flatNames = flattenPipeline(pipeline)

      expect(flatNames).not.toContain('apply-audit')
    })
  })

  describe('LIGHTWEIGHT_IMPL_PIPELINE constant', () => {
    it('flattens to 5 stage names', async () => {
      const { LIGHTWEIGHT_IMPL_PIPELINE, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const flatNames = flattenPipeline(LIGHTWEIGHT_IMPL_PIPELINE)

      expect(flatNames).toHaveLength(5)
    })

    it('contains architect, build, commit, verify, pr', async () => {
      const { LIGHTWEIGHT_IMPL_PIPELINE, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const flatNames = flattenPipeline(LIGHTWEIGHT_IMPL_PIPELINE)

      expect(flatNames).toContain('architect')
      expect(flatNames).toContain('build')
      expect(flatNames).toContain('commit')
      expect(flatNames).toContain('verify')
      expect(flatNames).toContain('pr')
    })

    it('does not contain plan-gap, auditor, or apply-audit', async () => {
      const { LIGHTWEIGHT_IMPL_PIPELINE, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const flatNames = flattenPipeline(LIGHTWEIGHT_IMPL_PIPELINE)

      expect(flatNames).not.toContain('plan-gap')
      expect(flatNames).not.toContain('auditor')
      expect(flatNames).not.toContain('apply-audit')
    })
  })
})

describe('standard pipeline integration', () => {
  describe('resolvePipelineProfile for standard tasks', () => {
    it('returns standard for implement_feature', async () => {
      const { resolvePipelineProfile } = await import('../../../../scripts/cody/pipeline-utils')

      const taskDef = createTaskDef('implement_feature', 'low')

      expect(resolvePipelineProfile(taskDef)).toBe('standard')
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

      expect(flatNames).toContain('plan-gap')
    })

    it('includes auditor', async () => {
      const { getImplPipeline, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const pipeline = getImplPipeline('standard')
      const flatNames = flattenPipeline(pipeline)

      expect(flatNames).toContain('auditor')
    })

    it('includes apply-audit', async () => {
      const { getImplPipeline, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const pipeline = getImplPipeline('standard')
      const flatNames = flattenPipeline(pipeline)

      expect(flatNames).toContain('apply-audit')
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
    it('flattens to 8 stage names (including parallel groups)', async () => {
      const { IMPL_PIPELINE, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const flatNames = flattenPipeline(IMPL_PIPELINE)

      // Should be: architect, plan-gap, build, commit, verify, auditor, apply-audit, pr (8 stages)
      expect(flatNames).toHaveLength(8)
    })

    it('contains all heavyweight stages', async () => {
      const { IMPL_PIPELINE, flattenPipeline } =
        await import('../../../../scripts/cody/pipeline-utils')

      const flatNames = flattenPipeline(IMPL_PIPELINE)

      expect(flatNames).toContain('plan-gap')
      expect(flatNames).toContain('auditor')
      expect(flatNames).toContain('apply-audit')
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

    // Should be: architect, build, commit, verify, pr
    expect(implStages).toEqual(['architect', 'build', 'commit', 'verify', 'pr'])

    // Verify heavyweight stages are NOT included
    expect(implStages).not.toContain('plan-gap')
    expect(implStages).not.toContain('auditor')
    expect(implStages).not.toContain('apply-audit')
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
    expect(implStages).toContain('plan-gap')
    expect(implStages).toContain('auditor')
    expect(implStages).toContain('apply-audit')
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

  it('lightweight skips heavyweight impl stages', async () => {
    const { getImplPipeline, flattenPipeline } =
      await import('../../../../scripts/cody/pipeline-utils')

    const lightweightImplStages = flattenPipeline(getImplPipeline('lightweight'))
    const standardImplStages = flattenPipeline(getImplPipeline('standard'))

    // Lightweight should NOT have plan-gap, auditor, apply-audit
    expect(lightweightImplStages).not.toContain('plan-gap')
    expect(lightweightImplStages).not.toContain('auditor')
    expect(lightweightImplStages).not.toContain('apply-audit')

    // Standard should have all heavyweight stages
    expect(standardImplStages).toContain('plan-gap')
    expect(standardImplStages).toContain('auditor')
    expect(standardImplStages).toContain('apply-audit')
  })
})
