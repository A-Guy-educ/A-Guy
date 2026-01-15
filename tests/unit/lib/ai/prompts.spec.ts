/**
 * Unit tests to validate that system prompt files exist and have content.
 * These tests ensure that prompt files are present in the repository and
 * not accidentally deleted or empty.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Path to prompts directory relative to test file location
// From tests/unit/lib/ai/ we need to go up 4 levels to workspace root, then to src/lib/ai/prompts
const promptsDir = join(__dirname, '../../../../src/lib/ai/prompts')

describe('System prompt files validation', () => {
  describe('Summary system prompts', () => {
    it('should have summary-system-prompt.md file', () => {
      const filePath = join(promptsDir, 'summary-system-prompt.md')
      expect(existsSync(filePath)).toBe(true)
    })

    it('should have non-empty summary-system-prompt.md content', () => {
      const filePath = join(promptsDir, 'summary-system-prompt.md')
      const content = readFileSync(filePath, 'utf-8')
      expect(content.trim().length).toBeGreaterThan(0)
      expect(content).toContain('conversation summarizer')
      expect(content).toContain('educational chat system')
    })

    it('should have summary-system-prompt.default.md fallback file', () => {
      const filePath = join(promptsDir, 'summary-system-prompt.default.md')
      expect(existsSync(filePath)).toBe(true)
    })

    it('should have non-empty summary-system-prompt.default.md content', () => {
      const filePath = join(promptsDir, 'summary-system-prompt.default.md')
      const content = readFileSync(filePath, 'utf-8')
      expect(content.trim().length).toBeGreaterThan(0)
      expect(content).toContain('conversation summarizer')
      expect(content).toContain('educational chat system')
    })

    it('should have matching content between main and default summary prompts', () => {
      const mainPath = join(promptsDir, 'summary-system-prompt.md')
      const defaultPath = join(promptsDir, 'summary-system-prompt.default.md')
      const mainContent = readFileSync(mainPath, 'utf-8').trim()
      const defaultContent = readFileSync(defaultPath, 'utf-8').trim()

      // They should have the same core content (allowing for minor formatting differences)
      expect(mainContent).toContain('conversation summarizer')
      expect(defaultContent).toContain('conversation summarizer')
      expect(mainContent).toContain('500 words')
      expect(defaultContent).toContain('500 words')
    })
  })

  describe('Memory extraction system prompts', () => {
    it('should have memory-extraction-system-prompt.md file', () => {
      const filePath = join(promptsDir, 'memory-extraction-system-prompt.md')
      expect(existsSync(filePath)).toBe(true)
    })

    it('should have non-empty memory-extraction-system-prompt.md content', () => {
      const filePath = join(promptsDir, 'memory-extraction-system-prompt.md')
      const content = readFileSync(filePath, 'utf-8')
      expect(content.trim().length).toBeGreaterThan(0)
      expect(content).toContain('memory extraction assistant')
      expect(content).toContain('educational platform')
    })

    it('should have memory-extraction-system-prompt.default.md fallback file', () => {
      const filePath = join(promptsDir, 'memory-extraction-system-prompt.default.md')
      expect(existsSync(filePath)).toBe(true)
    })

    it('should have non-empty memory-extraction-system-prompt.default.md content', () => {
      const filePath = join(promptsDir, 'memory-extraction-system-prompt.default.md')
      const content = readFileSync(filePath, 'utf-8')
      expect(content.trim().length).toBeGreaterThan(0)
      expect(content).toContain('memory extraction assistant')
      expect(content).toContain('educational platform')
    })

    it('should have matching content between main and default memory extraction prompts', () => {
      const mainPath = join(promptsDir, 'memory-extraction-system-prompt.md')
      const defaultPath = join(promptsDir, 'memory-extraction-system-prompt.default.md')
      const mainContent = readFileSync(mainPath, 'utf-8').trim()
      const defaultContent = readFileSync(defaultPath, 'utf-8').trim()

      // They should have the same core content
      expect(mainContent).toContain('memory extraction assistant')
      expect(defaultContent).toContain('memory extraction assistant')
      expect(mainContent).toContain('JSON')
      expect(defaultContent).toContain('JSON')
    })
  })

  describe('Exercise chat agent prompt', () => {
    it('should have exercise-chat-agent-prompt.md file', () => {
      const filePath = join(promptsDir, 'exercise-chat-agent-prompt.md')
      expect(existsSync(filePath)).toBe(true)
    })

    it('should have non-empty exercise-chat-agent-prompt.md content', () => {
      const filePath = join(promptsDir, 'exercise-chat-agent-prompt.md')
      const content = readFileSync(filePath, 'utf-8')
      expect(content.trim().length).toBeGreaterThan(0)
    })
  })

  describe('Prompt file structure', () => {
    it('should have prompts directory', () => {
      expect(existsSync(promptsDir)).toBe(true)
    })

    it('should have at least the required prompt files', () => {
      const requiredFiles = [
        'summary-system-prompt.md',
        'summary-system-prompt.default.md',
        'memory-extraction-system-prompt.md',
        'memory-extraction-system-prompt.default.md',
        'exercise-chat-agent-prompt.md',
      ]

      for (const fileName of requiredFiles) {
        const filePath = join(promptsDir, fileName)
        expect(existsSync(filePath)).toBe(true)
      }
    })
  })
})
