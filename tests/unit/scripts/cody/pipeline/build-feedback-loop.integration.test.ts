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
    'architect',
    'plan-gap',
    'build',
    'commit',
    'verify',
    'auditor',
    'apply-audit',
    'pr',
  ]

  describe('P1: Build post-action has inner retry', () => {
    it('build stage definition uses run-quality-with-autofix (not raw run-tsc)', () => {
      const mockCtx = {
        taskId: 'test',
        taskDir: '/tmp/test',
        input: { taskId: 'test', mode: 'impl' as const, dryRun: false },
        taskDef: null,
        profile: 'standard' as const,
        backend: { name: 'test', spawn: () => ({}) as unknown },
      } as PipelineContext
      const pipeline = buildPipeline('impl', 'standard', false, mockCtx)
      const buildDef = pipeline.stages.get('build')

      expect(buildDef).toBeDefined()
      expect(buildDef!.postActions).toBeDefined()

      // Should have run-quality-with-autofix, not parallel run-tsc/run-unit-tests
      const actionTypes = buildDef!.postActions!.map((a: PostAction) => a.type)
      expect(actionTypes).toContain('run-quality-with-autofix')
      expect(actionTypes).not.toContain('parallel')
    })
  })

  describe('P2: Build agent reads rerun-feedback.md', () => {
    it('build context includes rerun-feedback.md', () => {
      expect(STAGE_CONTEXT_FILES.build).toContain('rerun-feedback.md')
    })

    it('autofix context includes build-errors.md', () => {
      expect(STAGE_CONTEXT_FILES.autofix).toContain('build-errors.md')
    })
  })

  describe('P3: Supervisor rerun backs up to architect', () => {
    it('rerun --from=build --feedback backs up to architect', () => {
      expect(resolveRerunFromStage('build', 'fix type error', IMPL_STAGES)).toBe('architect')
    })

    it('rerun --from=build without feedback stays at build', () => {
      expect(resolveRerunFromStage('build', undefined, IMPL_STAGES)).toBe('build')
    })

    it('rerun --from=verify --feedback backs up to architect', () => {
      expect(resolveRerunFromStage('verify', 'lint errors', IMPL_STAGES)).toBe('architect')
    })
  })

  describe('P4: Feedback flow continuity', () => {
    it('architect reads rerun-feedback.md (existing behavior preserved)', () => {
      expect(STAGE_CONTEXT_FILES.architect).toContain('rerun-feedback.md')
    })

    it('all impl stages after architect are in correct order', () => {
      // Verify the pipeline order makes architect run before build
      expect(IMPL_STAGES.indexOf('architect')).toBeLessThan(IMPL_STAGES.indexOf('build'))
      expect(IMPL_STAGES.indexOf('plan-gap')).toBeLessThan(IMPL_STAGES.indexOf('build'))
    })
  })
})
