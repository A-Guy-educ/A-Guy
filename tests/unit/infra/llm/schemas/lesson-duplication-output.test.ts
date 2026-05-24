import { describe, it, expect } from 'vitest'
import {
  buildPass1JsonSchemaForExercise,
  deriveJsonSchemaFromValue,
  LessonVariationOutputSchema,
  SolutionDerivationOutputSchema,
} from '@/infra/llm/schemas/lesson-duplication-output'

describe('LessonVariationOutputSchema', () => {
  it('accepts a minimal valid envelope', () => {
    const result = LessonVariationOutputSchema.safeParse({
      content: { blocks: [{ id: 'b1', type: 'question_select' }] },
    })
    expect(result.success).toBe(true)
  })

  it('preserves block-specific fields via passthrough', () => {
    const parsed = LessonVariationOutputSchema.parse({
      content: {
        blocks: [
          {
            id: 'b1',
            type: 'question_select',
            variant: 'mcq',
            answer: { options: [], correctOptionIds: ['a'] },
          },
        ],
      },
    }) as { content: { blocks: Array<Record<string, unknown>> } }

    expect(parsed.content.blocks[0]).toMatchObject({
      id: 'b1',
      type: 'question_select',
      variant: 'mcq',
    })
  })

  it('rejects missing content.blocks', () => {
    expect(LessonVariationOutputSchema.safeParse({ content: {} }).success).toBe(false)
  })

  it('accepts empty blocks array (length constraints removed for Gemini compatibility)', () => {
    expect(LessonVariationOutputSchema.safeParse({ content: { blocks: [] } }).success).toBe(true)
  })

  it('rejects block missing id or type', () => {
    expect(
      LessonVariationOutputSchema.safeParse({
        content: { blocks: [{ id: 'b1' }] },
      }).success,
    ).toBe(false)
    expect(
      LessonVariationOutputSchema.safeParse({
        content: { blocks: [{ type: 'rich_text' }] },
      }).success,
    ).toBe(false)
  })
})

describe('SolutionDerivationOutputSchema', () => {
  it('accepts the full canonical pass-2 per-block shape', () => {
    const result = SolutionDerivationOutputSchema.safeParse({
      blocks: [
        {
          id: 'q1',
          solution: { type: 'rich_text', format: 'md-math-v1', value: 's', mediaIds: [] },
          fullSolution: { type: 'rich_text', format: 'md-math-v1', value: 'fs', mediaIds: [] },
          answer: { correctOptionIds: ['a'] },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty blocks array (exercise with no question blocks)', () => {
    expect(SolutionDerivationOutputSchema.safeParse({ blocks: [] }).success).toBe(true)
  })

  it('accepts block with only solution (no answer needed for free_response)', () => {
    const result = SolutionDerivationOutputSchema.safeParse({
      blocks: [
        {
          id: 'q1',
          solution: { type: 'rich_text', format: 'md-math-v1', value: 's', mediaIds: [] },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-rich_text solution in a block', () => {
    expect(
      SolutionDerivationOutputSchema.safeParse({
        blocks: [{ id: 'q1', solution: 'plain string' }],
      }).success,
    ).toBe(false)
  })

  it('strips extra answer fields without failing', () => {
    // Zod's default is to strip unknown keys silently, so the parse succeeds
    // and returns only the schema-declared fields.
    const result = SolutionDerivationOutputSchema.parse({
      blocks: [
        {
          id: 'q1',
          answer: { correctOptionIds: ['a'], extra: 'ignored-not-rejected' },
        },
      ],
    }) as { blocks: Array<{ id: string; answer: Record<string, unknown> }> }
    expect(result.blocks[0].answer.correctOptionIds).toEqual(['a'])
  })
})

describe('deriveJsonSchemaFromValue', () => {
  it('builds primitive types', () => {
    expect(deriveJsonSchemaFromValue('hi')).toEqual({ type: 'string', enum: ['hi'] })
    expect(deriveJsonSchemaFromValue(3)).toEqual({ type: 'integer' })
    expect(deriveJsonSchemaFromValue(3.14)).toEqual({ type: 'number' })
    expect(deriveJsonSchemaFromValue(true)).toEqual({ type: 'boolean' })
    expect(deriveJsonSchemaFromValue(null)).toEqual({ type: 'string' })
  })

  it('walks objects with required-on-every-field semantics', () => {
    const schema = deriveJsonSchemaFromValue({ id: 'b1', value: 7 }) as {
      type: string
      properties: Record<string, unknown>
      required: string[]
    }
    expect(schema.type).toBe('object')
    expect(schema.properties.id).toEqual({ type: 'string', enum: ['b1'] })
    expect(schema.properties.value).toEqual({ type: 'integer' })
    expect(schema.required).toEqual(['id', 'value'])
  })

  it('collapses single-shape arrays into plain `items`', () => {
    const schema = deriveJsonSchemaFromValue([{ a: 1 }, { a: 2 }, { a: 3 }]) as {
      type: string
      items: { type: string }
    }
    expect(schema.type).toBe('array')
    expect(schema.items.type).toBe('object')
  })

  it('builds anyOf when array items have heterogeneous shapes', () => {
    const schema = deriveJsonSchemaFromValue([
      { type: 'rich_text', value: 'x' },
      { type: 'question_select', variant: 'mcq' },
    ]) as { type: string; items: { anyOf: unknown[] } }
    expect(schema.type).toBe('array')
    expect(schema.items.anyOf).toBeDefined()
    expect(schema.items.anyOf).toHaveLength(2)
  })

  it('falls back to string items on empty arrays (no shape info)', () => {
    expect(deriveJsonSchemaFromValue([])).toEqual({
      type: 'array',
      items: { type: 'string' },
    })
  })
})

describe('buildPass1JsonSchemaForExercise', () => {
  it('wraps the input blocks schema in a closed content envelope', () => {
    const exercise = {
      content: {
        blocks: [{ id: 'b1', type: 'rich_text', value: 'hello' }],
      },
    }
    const schema = buildPass1JsonSchemaForExercise(exercise) as {
      type: string
      properties: { content: { type: string; properties: { blocks: unknown } } }
      required: string[]
    }
    expect(schema.type).toBe('object')
    expect(schema.required).toEqual(['content'])
    expect(schema.properties.content.type).toBe('object')
    expect(schema.properties.content.properties.blocks).toBeDefined()
  })

  it('tolerates missing/empty content', () => {
    expect(buildPass1JsonSchemaForExercise({})).toBeDefined()
    expect(buildPass1JsonSchemaForExercise({ content: null })).toBeDefined()
    expect(buildPass1JsonSchemaForExercise({ content: { blocks: [] } })).toBeDefined()
  })

  // Schema shape: blocksSchema = { type: 'array', items: BlockObjectSchema | { anyOf: BlockObjectSchema[] } }
  // For single block: items = BlockObjectSchema (with properties.id, properties.type, etc.)
  // For heterogeneous: items = { anyOf: BlockObjectSchema[] }

  it('adds hint/solution/fullSolution slots to question_free_response blocks missing them', () => {
    // Source has a question block with no hint, solution, or fullSolution
    const exercise = {
      content: {
        blocks: [{ id: 'q1', type: 'question_free_response', prompt: 'What is 2+2?' }],
      },
    }
    const schema = buildPass1JsonSchemaForExercise(exercise) as {
      type: string
      properties: {
        content: {
          properties: { blocks: unknown }
        }
      }
    }
    const blocksSchema = schema.properties.content.properties.blocks as {
      type: string
      items: { type: string; properties: Record<string, unknown>; required: string[] }
    }
    // Single block: items is the block object schema directly
    expect(blocksSchema.type).toBe('array')
    const blockSchema = blocksSchema.items
    expect(blockSchema.properties.hint).toBeDefined()
    expect(blockSchema.properties.solution).toBeDefined()
    expect(blockSchema.properties.fullSolution).toBeDefined()
    expect(blockSchema.required).toContain('hint')
    expect(blockSchema.required).toContain('fullSolution')
    // Source fields still present
    expect(blockSchema.properties.prompt).toBeDefined()
  })

  it('preserves existing hint/solution/fullSolution sub-schema when source already has them', () => {
    // Source has a question_select with an existing hint shape
    const exercise = {
      content: {
        blocks: [
          {
            id: 'q1',
            type: 'question_select',
            hint: { type: 'rich_text', format: 'md-math-v1', value: 'Try again' },
            solution: { type: 'rich_text', format: 'md-math-v1', value: 'The answer is A' },
          },
        ],
      },
    }
    const schema = buildPass1JsonSchemaForExercise(exercise) as {
      type: string
      properties: {
        content: {
          properties: { blocks: unknown }
        }
      }
    }
    const blocksSchema = schema.properties.content.properties.blocks as {
      items: { properties: Record<string, unknown>; required: string[] }
    }
    const blockSchema = blocksSchema.items
    // hint and solution from source should be preserved with their original sub-schema
    // deriveJsonSchemaFromValue derives { type: 'object', properties: { type: { type: 'string' }, ... } }
    // for a rich_text object — the source shape is preserved
    expect(blockSchema.properties.hint).toMatchObject({
      type: 'object',
      properties: {
        type: { type: 'string' },
        format: { type: 'string' },
        value: { type: 'string' },
      },
    })
    expect(blockSchema.properties.solution).toMatchObject({
      type: 'object',
      properties: {
        type: { type: 'string' },
        format: { type: 'string' },
        value: { type: 'string' },
      },
    })
    // fullSolution should still be added (wasn't in source)
    expect(blockSchema.properties.fullSolution).toBeDefined()
    expect(blockSchema.required).toContain('fullSolution')
  })

  it('does not add hint/solution/fullSolution to non-question blocks', () => {
    const exercise = {
      content: {
        blocks: [
          { id: 'b1', type: 'rich_text', value: 'Some text' },
          { id: 'b2', type: 'svg', content: '<svg></svg>' },
          { id: 'b3', type: 'latex', latex: 'E=mc^2' },
        ],
      },
    }
    const schema = buildPass1JsonSchemaForExercise(exercise) as {
      type: string
      properties: {
        content: {
          properties: { blocks: unknown }
        }
      }
    }
    const blocksSchema = schema.properties.content.properties.blocks as {
      items: { anyOf: Array<{ properties: Record<string, unknown>; required: string[] }> }
    }
    expect(blocksSchema.items.anyOf).toBeDefined()
    for (const variant of blocksSchema.items.anyOf) {
      // Non-question blocks should NOT have hint/solution/fullSolution added
      const typeVal = variant.properties.type as { const?: string } | undefined
      const typeStr = typeVal?.const ?? ''
      if (!typeStr.startsWith('question_')) {
        expect(variant.properties.hint).toBeUndefined()
        expect(variant.properties.solution).toBeUndefined()
        expect(variant.properties.fullSolution).toBeUndefined()
      }
    }
  })

  it('adds hint/solution/fullSolution to all question_* block variants', () => {
    const questionTypes = [
      'question_select',
      'question_free_response',
      'question_table',
      'question_matching',
      'question_geometry',
      'question_axis',
      'question_multi_axis',
    ]
    for (const type of questionTypes) {
      const exercise = {
        content: {
          blocks: [{ id: 'q1', type, prompt: 'Sample prompt' }],
        },
      }
      const schema = buildPass1JsonSchemaForExercise(exercise) as unknown as {
        properties: {
          content: {
            properties: { blocks: unknown }
          }
        }
      }
      const blocksSchema = schema.properties.content.properties.blocks as {
        items: { properties: Record<string, unknown>; required: string[] }
      }
      const blockSchema = blocksSchema.items
      ;(expect(blockSchema.properties.hint).toBeDefined(), `${type}: hint should be defined`)
      ;(expect(blockSchema.properties.solution).toBeDefined(),
        `${type}: solution should be defined`)
      ;(expect(blockSchema.properties.fullSolution).toBeDefined(),
        `${type}: fullSolution should be defined`)
      ;(expect(blockSchema.required).toContain('hint'), `${type}: hint should be required`)
      ;(expect(blockSchema.required).toContain('fullSolution'),
        `${type}: fullSolution should be required`)
    }
  })

  it('augments question blocks inside anyOf heterogeneous block arrays', () => {
    // Mix of question and non-question blocks → anyOf schema
    const exercise = {
      content: {
        blocks: [
          { id: 'b1', type: 'rich_text', value: 'intro' },
          { id: 'q1', type: 'question_select', prompt: 'MCQ?' },
          { id: 'q2', type: 'question_free_response', prompt: 'FRQ?' },
        ],
      },
    }
    const schema = buildPass1JsonSchemaForExercise(exercise) as unknown as {
      properties: {
        content: {
          properties: { blocks: unknown }
        }
      }
    }
    const blocksSchema = schema.properties.content.properties.blocks as {
      type: string
      items: { anyOf: Array<{ properties: Record<string, unknown>; required: string[] }> }
    }
    expect(blocksSchema.type).toBe('array')
    expect(blocksSchema.items.anyOf).toBeDefined()
    // Each question variant should have hint/solution/fullSolution added
    for (const variant of blocksSchema.items.anyOf) {
      const typeVal = variant.properties.type as { const?: string } | undefined
      const typeStr = typeVal?.const ?? ''
      if (typeStr.startsWith('question_')) {
        expect(variant.properties.hint).toBeDefined()
        expect(variant.properties.solution).toBeDefined()
        expect(variant.properties.fullSolution).toBeDefined()
        expect(variant.required).toContain('hint')
        expect(variant.required).toContain('fullSolution')
      }
    }
  })
})
