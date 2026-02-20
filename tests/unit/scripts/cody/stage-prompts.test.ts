import { describe, it, expect } from 'vitest'
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

describe('stage-prompts', () => {
  // ===========================================================================
  // Constants
  // ===========================================================================

  describe('SPEC_STAGES', () => {
    it('should contain taskify, spec, clarify', () => {
      expect([...SPEC_STAGES]).toEqual(['taskify', 'spec', 'clarify'])
    })
  })

  describe('SCRIPTED_STAGES', () => {
    it('should contain verify and pr', () => {
      expect([...SCRIPTED_STAGES]).toEqual(['verify', 'pr'])
    })
  })

  describe('ALL_STAGES', () => {
    it('should contain all stages including plan-review, commit, autofix', () => {
      const stages = [...ALL_STAGES]
      expect(stages).toContain('taskify')
      expect(stages).toContain('spec')
      expect(stages).toContain('clarify')
      expect(stages).toContain('architect')
      expect(stages).toContain('plan-review')
      expect(stages).toContain('build')
      expect(stages).toContain('commit')
      expect(stages).toContain('test')
      expect(stages).toContain('verify')
      expect(stages).toContain('autofix')
      expect(stages).toContain('auditor')
      expect(stages).toContain('pr')
      expect(stages).toHaveLength(12)
    })
  })

  // ===========================================================================
  // STAGE_CONTEXT_FILES
  // ===========================================================================

  describe('STAGE_CONTEXT_FILES', () => {
    it('should map stages to their correct file lists', () => {
      expect(STAGE_CONTEXT_FILES.taskify).toEqual(['task.md'])
      expect(STAGE_CONTEXT_FILES.spec).toEqual(['task.md', 'task.json'])
      expect(STAGE_CONTEXT_FILES.clarify).toEqual(['task.md', 'spec.md'])
      expect(STAGE_CONTEXT_FILES.architect).toEqual([
        'spec.md',
        'clarified.md',
        'rerun-feedback.md',
      ])
      expect(STAGE_CONTEXT_FILES['plan-review']).toEqual(['spec.md', 'plan.md'])
      expect(STAGE_CONTEXT_FILES.build).toEqual(['spec.md', 'clarified.md', 'plan.md'])
      expect(STAGE_CONTEXT_FILES.commit).toEqual(['task.json'])
      expect(STAGE_CONTEXT_FILES.test).toEqual(['spec.md', 'plan.md', 'build.md'])
      expect(STAGE_CONTEXT_FILES.verify).toEqual([])
      expect(STAGE_CONTEXT_FILES.autofix).toEqual(['verify.md'])
      expect(STAGE_CONTEXT_FILES.auditor).toEqual(['task.md', 'spec.md', 'build.md', 'verify.md'])
      expect(STAGE_CONTEXT_FILES.pr).toEqual([])
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
    it('should return taskify, spec, clarify', () => {
      expect(getSpecStages()).toEqual(['taskify', 'spec', 'clarify'])
    })
  })

  describe('getImplStages', () => {
    it('should return implementation stages in order', () => {
      expect(getImplStages()).toEqual([
        'architect',
        'plan-review',
        'build',
        'commit',
        'test',
        'verify',
        'auditor',
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
        expect(instruction).toContain('.tasks/260219-test/')
      }
    })

    it('should return empty strings for non-spec stages (behavioral moved to agent files)', () => {
      const nonSpecStages = ALL_STAGES.filter(
        (s) => !SPEC_STAGES.includes(s as (typeof SPEC_STAGES)[number]),
      )
      for (const stage of nonSpecStages) {
        const instruction = stageInstructions[stage]('260219-test')
        expect(instruction).toBe('')
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
          expect(prompt).toContain(`.tasks/260219-test/${file}`)
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
  })
})
