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
  it('accepts the full canonical pass-2 shape', () => {
    const result = SolutionDerivationOutputSchema.safeParse({
      solution: { type: 'rich_text', format: 'md-math-v1', value: 's', mediaIds: [] },
      fullSolution: { type: 'rich_text', format: 'md-math-v1', value: 'fs', mediaIds: [] },
      answer: { correctOptionIds: ['a'] },
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (every field is optional for non-MCQ blocks)', () => {
    expect(SolutionDerivationOutputSchema.safeParse({}).success).toBe(true)
  })

  it('rejects non-rich_text solution', () => {
    expect(SolutionDerivationOutputSchema.safeParse({ solution: 'plain string' }).success).toBe(
      false,
    )
  })

  it('strips extra answer fields without failing', () => {
    // Zod's default is to strip unknown keys silently, so the parse succeeds
    // and returns only the schema-declared fields.
    const result = SolutionDerivationOutputSchema.parse({
      answer: { correctOptionIds: ['a'], extra: 'ignored-not-rejected' },
    }) as { answer: Record<string, unknown> }
    expect(result.answer.correctOptionIds).toEqual(['a'])
  })
})

describe('deriveJsonSchemaFromValue', () => {
  it('builds primitive types', () => {
    expect(deriveJsonSchemaFromValue('hi')).toEqual({ type: 'string' })
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
    expect(schema.properties.id).toEqual({ type: 'string' })
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
})
