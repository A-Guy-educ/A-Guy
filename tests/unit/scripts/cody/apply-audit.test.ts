import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const AGENTS_DIR = path.join(process.cwd(), '.opencode', 'agents')
const APPLY_AUDIT_FILE = 'apply-audit.md'

function readApplyAudit(): string {
  return fs.readFileSync(path.join(AGENTS_DIR, APPLY_AUDIT_FILE), 'utf-8')
}

describe('apply-audit agent definition', () => {
  describe('Phase 2: Multi-File Support', () => {
    it('should remove the single-file constraint', () => {
      const content = readApplyAudit()

      // Should NOT require exactly one file
      expect(content).not.toMatch(/only.*one.*file|one.*file.*only/i)
    })

    it('should support multiple improvements from auditor', () => {
      const content = readApplyAudit()

      // Should mention multiple improvements or changes
      expect(content).toMatch(/multiple|all.*improvements|multiple.*changes/i)
    })

    it('should handle a list of files to edit', () => {
      const content = readApplyAudit()

      // Should mention handling multiple files or a list of files
      expect(content).toMatch(/files.*to.*edit|multiple.*files|list.*files|file.*paths/i)
    })
  })

  describe('Phase 2: Safe-Path Whitelist', () => {
    it('should include safe-path whitelist for agent prompts', () => {
      const content = readApplyAudit()

      // Should mention .opencode/agents/*.md or agent prompts
      expect(content).toMatch(/\.opencode\/agents|agent.*prompts?/i)
    })

    it('should include safe-path whitelist for skills', () => {
      const content = readApplyAudit()

      // Should mention .agents/skills
      expect(content).toMatch(/\.agents\/skills|skills?/i)
    })

    it('should include safe-path whitelist for ai-docs', () => {
      const content = readApplyAudit()

      // Should mention .ai-docs
      expect(content).toMatch(/\.ai-?docs|ai.*docs?/i)
    })

    it('should include safe-path whitelist for top-level docs', () => {
      const content = readApplyAudit()

      // Should mention AGENTS.md and DESIGN_SYSTEM.md
      expect(content).toMatch(/AGENTS\.md|DESIGN_SYSTEM\.md|top-?level.*docs?/i)
    })

    it('should include safe-path whitelist for pipeline scripts', () => {
      const content = readApplyAudit()

      // Should mention scripts/cody
      expect(content).toMatch(/scripts\/cody|pipeline.*scripts?/i)
    })

    it('should include safe-path whitelist for CI workflows', () => {
      const content = readApplyAudit()

      // Should mention .github/workflows
      expect(content).toMatch(/\.github\/workflows|CI.*workflows?/i)
    })

    it('should define the whitelist explicitly', () => {
      const content = readApplyAudit()

      // Should have a whitelist section or mention the safe paths explicitly
      expect(content).toMatch(/whitelist|allowed.*paths|safe.*paths?|permitted.*paths?/i)
    })
  })

  describe('Phase 2: Handling Paths Outside Whitelist', () => {
    it('should handle paths outside whitelist as suggestions', () => {
      const content = readApplyAudit()

      // Paths outside whitelist should be logged as suggestions, not edited
      expect(content).toMatch(/suggestion|log.*as.*suggestion|note.*as.*suggestion/i)
    })

    it('should not edit paths outside the whitelist', () => {
      const content = readApplyAudit()

      // Should explicitly state not to edit non-whitelisted paths
      expect(content).toMatch(
        /not.*edit.*outside|do.*not.*edit.*whitelist|outside.*whitelist.*do.*not/i,
      )
    })

    it('should explain why certain paths are not editable', () => {
      const content = readApplyAudit()

      // Should explain the reason (production code, security, etc.)
      expect(content).toMatch(/production.*code|not.*production|restricted|reason/i)
    })
  })

  describe('Phase 2: Output Format for Multi-File Edits', () => {
    it('should show multiple files edited in output format', () => {
      const content = readApplyAudit()

      // Output should show multiple files
      expect(content).toMatch(/files.*edited|files.*changed|multiple.*files.*edited/i)
    })

    it('should include file-by-file status in report', () => {
      const content = readApplyAudit()

      // Should have status per file
      expect(content).toMatch(/status.*IMPLEMENTED|status.*SKIPPED|status.*FAILED/i)
    })

    it('should track which files were edited vs suggested', () => {
      const content = readApplyAudit()

      // Should distinguish between edited and suggested
      expect(content).toMatch(
        /edited.*suggested|suggested.*files?|whitelisted.*vs.*non-?whitelisted/i,
      )
    })
  })

  describe('Backward Compatibility', () => {
    it('should maintain the existing output file location', () => {
      const content = readApplyAudit()

      // Should still write to .tasks/<taskId>/apply-audit.md
      expect(content).toContain('.tasks/<taskId>/apply-audit.md')
    })

    it('should maintain the improvement type field', () => {
      const content = readApplyAudit()

      // Should still have improvement type in output
      expect(content).toMatch(/Type:.*DOC|INDEX|GUARDRAIL|PROMPT|AUTOMATION|NAMING_STRUCTURE/i)
    })

    it('should maintain the Where field', () => {
      const content = readApplyAudit()

      // Should still reference the Where field from auditor
      expect(content).toMatch(/Where:|where.*field|file.*path/i)
    })
  })

  describe('Phase 2: Implementation Details', () => {
    it('should describe how to process multiple improvements', () => {
      const content = readApplyAudit()

      // Should explain processing multiple improvements
      expect(content).toMatch(/process.*multiple|iterate.*improvements|for.*each.*improvement/i)
    })

    it('should distinguish between whitelisted and non-whitelisted paths', () => {
      const content = readApplyAudit()

      // Should have logic for the distinction
      expect(content).toMatch(/whitelist|allowed.*path|check.*path/i)
    })

    it('should provide guidance on handling the suggestion list', () => {
      const content = readApplyAudit()

      // Should mention what to do with suggestions
      expect(content).toMatch(/suggestion|log.*suggestion|record.*suggestion/i)
    })
  })
})
