import { describe, it, expect } from 'vitest'
import * as path from 'path'
import {
  buildStagePrompt,
  stageInstructions,
  SPEC_STAGES,
  SCRIPTED_STAGES,
  ALL_STAGES,
  STAGE_CONTEXT_FILES,
  getSpecStages,
  getImplStages,
} from '../../../../scripts/cody/stage-prompts'
import type { CodyInput } from '../../../../scripts/cody/cody-utils'

const mockInput: CodyInput = {
  mode: 'full',
  taskId: '260219-test',
  dryRun: false,
}

// Helper to get expected absolute path for task files
function getExpectedPath(file: string): string {
  const base = path.join(process.cwd(), '.tasks', '260219-test')
  // Handle relative paths like ../audit-history.json - use string concatenation to preserve ..
  if (file.startsWith('../')) {
    return `${base}/../${file.replace('../', '')}`
  }
  return path.join(base, file)
}

describe('stage-prompts', () => {
  // ===========================================================================
  // Constants
  // ===========================================================================

  describe('SPEC_STAGES', () => {
    it('should contain taskify, spec, gap, clarify', () => {
      expect([...SPEC_STAGES]).toEqual(['taskify', 'spec', 'gap', 'clarify'])
    })
  })

  describe('SCRIPTED_STAGES', () => {
    it('should contain verify, commit, pr', () => {
      expect([...SCRIPTED_STAGES]).toEqual(['verify', 'commit', 'commit-fix', 'pr'])
    })
  })

  describe('ALL_STAGES', () => {
    it('should contain all stages including gap, plan-gap, commit, autofix', () => {
      const stages = [...ALL_STAGES]
      expect(stages).toContain('taskify')
      expect(stages).toContain('spec')
      expect(stages).toContain('gap')
      expect(stages).toContain('clarify')
      expect(stages).toContain('architect')
      expect(stages).toContain('plan-gap')
      expect(stages).toContain('build')
      expect(stages).toContain('commit')
      expect(stages).toContain('verify')
      expect(stages).toContain('review')
      expect(stages).toContain('fix')
      expect(stages).toContain('commit-fix')
      expect(stages).toContain('autofix')
      expect(stages).toContain('pr')
      expect(stages).toHaveLength(14)
    })
  })

  // ===========================================================================
  // STAGE_CONTEXT_FILES
  // ===========================================================================

  describe('STAGE_CONTEXT_FILES', () => {
    it('should map stages to their correct file lists', () => {
      expect(STAGE_CONTEXT_FILES.taskify).toEqual(['task.md'])
      expect(STAGE_CONTEXT_FILES.spec).toEqual(['task.md', 'task.json'])
      expect(STAGE_CONTEXT_FILES.gap).toEqual(['spec.md', 'task.json'])
      expect(STAGE_CONTEXT_FILES.clarify).toEqual(['task.md', 'spec.md'])
      expect(STAGE_CONTEXT_FILES.architect).toEqual([
        'spec.md',
        'clarified.md',
        'rerun-feedback.md',
      ])
      expect(STAGE_CONTEXT_FILES['plan-gap']).toEqual(['spec.md', 'plan.md', 'task.json'])
      expect(STAGE_CONTEXT_FILES.build).toEqual([
        'spec.md',
        'clarified.md',
        'plan.md',
        'plan-gap.md',
        'rerun-feedback.md',
      ])
      expect(STAGE_CONTEXT_FILES.commit).toEqual(['task.json'])
      expect(STAGE_CONTEXT_FILES.verify).toEqual([])
      expect(STAGE_CONTEXT_FILES.autofix).toEqual(['verify.md', 'build-errors.md'])
      expect(STAGE_CONTEXT_FILES.pr).toEqual([])
      expect(STAGE_CONTEXT_FILES.review).toEqual([
        'review.md',
        'build.md',
        'plan.md',
        'spec.md',
        'clarified.md',
      ])
      expect(STAGE_CONTEXT_FILES.fix).toEqual([
        'verify-failures.md',
        'review.md',
        'rerun-feedback.md',
        'fix-summary.md',
        'build.md',
        'plan.md',
        'spec.md',
        'clarified.md',
      ])
      expect(STAGE_CONTEXT_FILES['commit-fix']).toEqual(['fix-summary.md', 'verify-failures.md'])
    })

    it('should include build-errors.md in autofix context for build stage feedback', () => {
      expect(STAGE_CONTEXT_FILES.autofix).toContain('build-errors.md')
    })

    it('should include rerun-feedback.md in build context for supervisor feedback', () => {
      expect(STAGE_CONTEXT_FILES.build).toContain('rerun-feedback.md')
    })

    it('should have an entry for every stage in ALL_STAGES', () => {
      for (const stage of ALL_STAGES) {
        expect(STAGE_CONTEXT_FILES).toHaveProperty(stage)
        expect(Array.isArray(STAGE_CONTEXT_FILES[stage])).toBe(true)
      }
    })
  })

  // ===========================================================================
  // Stage helpers
  // ===========================================================================

  describe('getSpecStages', () => {
    it('should return taskify, spec, gap for default standard profile (clarify not included)', () => {
      expect(getSpecStages()).toEqual(['taskify', 'spec', 'gap'])
    })

    it('should return only taskify for lightweight profile', () => {
      expect(getSpecStages('lightweight')).toEqual(['taskify'])
    })

    it('should return taskify, spec, gap for standard profile (no clarify)', () => {
      expect(getSpecStages('standard')).toEqual(['taskify', 'spec', 'gap'])
    })
  })

  describe('getImplStages', () => {
    it('should return full implementation stage list (default standard profile)', () => {
      expect(getImplStages()).toEqual([
        'architect',
        'plan-gap',
        'build',
        'commit',
        'review',
        'fix',
        'commit-fix',
        'verify',
        'pr',
      ])
    })

    it('should return reduced stage list for lightweight profile (no plan-gap)', () => {
      expect(getImplStages('lightweight')).toEqual([
        'architect',
        'build',
        'commit',
        'review',
        'fix',
        'commit-fix',
        'verify',
        'pr',
      ])
    })

    it('should return full stage list for standard profile', () => {
      expect(getImplStages('standard')).toEqual([
        'architect',
        'plan-gap',
        'build',
        'commit',
        'review',
        'fix',
        'commit-fix',
        'verify',
        'pr',
      ])
    })
  })

  // ===========================================================================
  // stageInstructions
  // ===========================================================================

  describe('stageInstructions', () => {
    it('should include spec-only guard for spec stages', () => {
      for (const stage of SPEC_STAGES) {
        const instruction = stageInstructions[stage]('260219-test')
        expect(instruction).toContain('SPEC-ONLY')
        expect(instruction).toContain('DO NOT create branches')
        expect(instruction).toContain('DO NOT modify any code files')
        // Now uses absolute path
        expect(instruction).toContain(path.join(process.cwd(), '.tasks', '260219-test'))
      }
    })

    it('should return empty strings for non-spec stages (except build, review, fix)', () => {
      const nonSpecStages = ALL_STAGES.filter(
        (s) => !SPEC_STAGES.includes(s as (typeof SPEC_STAGES)[number]),
      )
      for (const stage of nonSpecStages) {
        const instruction = stageInstructions[stage]('260219-test')
        // Build stage intentionally has implementation instructions
        if (stage === 'build') {
          expect(instruction).toContain('IMPLEMENTATION STAGE')
        } else if (stage === 'review') {
          expect(instruction).toContain('CODE REVIEW')
        } else if (stage === 'fix') {
          expect(instruction).toContain('TARGETED FIX STAGE')
        } else {
          expect(instruction).toBe('')
        }
      }
    })
  })

  // ===========================================================================
  // buildStagePrompt
  // ===========================================================================

  describe('buildStagePrompt', () => {
    it('should include task ID for all stages', () => {
      for (const stage of ALL_STAGES) {
        const prompt = buildStagePrompt(mockInput, stage)
        expect(prompt).toContain('Task ID: 260219-test')
      }
    })

    it('should include file list from STAGE_CONTEXT_FILES', () => {
      for (const stage of ALL_STAGES) {
        const prompt = buildStagePrompt(mockInput, stage)
        const files = STAGE_CONTEXT_FILES[stage]
        for (const file of files) {
          // Now uses absolute paths
          expect(prompt).toContain(getExpectedPath(file))
        }
      }
    })

    it('should include "Read these files" section when stage has context files', () => {
      const prompt = buildStagePrompt(mockInput, 'build')
      expect(prompt).toContain('Read these files for context:')
    })

    it('should NOT include "Read these files" section for scripted stages with no files', () => {
      const prompt = buildStagePrompt(mockInput, 'verify')
      expect(prompt).not.toContain('Read these files for context:')
    })

    it('should include output instruction for all stages', () => {
      for (const stage of ALL_STAGES) {
        const prompt = buildStagePrompt(mockInput, stage)
        expect(prompt).toContain('Write your output')
      }
    })

    it('should include spec-only guard for spec stages', () => {
      for (const stage of SPEC_STAGES) {
        const prompt = buildStagePrompt(mockInput, stage)
        expect(prompt).toContain('DO NOT create branches')
        expect(prompt).toContain('DO NOT modify any code files')
      }
    })

    it('should NOT reference .context.md', () => {
      for (const stage of ALL_STAGES) {
        const prompt = buildStagePrompt(mockInput, stage)
        expect(prompt).not.toContain('.context.md')
      }
    })

    it('should build valid prompts for all stages with reasonable length', () => {
      for (const stage of ALL_STAGES) {
        const prompt = buildStagePrompt(mockInput, stage)
        expect(prompt.length).toBeGreaterThan(10)
      }
    })

    it('should include validation feedback when provided', () => {
      const feedback = 'gap.md must contain ## Gaps Found'
      const prompt = buildStagePrompt(mockInput, 'gap', feedback)
      expect(prompt).toContain('VALIDATION ERROR FROM PREVIOUS ATTEMPT:')
      expect(prompt).toContain(feedback)
    })

    it('should NOT include feedback section when no feedback provided', () => {
      const prompt = buildStagePrompt(mockInput, 'gap')
      expect(prompt).not.toContain('VALIDATION ERROR FROM PREVIOUS ATTEMPT:')
    })

    it('should include "Please fix this in your next attempt" when feedback provided', () => {
      const feedback = 'spec.md must contain ## Requirements'
      const prompt = buildStagePrompt(mockInput, 'spec', feedback)
      expect(prompt).toContain('Please fix this in your next attempt')
    })

    it('should include feedback in correct position (before output instruction)', () => {
      const feedback = 'test error message'
      const prompt = buildStagePrompt(mockInput, 'build', feedback)
      const feedbackIndex = prompt.indexOf('VALIDATION ERROR')
      const outputIndex = prompt.indexOf('Write your output')
      expect(feedbackIndex).toBeLessThan(outputIndex)
    })
  })
})
