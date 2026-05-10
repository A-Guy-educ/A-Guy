/**
 * Tests for lesson-duplication prompt files.
 *
 * Validates that all 15 prompt files (5 subjects × 3 levels) have:
 * 1. A "## Examples" section with 3 paired (input, output) examples
 * 2. Geometry prompts reference question_geometry and GeometrySpecV1 in examples
 * 3. Calculus prompts include step-by-step full_solution in examples
 * 4. Snapshot test for character counts to detect accidental truncations
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const PROMPTS_DIR = 'src/infra/llm/prompts/lesson-duplication'

const SUBJECTS = ['algebra', 'geometry', 'calculus', 'mixed', 'other'] as const
const LEVELS = ['light', 'medium', 'deep'] as const

type Subject = (typeof SUBJECTS)[number]
type Level = (typeof LEVELS)[number]

const PROMPT_FILES: Array<{ subject: Subject; level: Level }> = SUBJECTS.flatMap((subject) =>
  LEVELS.map((level) => ({ subject, level })),
)

function getPromptPath(subject: Subject, level: Level): string {
  return join(PROMPTS_DIR, `${subject}-${level}-agent-prompt.md`)
}

describe('Lesson Duplication Prompt Files', () => {
  describe('All 15 prompt files exist', () => {
    it.each(PROMPT_FILES)('should have $subject-$level-agent-prompt.md', ({ subject, level }) => {
      const filePath = getPromptPath(subject, level)
      expect(existsSync(filePath), `Prompt file ${filePath} should exist`).toBe(true)
    })
  })

  describe('All prompts have ## Examples section with 3 examples', () => {
    it.each(PROMPT_FILES)(
      '$subject-$level should have ## Examples section',
      ({ subject, level }) => {
        const filePath = getPromptPath(subject, level)
        const content = readFileSync(filePath, 'utf-8')

        // Should have ## Examples section
        expect(
          content.includes('## Examples'),
          `${filePath} should contain "## Examples" section`,
        ).toBe(true)

        // Should have at least 3 examples (looking for "Example 1", "Example 2", "Example 3" or similar patterns)
        // Count the number of example markers - look for various patterns
        const examplePatterns = [
          /Example\s*1/i,
          /Example\s*2/i,
          /Example\s*3/i,
          /Input\s*1/i,
          /Input\s*2/i,
          /Input\s*3/i,
          /\*\*(?:Example|Input)\s*1\*\*/i,
          /\*\*(?:Example|Input)\s*2\*\*/i,
          /\*\*(?:Example|Input)\s*3\*\*/i,
        ]

        const foundPatterns = examplePatterns.filter((pattern) => pattern.test(content))
        expect(
          foundPatterns.length >= 3,
          `${filePath} should contain at least 3 example markers, found ${foundPatterns.length}`,
        ).toBe(true)
      },
    )
  })

  describe('Geometry prompts reference question_geometry and GeometrySpecV1 in examples', () => {
    const geometryPrompts = PROMPT_FILES.filter(({ subject }) => subject === 'geometry')

    it.each(geometryPrompts)(
      '$subject-$level examples should reference question_geometry',
      ({ subject, level }) => {
        const filePath = getPromptPath(subject, level)
        const content = readFileSync(filePath, 'utf-8')

        // Extract the examples section
        const examplesMatch = content.match(/## Examples\s*\n([\s\S]*?)(?=\n## |\n# |$)/im)
        expect(examplesMatch, `${filePath} should have examples section`).toBeTruthy()

        const examplesContent = examplesMatch?.[1] || ''
        expect(
          examplesContent.includes('question_geometry'),
          `${filePath} examples should reference question_geometry`,
        ).toBe(true)
      },
    )

    it.each(geometryPrompts)(
      '$subject-$level examples should reference GeometrySpecV1',
      ({ subject, level }) => {
        const filePath = getPromptPath(subject, level)
        const content = readFileSync(filePath, 'utf-8')

        // Extract the examples section
        const examplesMatch = content.match(/## Examples\s*\n([\s\S]*?)(?=\n## |\n# |$)/im)
        expect(examplesMatch, `${filePath} should have examples section`).toBeTruthy()

        const examplesContent = examplesMatch?.[1] || ''
        expect(
          examplesContent.includes('GeometrySpecV1'),
          `${filePath} examples should reference GeometrySpecV1`,
        ).toBe(true)
      },
    )
  })

  describe('Calculus prompts include step-by-step full_solution in examples', () => {
    const calculusPrompts = PROMPT_FILES.filter(({ subject }) => subject === 'calculus')

    it.each(calculusPrompts)(
      '$subject-$level examples should include full_solution with step-by-step derivation',
      ({ subject, level }) => {
        const filePath = getPromptPath(subject, level)
        const content = readFileSync(filePath, 'utf-8')

        // Extract the examples section
        const examplesMatch = content.match(/## Examples\s*\n([\s\S]*?)(?=\n## |\n# |$)/im)
        expect(examplesMatch, `${filePath} should have examples section`).toBeTruthy()

        const examplesContent = examplesMatch?.[1] || ''

        // Should reference full_solution
        expect(
          examplesContent.includes('full_solution'),
          `${filePath} examples should reference full_solution`,
        ).toBe(true)

        // Should mention step-by-step derivation or similar (for calculus, the full_solution should show steps)
        const stepKeywords = [
          'step',
          'derive',
          'differentiate',
          'integrate',
          'chain rule',
          'power rule',
          'product rule',
          'quotient rule',
          'u-substitution',
        ]

        const hasStepKeyword = stepKeywords.some((keyword) =>
          examplesContent.toLowerCase().includes(keyword),
        )
        expect(
          hasStepKeyword,
          `${filePath} examples should include step-by-step derivation keywords like: ${stepKeywords.join(', ')}`,
        ).toBe(true)
      },
    )
  })

  describe('Snapshot: character counts for all prompts', () => {
    it.each(PROMPT_FILES)(
      '$subject-$level should have reasonable character count (not truncated)',
      ({ subject, level }) => {
        const filePath = getPromptPath(subject, level)
        const content = readFileSync(filePath, 'utf-8')
        const charCount = content.length

        // A healthy prompt with examples should be at least 2000 characters
        // (basic rules + examples section with 3 examples)
        expect(
          charCount,
          `${filePath} should have at least 2000 characters (indicating examples section is present)`,
        ).toBeGreaterThanOrEqual(2000)

        // Log character counts for reference
        console.log(`${subject}-${level}: ${charCount} characters`)
      },
    )
  })

  describe('Light-level prompts must have different Input and Output JSON in examples', () => {
    const lightPrompts = PROMPT_FILES.filter(({ level }) => level === 'light')

    it.each(lightPrompts)(
      '$subject-$level examples should have different Input and Output JSON',
      ({ subject, level }) => {
        const filePath = getPromptPath(subject, level)
        const content = readFileSync(filePath, 'utf-8')

        // Extract all Input JSON blocks and Output JSON blocks
        // Match blocks between ```json and ``` markers
        const jsonBlockRegex = /```json\n([\s\S]*?)```/g
        const blocks: string[] = []
        let match

        while ((match = jsonBlockRegex.exec(content)) !== null) {
          blocks.push(match[1])
        }

        // For light prompts, we expect pairs of Input/Output JSON blocks
        // Check that at least one Input block differs from its corresponding Output block
        // We pair them sequentially: block 0=Input1, block 1=Output1, block 2=Input2, etc.

        let hasDifferentPair = false
        for (let i = 0; i + 1 < blocks.length; i += 2) {
          const inputBlock = blocks[i]
          const outputBlock = blocks[i + 1]

          if (inputBlock && outputBlock && inputBlock !== outputBlock) {
            hasDifferentPair = true
            break
          }
        }

        expect(
          hasDifferentPair,
          `${filePath} should have at least one Input/Output pair with different JSON content. All light-level example outputs must demonstrate actual variation.`,
        ).toBe(true)
      },
    )
  })
})
