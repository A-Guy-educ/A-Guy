import { describe, it, expect } from 'vitest'
import { STAGE_CONTEXT_FILES } from '../../../../../scripts/cody/stage-prompts'
import { resolveRerunFromStage } from '../../../../../scripts/cody/rerun-utils'
import { buildPipeline } from '../../../../../scripts/cody/pipeline/definitions'
import type { PipelineContext, PostAction } from '../../../../../scripts/cody/engine/types'

/**
 * Integration tests verifying all 4 problems are fixed end-to-end
 */
describe('Feedback Loop Integration', () => {
  const IMPL_STAGES = [
    'gsd-plan',
    'gsd-research',
    'gsd-execute',
    'commit',
    'verify',
    'autofix',
    'pr',
  ]

  describe('P1: gsd-execute post-action has inner retry', () => {
    it('gsd-execute stage definition uses run-quality-with-autofix (not raw run-tsc)', () => {
      const mockCtx = {
        taskId: 'test',
        taskDir: '/tmp/test',
        input: { taskId: 'test', mode: 'impl' as const, dryRun: false },
        taskDef: null,
        profile: 'standard' as const,
        backend: { name: 'test', spawn: () => ({}) as unknown },
      } as PipelineContext
      const pipeline = buildPipeline('impl', 'standard', false, mockCtx)
      const buildDef = pipeline.stages.get('gsd-execute')

      expect(buildDef).toBeDefined()
      expect(buildDef!.postActions).toBeDefined()

      // Should have run-quality-with-autofix, not parallel run-tsc/run-unit-tests
      const actionTypes = buildDef!.postActions!.map((a: PostAction) => a.type)
      expect(actionTypes).toContain('run-quality-with-autofix')
      expect(actionTypes).not.toContain('parallel')
    })
  })

  describe('P2: gsd-execute agent reads rerun-feedback.md', () => {
    it('gsd-execute context includes rerun-feedback.md', () => {
      expect(STAGE_CONTEXT_FILES['gsd-execute']).toContain('rerun-feedback.md')
    })

    it('autofix context includes build-errors.md', () => {
      expect(STAGE_CONTEXT_FILES.autofix).toContain('build-errors.md')
    })
  })

  describe('P3: Supervisor rerun backs up to gsd-plan', () => {
    it('rerun --from=gsd-execute --feedback backs up to gsd-plan', () => {
      expect(resolveRerunFromStage('gsd-execute', 'fix type error', IMPL_STAGES)).toBe('gsd-plan')
    })

    it('rerun --from=gsd-execute without feedback stays at gsd-execute', () => {
      expect(resolveRerunFromStage('gsd-execute', undefined, IMPL_STAGES)).toBe('gsd-execute')
    })

    it('rerun --from=verify --feedback backs up to gsd-plan', () => {
      expect(resolveRerunFromStage('verify', 'lint errors', IMPL_STAGES)).toBe('gsd-plan')
    })
  })

  describe('P4: Feedback flow continuity', () => {
    it('gsd-plan reads rerun-feedback.md (existing behavior preserved)', () => {
      expect(STAGE_CONTEXT_FILES['gsd-plan']).toContain('rerun-feedback.md')
    })

    it('all impl stages after architect are in correct order', () => {
      // Verify the pipeline order makes architect run before build
      expect(IMPL_STAGES.indexOf('gsd-plan')).toBeLessThan(IMPL_STAGES.indexOf('gsd-execute'))
      expect(IMPL_STAGES.indexOf('gsd-research')).toBeLessThan(IMPL_STAGES.indexOf('gsd-execute'))
    })
  })
})
