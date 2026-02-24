import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const AGENTS_DIR = path.join(process.cwd(), '.opencode', 'agents')
const AUDITOR_FILE = 'auditor.md'

/** The 9 improvement types that must be in auditor.md for Phase 1 */
const IMPROVEMENT_TYPES = [
  'DOC',
  'INDEX',
  'GUARDRAIL',
  'PROMPT',
  'AUTOMATION',
  'NAMING_STRUCTURE',
  'PIPELINE',
  'SECURITY',
  'CODE_PATTERN',
] as const

function readAuditor(): string {
  return fs.readFileSync(path.join(AGENTS_DIR, AUDITOR_FILE), 'utf-8')
}

describe('auditor agent definition', () => {
  describe('Phase 1: Extended Improvement Types', () => {
    it('should include all 9 improvement types', () => {
      const content = readAuditor()

      for (const type of IMPROVEMENT_TYPES) {
        expect(content, `Missing improvement type: ${type}`).toContain(type)
      }
    })

    it('should list improvement types in the What You Must Do section', () => {
      const content = readAuditor()

      // Should have improvement types listed together
      expect(content).toContain('DOC - documentation update')
      expect(content).toContain('INDEX - MEMORY.md, AGENTS.md, etc.')
      expect(content).toContain('GUARDRAIL - new rule')
      expect(content).toContain('PROMPT - agent prompt improvement')
      expect(content).toContain('AUTOMATION - CI check / script')
      expect(content).toContain('NAMING_STRUCTURE - naming convention')
    })

    it('should include new PIPELINE improvement type', () => {
      const content = readAuditor()
      // Should mention PIPELINE as pipeline config improvements
      expect(content).toMatch(/PIPELINE/i)
    })

    it('should include new SECURITY improvement type', () => {
      const content = readAuditor()
      // Should mention SECURITY as security pattern improvements
      expect(content).toMatch(/SECURITY/i)
    })

    it('should include new CODE_PATTERN improvement type', () => {
      const content = readAuditor()
      // Should mention CODE_PATTERN for collection configs, hook patterns, API patterns
      expect(content).toMatch(/CODE_PATTERN/i)
    })
  })

  describe('Phase 1: Progressive Output Format', () => {
    it('should have Primary Improvement section in output format', () => {
      const content = readAuditor()
      expect(content).toContain('## Primary Improvement')
    })

    it('should have Additional Findings section in output format', () => {
      const content = readAuditor()
      expect(content).toContain('## Additional Findings')
    })

    it('should limit Additional Findings to 4 items', () => {
      const content = readAuditor()
      // Should mention up to 4 items
      expect(content).toMatch(/up to 4|maximum of 4|4 items?/i)
    })

    it('should mention that primary improvement is auto-applied', () => {
      const content = readAuditor()
      // Primary improvement should be auto-applied (highest impact, safe)
      expect(content).toMatch(/auto-?apply/i)
    })
  })

  describe('Phase 1: Effectiveness Tracking', () => {
    it('should mention effectiveness scoring', () => {
      const content = readAuditor()
      // Should mention effectiveness tracking
      expect(content).toMatch(/effectiveness|effective/i)
    })

    it('should include effective state', () => {
      const content = readAuditor()
      expect(content).toContain('effective')
    })

    it('should include neutral state', () => {
      const content = readAuditor()
      expect(content).toContain('neutral')
    })

    it('should include ineffective state', () => {
      const content = readAuditor()
      expect(content).toContain('ineffective')
    })

    it('should include unknown state', () => {
      const content = readAuditor()
      expect(content).toContain('unknown')
    })

    it('should track effectiveness in output format', () => {
      const content = readAuditor()
      // The effectiveness states should be in the output format section
      const outputFormatSection = content.includes('## Output Format')
        ? content.split('## Output Format')[1]
        : content
      expect(outputFormatSection).toMatch(/effective.*neutral.*ineffective.*unknown/s)
    })
  })

  describe('Backward Compatibility', () => {
    it('should still have the existing Chosen Improvement section for backward compatibility', () => {
      const content = readAuditor()
      expect(content).toContain('## Chosen Improvement')
    })

    it('should maintain existing structure (Task Info, Stage Analysis, Process Delta)', () => {
      const content = readAuditor()
      expect(content).toContain('## Task Info')
      expect(content).toContain('## Stage Analysis')
      expect(content).toContain('## Process Delta')
    })

    it('should maintain hard rules (exactly one improvement)', () => {
      const content = readAuditor()
      expect(content).toContain('EXACTLY one improvement')
    })
  })

  describe('Output Format Structure', () => {
    it('should organize output with Primary Improvement first', () => {
      const content = readAuditor()
      const primaryIdx = content.indexOf('## Primary Improvement')
      const additionalIdx = content.indexOf('## Additional Findings')
      const chosenIdx = content.indexOf('## Chosen Improvement')

      // Primary should come before Additional Findings
      expect(primaryIdx).toBeLessThan(additionalIdx)
      // Additional Findings should come before Chosen Improvement (legacy)
      expect(additionalIdx).toBeLessThan(chosenIdx)
    })

    it('should include title and rationale in Primary Improvement section', () => {
      const content = readAuditor()
      const primarySection = content.includes('## Primary Improvement')
        ? content.split('## Primary Improvement')[1].split('##')[0]
        : ''

      expect(primarySection).toMatch(/Title:/i)
      expect(primarySection).toMatch(/Rationale:/i)
    })

    it('should include effectiveness field in Primary Improvement', () => {
      const content = readAuditor()
      const primarySection = content.includes('## Primary Improvement')
        ? content.split('## Primary Improvement')[1].split('##')[0]
        : ''

      expect(primarySection).toMatch(/Effectiveness:/i)
    })
  })
})
