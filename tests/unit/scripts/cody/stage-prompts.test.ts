import { describe, it, expect } from 'vitest'
import {
  buildStagePrompt,
  stageInstructions,
  ALL_STAGES,
  STAGE_CONTEXT_FILES,
  SCRIPTED_STAGES,
} from '../../../../scripts/cody/stage-prompts'
import type { CodyInput } from '../../../../scripts/cody/cody-utils'

const mockInput: CodyInput = {
  mode: 'full',
  taskId: '260219-test',
  dryRun: false,
}

describe('stage-prompts', () => {
  describe('STAGE_CONTEXT_FILES', () => {
    it('should have entries for all stages', () => {
      for (const stage of ALL_STAGES) {
        expect(STAGE_CONTEXT_FILES[stage]).toBeDefined()
        expect(Array.isArray(STAGE_CONTEXT_FILES[stage])).toBe(true)
      }
    })

    it('architect should need spec.md and clarified.md', () => {
      expect(STAGE_CONTEXT_FILES['architect']).toContain('spec.md')
      expect(STAGE_CONTEXT_FILES['architect']).toContain('clarified.md')
    })

    it('build should need plan.md but NOT verify.md', () => {
      expect(STAGE_CONTEXT_FILES['build']).toContain('plan.md')
      expect(STAGE_CONTEXT_FILES['build']).not.toContain('verify.md')
    })

    it('commit should only need task.json', () => {
      expect(STAGE_CONTEXT_FILES['commit']).toEqual(['task.json'])
    })

    it('autofix should only need verify.md', () => {
      expect(STAGE_CONTEXT_FILES['autofix']).toEqual(['verify.md'])
    })

    it('plan-review should need spec.md and plan.md', () => {
      expect(STAGE_CONTEXT_FILES['plan-review']).toContain('spec.md')
      expect(STAGE_CONTEXT_FILES['plan-review']).toContain('plan.md')
    })

    it('scripted stages should have empty context', () => {
      expect(STAGE_CONTEXT_FILES['verify']).toEqual([])
      expect(STAGE_CONTEXT_FILES['pr']).toEqual([])
    })
  })

  describe('buildStagePrompt', () => {
    it('should include task ID for all stages', () => {
      for (const stage of ALL_STAGES) {
        const prompt = buildStagePrompt(mockInput, stage)
        expect(prompt).toContain('260219-test')
      }
    })

    it('should list specific files for architect stage', () => {
      const prompt = buildStagePrompt(mockInput, 'architect')
      expect(prompt).toContain('spec.md')
      expect(prompt).toContain('clarified.md')
      expect(prompt).toContain('rerun-feedback.md')
      // Should NOT reference .context.md
      expect(prompt).not.toContain('.context.md')
    })

    it('should NOT reference .context.md for any stage', () => {
      for (const stage of ALL_STAGES) {
        const prompt = buildStagePrompt(mockInput, stage)
        expect(prompt).not.toContain('.context.md')
      }
    })

    it('should include spec-only instruction for spec stages', () => {
      const prompt = buildStagePrompt(mockInput, 'taskify')
      expect(prompt).toContain('SPEC-ONLY')
      expect(prompt).toContain('DO NOT create branches')
    })

    it('should NOT include spec-only instruction for impl stages', () => {
      const prompt = buildStagePrompt(mockInput, 'build')
      expect(prompt).not.toContain('SPEC-ONLY')
    })

    it('should list specific files for commit stage', () => {
      const prompt = buildStagePrompt(mockInput, 'commit')
      expect(prompt).toContain('task.json')
      expect(prompt).not.toContain('spec.md')
    })
  })

  describe('ALL_STAGES', () => {
    it('should include all stages', () => {
      const expected = [
        'taskify',
        'spec',
        'clarify',
        'architect',
        'plan-review',
        'build',
        'commit',
        'test',
        'verify',
        'autofix',
        'auditor',
        'pr',
      ]
      for (const stage of expected) {
        expect(ALL_STAGES).toContain(stage)
      }
    })
  })

  describe('SCRIPTED_STAGES', () => {
    it('should include verify and pr', () => {
      expect(SCRIPTED_STAGES).toContain('verify')
      expect(SCRIPTED_STAGES).toContain('pr')
    })
  })

  describe('stageInstructions', () => {
    it('should have instructions for all stages', () => {
      for (const stage of ALL_STAGES) {
        const fn = stageInstructions[stage]
        expect(typeof fn).toBe('function')
      }
    })

    it('spec-only stages should include guard instruction', () => {
      for (const stage of ['taskify', 'spec', 'clarify'] as const) {
        const instruction = stageInstructions[stage]('test-id')
        expect(instruction).toContain('SPEC-ONLY')
      }
    })

    it('impl stages should have minimal or empty instructions', () => {
      for (const stage of ['architect', 'build', 'commit', 'test'] as const) {
        const instruction = stageInstructions[stage]('test-id')
        // Behavioral instructions now live in .opencode/agents/*.md
        expect(instruction.length).toBeLessThan(50)
      }
    })
  })
})
