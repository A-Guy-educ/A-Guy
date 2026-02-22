import { describe, it, expect } from 'vitest'
import { buildStagePrompt, stageInstructions } from '../../../../scripts/cody/stage-prompts'
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
      // The prompt should tell the agent NOT to include pipeline
      expect(prompt).toContain('Do NOT include a "pipeline" field')
    })

    it('should include a JSON example', () => {
      const prompt = buildStagePrompt(mockInput, 'taskify')
      // Should contain a JSON example with valid task_type
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
      // The example JSON should not have a pipeline field
      const instruction = stageInstructions.taskify('260219-test')
      // Find the JSON example block
      const exampleMatch = instruction.match(/Example output:\s*\{[\s\S]*?\}/)
      if (exampleMatch) {
        expect(exampleMatch[0]).not.toContain('"pipeline"')
      }
    })
  })

  describe('other stage prompts', () => {
    it('should build valid prompts for all stages', () => {
      const stages = [
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
      for (const stage of stages) {
        const prompt = buildStagePrompt(mockInput, stage)
        expect(prompt.length).toBeGreaterThan(10)
        expect(prompt).toContain('260219-test')
      }
    })
  })
})
