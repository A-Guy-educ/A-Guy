/**
 * Unit tests for prompt composer
 */
import { LESSON_CONTEXT_BLOCK_END, LESSON_CONTEXT_BLOCK_START } from '@/lib/ai/lesson-context'
import { composeSystemInstructions, SYSTEM_PROMPT_SEPARATOR } from '@/lib/ai/prompt-composer.server'
import { describe, expect, it } from 'vitest'

describe('composeSystemInstructions', () => {
  it('composes with system prompts + lesson prompt + context in correct order', () => {
    const result = composeSystemInstructions(
      ['System prompt 1', 'System prompt 2'],
      'Lesson prompt template',
      'Lesson context text',
    )

    // Verify all parts are present
    expect(result).toContain('System prompt 1')
    expect(result).toContain('System prompt 2')
    expect(result).toContain('Lesson prompt template')
    expect(result).toContain('Lesson context text')

    // Verify order: system before lesson before context
    const sys1Idx = result.indexOf('System prompt 1')
    const sys2Idx = result.indexOf('System prompt 2')
    const lessonIdx = result.indexOf('Lesson prompt template')
    const contextIdx = result.indexOf('Lesson context text')

    expect(sys1Idx).toBeLessThan(sys2Idx)
    expect(sys2Idx).toBeLessThan(lessonIdx)
    expect(lessonIdx).toBeLessThan(contextIdx)
  })

  it('works with empty system prompts array', () => {
    const result = composeSystemInstructions([], 'Lesson prompt', undefined)

    expect(result).toBe('Lesson prompt')
    expect(result).not.toContain(SYSTEM_PROMPT_SEPARATOR)
  })

  it('works without lesson context', () => {
    const result = composeSystemInstructions(['System'], 'Lesson', undefined)

    expect(result).toContain('System')
    expect(result).toContain('Lesson')
    expect(result).not.toContain(LESSON_CONTEXT_BLOCK_START)
  })

  it('separates system prompts with defined separator', () => {
    const result = composeSystemInstructions(['First', 'Second'], 'Lesson')

    expect(result).toContain(`First${SYSTEM_PROMPT_SEPARATOR}Second`)
  })

  it('adds separator between system prompts and lesson prompt', () => {
    const result = composeSystemInstructions(['System'], 'Lesson')

    expect(result).toBe(`System${SYSTEM_PROMPT_SEPARATOR}Lesson`)
  })

  it('includes lesson context with proper delimiters', () => {
    const result = composeSystemInstructions([], 'Base', 'Context content')

    expect(result).toContain(LESSON_CONTEXT_BLOCK_START)
    expect(result).toContain('Context content')
    expect(result).toContain(LESSON_CONTEXT_BLOCK_END)
  })

  it('handles single system prompt correctly', () => {
    const result = composeSystemInstructions(['Only system prompt'], 'Lesson prompt')

    expect(result).toBe(`Only system prompt${SYSTEM_PROMPT_SEPARATOR}Lesson prompt`)
  })

  it('handles multiple system prompts with lesson context', () => {
    const result = composeSystemInstructions(['Sys1', 'Sys2', 'Sys3'], 'Lesson', 'Context')

    // Verify structure
    expect(result).toMatch(/Sys1.*Sys2.*Sys3.*Lesson.*Context/s)
  })
})
