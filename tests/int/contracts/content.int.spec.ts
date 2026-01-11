import { describe, expect, it } from 'vitest'
import { ExerciseContentSchema } from '@/contracts'

describe('ExerciseContentSchema', () => {
  it('validates exercise content with multiple rich text blocks', () => {
    const validContent = {
      blocks: [
        {
          id: 'b1',
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Solve: $2x^2+3=11$',
        },
        {
          id: 'b2',
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Select the correct value of $x$.',
        },
        {
          id: 'b3',
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Show your work.',
        },
      ],
    }
    expect(() => ExerciseContentSchema.parse(validContent)).not.toThrow()
  })

  it('validates exercise content with mediaIds', () => {
    const validContent = {
      blocks: [
        {
          id: 'b1',
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Refer to the diagram below:',
          mediaIds: ['media1', 'media2'],
        },
        {
          id: 'b2',
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'What is the answer?',
        },
      ],
    }
    expect(() => ExerciseContentSchema.parse(validContent)).not.toThrow()
  })

  it('validates minimal exercise content (single block)', () => {
    const validContent = {
      blocks: [{ id: 'b1', type: 'rich_text', format: 'md-math-v1', value: 'Question text' }],
    }
    expect(() => ExerciseContentSchema.parse(validContent)).not.toThrow()
  })

  it('rejects exercise content with empty blocks array', () => {
    const invalidContent = {
      blocks: [],
    }
    expect(() => ExerciseContentSchema.parse(invalidContent)).toThrow()
  })

  it('rejects exercise content with empty value', () => {
    const invalidContent = {
      blocks: [{ id: 'b1', type: 'rich_text', format: 'md-math-v1', value: '' }],
    }
    expect(() => ExerciseContentSchema.parse(invalidContent)).toThrow()
  })

  it('rejects exercise content with wrong block type', () => {
    const invalidContent = {
      blocks: [{ id: 'b1', type: 'axis_system', format: 'md-math-v1', value: 'text' }],
    }
    expect(() => ExerciseContentSchema.parse(invalidContent)).toThrow()
  })
})
