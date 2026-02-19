import { describe, it, expect } from 'vitest'
import {
  buildStagePrompt,
  stageInstructions,
  ALL_STAGES,
} from '../../../../scripts/cody/stage-prompts'
import type { CodyInput } from '../../../../scripts/cody/cody-utils'

const mockInput: CodyInput = {
  mode: 'full',
  taskId: '260219-test',
  dryRun: false,
}

describe('stage-prompts', () => {
  describe('taskify prompt', () => {
    it('should list all valid task_type values', () => {
      const prompt = buildStagePrompt(mockInput, 'taskify')
      const validTypes = [
        'spec_only',
        'implement_feature',
        'fix_bug',
        'refactor',
        'docs',
        'ops',
        'research',
      ]
      for (const type of validTypes) {
        expect(prompt).toContain(type)
      }
    })

    it('should NOT ask agent to write pipeline field', () => {
      const prompt = buildStagePrompt(mockInput, 'taskify')
      expect(prompt).toContain('Do NOT include a "pipeline" field')
    })

    it('should include a JSON example', () => {
      const prompt = buildStagePrompt(mockInput, 'taskify')
      expect(prompt).toContain('"task_type"')
      expect(prompt).toContain('"fix_bug"')
      expect(prompt).toContain('"scope"')
    })

    it('should warn about common WRONG values', () => {
      const prompt = buildStagePrompt(mockInput, 'taskify')
      expect(prompt).toContain('WRONG')
      expect(prompt).toContain('"feature"')
    })

    it('should include the task ID and context path', () => {
      const prompt = buildStagePrompt(mockInput, 'taskify')
      expect(prompt).toContain('260219-test')
      expect(prompt).toContain('.context.md')
    })

    it('should include spec-only instruction (no code changes)', () => {
      const prompt = buildStagePrompt(mockInput, 'taskify')
      expect(prompt).toContain('DO NOT create branches')
      expect(prompt).toContain('DO NOT modify any code files')
    })

    it('should not include pipeline in the example JSON', () => {
      const instruction = stageInstructions.taskify('260219-test')
      const exampleMatch = instruction.match(/Example output:\s*\{[\s\S]*?\}/)
      if (exampleMatch) {
        expect(exampleMatch[0]).not.toContain('"pipeline"')
      }
    })
  })

  describe('new split stages', () => {
    it('should have a plan-review stage instruction', () => {
      const prompt = buildStagePrompt(mockInput, 'plan-review')
      expect(prompt).toContain('plan-review.md')
      expect(prompt).toContain('PASS')
      expect(prompt).toContain('FAIL')
    })

    it('should have a commit stage instruction', () => {
      const prompt = buildStagePrompt(mockInput, 'commit')
      expect(prompt).toContain('conventional commit')
      expect(prompt).toContain('Do NOT modify')
    })

    it('build prompt should NOT mention commit or push', () => {
      const prompt = buildStagePrompt(mockInput, 'build')
      expect(prompt).toContain('Do NOT commit or push')
    })

    it('should have an autofix stage instruction', () => {
      const prompt = buildStagePrompt(mockInput, 'autofix')
      expect(prompt).toContain('verify.md')
      expect(prompt).toContain('autofix.md')
    })
  })

  describe('ALL_STAGES', () => {
    it('should include all new stages', () => {
      expect(ALL_STAGES).toContain('plan-review')
      expect(ALL_STAGES).toContain('commit')
      expect(ALL_STAGES).toContain('autofix')
    })

    it('should include all original stages', () => {
      const expected = [
        'taskify',
        'spec',
        'clarify',
        'architect',
        'build',
        'test',
        'verify',
        'auditor',
        'pr',
      ]
      for (const stage of expected) {
        expect(ALL_STAGES).toContain(stage)
      }
    })
  })

  describe('all stage prompts', () => {
    it('should build valid prompts for all stages', () => {
      const stages = [...ALL_STAGES]
      for (const stage of stages) {
        const prompt = buildStagePrompt(mockInput, stage)
        expect(prompt.length).toBeGreaterThan(10)
        expect(prompt).toContain('260219-test')
      }
    })
  })
})
