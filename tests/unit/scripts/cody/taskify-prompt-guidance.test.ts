/**
 * @fileType test
 * @domain ci | cody | prompts
 * @pattern prompt-content-validation
 * @ai-summary Tests that taskify.md prompt contains correct review question guidance — operator decisions only, not codebase-researchable questions
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const TASKIFY_PROMPT_PATH = path.resolve(__dirname, '../../../../.opencode/agents/taskify.md')

describe('taskify prompt — review question guidance', () => {
  // Load once — it's a static file
  const promptContent = fs.readFileSync(TASKIFY_PROMPT_PATH, 'utf-8')

  describe('operator-decision-only guidance', () => {
    it('should instruct to ONLY ask questions requiring operator decision', () => {
      expect(promptContent).toContain('ONLY ask things that require')
      expect(promptContent).toContain('operator decision or authority')
    })

    it('should list decision categories that require operator authority', () => {
      expect(promptContent).toContain('DECISION only the operator can make')
      expect(promptContent).toContain('new dependencies, packages, or third-party integrations')
      expect(promptContent).toContain('new collections, schema changes, or data migrations')
      expect(promptContent).toContain('affect existing users, data, or API contracts')
      expect(promptContent).toContain('product/UX trade-offs')
    })
  })

  describe('good examples — require operator decision', () => {
    it('should include examples about schema migration decisions', () => {
      expect(promptContent).toContain('migrate existing blocks')
      expect(promptContent).toContain('default missing values at render time')
    })

    it('should include examples about dependency decisions', () => {
      expect(promptContent).toContain('add library X')
      expect(promptContent).toContain('implement with vanilla JS')
    })

    it('should include examples about scope decisions', () => {
      expect(promptContent).toContain('scoped to just the admin editor')
      expect(promptContent).toContain('also the student preview')
    })

    it('should include examples about new collection decisions', () => {
      expect(promptContent).toContain('new collection for storing')
      expect(promptContent).toContain('extend the existing')
    })
  })

  describe('bad examples — codebase-researchable questions are explicitly prohibited', () => {
    it('should mark bad examples with ❌ prefix', () => {
      const badExampleLines = promptContent.split('\n').filter((line) => line.includes('❌'))
      expect(badExampleLines.length).toBeGreaterThanOrEqual(4)
    })

    it('should prohibit asking about existing patterns', () => {
      expect(promptContent).toContain(
        '❌ "Are there existing canvas interaction patterns to reuse?"',
      )
    })

    it('should prohibit asking about current data structure', () => {
      expect(promptContent).toContain('❌ "How is the data currently structured for storing X?"')
    })

    it('should prohibit asking about current default behavior', () => {
      expect(promptContent).toContain('❌ "What is the current default behavior for Y?"')
    })

    it('should prohibit asking about existing codebase patterns', () => {
      expect(promptContent).toContain(
        '❌ "Are there any existing patterns in the codebase we should follow?"',
      )
    })

    it('should explain that architect/build stages answer codebase questions', () => {
      expect(promptContent).toContain('architect and build stages will discover them automatically')
    })
  })

  describe('when NOT to include section', () => {
    it('should advise against questions answerable by reading the codebase', () => {
      expect(promptContent).toContain('question can be answered by reading the codebase')
    })

    it('should suggest using assumptions instead of codebase questions', () => {
      expect(promptContent).toContain('use `assumptions` instead')
    })
  })

  describe('format and recommendation constraints', () => {
    it('should require yes/no or specific choice format', () => {
      expect(promptContent).toContain('yes/no or a specific choice')
    })

    it('should recommend 0-2 questions default', () => {
      expect(promptContent).toContain('Usually 0-2 questions is enough')
    })

    it('should default to empty array when task is clear', () => {
      expect(promptContent).toContain('Default to an empty array if the task is clear')
    })
  })
})
