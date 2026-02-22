/**
 * Unit Tests for HTML Block Defaults Factory
 *
 * Tests that the HTML block defaults factory is properly registered
 * and returns a valid HtmlBlock structure.
 */
import { describe, expect, it } from 'vitest'
import { ExerciseBlockDefaults } from '../../../src/server/payload/collections/Exercises/defaults'
import type { HtmlBlock } from '../../../src/server/payload/collections/Exercises/types'

describe('HTML Block Defaults Factory', () => {
  it('should have an html key in ExerciseBlockDefaults', () => {
    expect(ExerciseBlockDefaults).toHaveProperty('html')
  })

  it('should be a function', () => {
    expect(typeof ExerciseBlockDefaults.html).toBe('function')
  })

  it('should return a valid HtmlBlock structure', () => {
    const htmlBlock = ExerciseBlockDefaults.html() as HtmlBlock

    expect(htmlBlock).toBeDefined()
    expect(htmlBlock.id).toBeDefined()
    expect(typeof htmlBlock.id).toBe('string')
    expect(htmlBlock.id.length).toBeGreaterThan(0)
    expect(htmlBlock.type).toBe('html')
    expect(htmlBlock.html).toBe('')
  })

  it('should generate unique IDs for each call', () => {
    const block1 = ExerciseBlockDefaults.html() as HtmlBlock
    const block2 = ExerciseBlockDefaults.html() as HtmlBlock

    expect(block1.id).not.toBe(block2.id)
  })

  it('should return blocks with the correct type', () => {
    const htmlBlock = ExerciseBlockDefaults.html() as HtmlBlock

    // Type assertion to ensure TypeScript recognizes the type
    const isHtmlBlock = (block: unknown): block is HtmlBlock => {
      return (
        typeof block === 'object' &&
        block !== null &&
        'type' in block &&
        block.type === 'html' &&
        'html' in block &&
        'id' in block
      )
    }

    expect(isHtmlBlock(htmlBlock)).toBe(true)
  })
})

describe('ExerciseBlockDefaults keys alignment', () => {
  it('should have all expected block types', () => {
    const expectedKeys = [
      'rich_text',
      'question_select',
      'question_mcq',
      'question_free_response',
      'question_table',
      'latex',
      'html',
    ]

    for (const key of expectedKeys) {
      expect(ExerciseBlockDefaults).toHaveProperty(key)
      expect(typeof ExerciseBlockDefaults[key]).toBe('function')
    }
  })
})
