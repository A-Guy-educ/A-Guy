import { AnswerSpecSchema } from '@/infra/contracts'
import { describe, expect, it } from 'vitest'

describe('AnswerSpecSchema - MCQ', () => {
  it('validates mcq answer spec (single select)', () => {
    const validSpec = {
      questionType: 'mcq',
      multiSelect: false,
      options: [
        {
          id: 'o1',
          content: [{ id: 't1', type: 'rich_text', format: 'md-math-v1', value: '$x=2$' }],
        },
        {
          id: 'o2',
          content: [{ id: 't2', type: 'rich_text', format: 'md-math-v1', value: '$x=4$' }],
        },
      ],
      correctOptionIds: ['o1'],
    }
    expect(() => AnswerSpecSchema.parse(validSpec)).not.toThrow()
  })

  it('validates mcq answer spec (multi select)', () => {
    const validSpec = {
      questionType: 'mcq',
      multiSelect: true,
      options: [
        {
          id: 'o1',
          content: [{ id: 't1', type: 'rich_text', format: 'md-math-v1', value: 'Option 1' }],
        },
        {
          id: 'o2',
          content: [{ id: 't2', type: 'rich_text', format: 'md-math-v1', value: 'Option 2' }],
        },
        {
          id: 'o3',
          content: [{ id: 't3', type: 'rich_text', format: 'md-math-v1', value: 'Option 3' }],
        },
      ],
      correctOptionIds: ['o1', 'o3'],
    }
    expect(() => AnswerSpecSchema.parse(validSpec)).not.toThrow()
  })

  it('rejects mcq with no options', () => {
    const invalidSpec = {
      questionType: 'mcq',
      multiSelect: false,
      options: [], // Empty
      correctOptionIds: ['o1'],
    }
    expect(() => AnswerSpecSchema.parse(invalidSpec)).toThrow()
  })

  it('rejects mcq with no correct options', () => {
    const invalidSpec = {
      questionType: 'mcq',
      multiSelect: false,
      options: [
        {
          id: 'o1',
          content: [{ id: 't1', type: 'rich_text', format: 'md-math-v1', value: 'Option 1' }],
        },
      ],
      correctOptionIds: [], // Empty
    }
    expect(() => AnswerSpecSchema.parse(invalidSpec)).toThrow()
  })

  it('rejects single-select mcq with multiple correct options', () => {
    const invalidSpec = {
      questionType: 'mcq',
      multiSelect: false, // Single select
      options: [
        {
          id: 'o1',
          content: [{ id: 't1', type: 'rich_text', format: 'md-math-v1', value: 'Option 1' }],
        },
        {
          id: 'o2',
          content: [{ id: 't2', type: 'rich_text', format: 'md-math-v1', value: 'Option 2' }],
        },
      ],
      correctOptionIds: ['o1', 'o2'], // Two correct, but single-select
    }
    expect(() => AnswerSpecSchema.parse(invalidSpec)).toThrow(/exactly 1 correct option/)
  })

  it('rejects mcq with correctOptionId not in options', () => {
    const invalidSpec = {
      questionType: 'mcq',
      multiSelect: false,
      options: [
        {
          id: 'o1',
          content: [{ id: 't1', type: 'rich_text', format: 'md-math-v1', value: 'Option 1' }],
        },
      ],
      correctOptionIds: ['o999'], // Unknown ID
    }
    expect(() => AnswerSpecSchema.parse(invalidSpec)).toThrow(/does not exist in options/)
  })

  it('rejects mcq with unknown keys (strict mode)', () => {
    const invalidSpec = {
      questionType: 'mcq',
      multiSelect: false,
      options: [
        {
          id: 'o1',
          content: [{ id: 't1', type: 'rich_text', format: 'md-math-v1', value: 'Option 1' }],
        },
      ],
      correctOptionIds: ['o1'],
      unknownField: 'should be rejected', // Unknown field
    }
    expect(() => AnswerSpecSchema.parse(invalidSpec)).toThrow()
  })
})
