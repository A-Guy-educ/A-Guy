import { describe, it, expect } from 'vitest'
import { z, ZodError } from 'zod'
import { zodPathToDotPath, zodErrorToPayloadErrors } from '../../src/utilities/zodToPayloadError'

describe('zodPathToDotPath', () => {
  it('converts simple path to dot notation', () => {
    expect(zodPathToDotPath(['stem'])).toBe('stem')
  })

  it('converts nested path to dot notation', () => {
    expect(zodPathToDotPath(['stem', 'value'])).toBe('stem.value')
  })

  it('converts array index to dot notation', () => {
    expect(zodPathToDotPath(['stem', 0, 'value'])).toBe('stem.0.value')
  })

  it('converts deep nested path with arrays', () => {
    expect(zodPathToDotPath(['stem', 1, 'spec', 'elements', 'graphs', 0, 'fn'])).toBe(
      'stem.1.spec.elements.graphs.0.fn',
    )
  })

  it('handles empty path', () => {
    expect(zodPathToDotPath([])).toBe('')
  })
})

describe('zodErrorToPayloadErrors', () => {
  it('maps simple validation error with field prefix', () => {
    const schema = z.object({ stem: z.array(z.object({ value: z.string() })) })
    const result = schema.safeParse({})

    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = zodErrorToPayloadErrors(result.error, { fieldPrefix: 'contentJson' })

      expect(errors).toHaveLength(1)
      expect(errors[0].path).toBe('contentJson.stem')
      expect(errors[0].message).toBeTruthy()
    }
  })

  it('maps nested array validation error', () => {
    const schema = z.object({
      stem: z.array(
        z.object({
          id: z.string(),
          type: z.literal('rich_text'),
          value: z.string().min(1),
        }),
      ),
    })

    const result = schema.safeParse({
      stem: [{ id: 'b1', type: 'rich_text', value: '' }],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = zodErrorToPayloadErrors(result.error, { fieldPrefix: 'contentJson' })

      expect(errors).toHaveLength(1)
      expect(errors[0].path).toBe('contentJson.stem.0.value')
      expect(errors[0].message).toBeTruthy()
    }
  })

  it('maps deep nested validation error', () => {
    const schema = z.object({
      spec: z.object({
        elements: z.object({
          graphs: z.array(
            z.object({
              fn: z.string().min(1),
            }),
          ),
        }),
      }),
    })

    const result = schema.safeParse({
      spec: {
        elements: {
          graphs: [{ fn: '' }],
        },
      },
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = zodErrorToPayloadErrors(result.error, { fieldPrefix: 'answerSpecJson' })

      expect(errors).toHaveLength(1)
      expect(errors[0].path).toBe('answerSpecJson.spec.elements.graphs.0.fn')
    }
  })

  it('maps multiple validation errors', () => {
    const schema = z.object({
      options: z.array(z.object({ id: z.string() })).min(1),
      correctOptionIds: z.array(z.string()).min(1),
    })

    const result = schema.safeParse({
      options: [],
      correctOptionIds: [],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = zodErrorToPayloadErrors(result.error, { fieldPrefix: 'answerSpecJson' })

      expect(errors).toHaveLength(2)
      expect(errors[0].path).toBe('answerSpecJson.options')
      expect(errors[1].path).toBe('answerSpecJson.correctOptionIds')
    }
  })

  it('respects maxIssues limit', () => {
    const schema = z.object({
      a: z.string(),
      b: z.string(),
      c: z.string(),
      d: z.string(),
      e: z.string(),
    })

    const result = schema.safeParse({})

    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = zodErrorToPayloadErrors(result.error, {
        fieldPrefix: 'contentJson',
        maxIssues: 3,
      })

      expect(errors).toHaveLength(3)
    }
  })

  it('handles root-level validation error', () => {
    const schema = z.object({}).strict()
    const result = schema.safeParse({ extra: 'field' })

    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = zodErrorToPayloadErrors(result.error, { fieldPrefix: 'contentJson' })

      expect(errors.length).toBeGreaterThan(0)
      // Path should either be root field or include the invalid key
      expect(errors[0].path).toContain('contentJson')
    }
  })
})
