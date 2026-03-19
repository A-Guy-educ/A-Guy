import { describe, it, expect } from 'vitest'
import { GenerateSupportSchema } from '@/server/payload/endpoints/exercises/generate-support/schema'

describe('GenerateSupportSchema', () => {
  it('accepts valid section scope input', () => {
    const result = GenerateSupportSchema.safeParse({
      scope: 'section',
      id: 'exercise-123',
      blockId: 'block-1',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.scope).toBe('section')
      expect(result.data.options.overwrite).toBe(false)
      expect(result.data.options.targetFields).toEqual(['hints', 'solution', 'fullSolution'])
    }
  })

  it('accepts valid exercise scope input', () => {
    const result = GenerateSupportSchema.safeParse({
      scope: 'exercise',
      id: 'exercise-456',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid lesson scope input', () => {
    const result = GenerateSupportSchema.safeParse({
      scope: 'lesson',
      id: 'lesson-789',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid scope', () => {
    const result = GenerateSupportSchema.safeParse({
      scope: 'invalid',
      id: 'test-id',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty id', () => {
    const result = GenerateSupportSchema.safeParse({
      scope: 'section',
      id: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing id', () => {
    const result = GenerateSupportSchema.safeParse({
      scope: 'section',
    })
    expect(result.success).toBe(false)
  })

  it('applies default options when omitted', () => {
    const result = GenerateSupportSchema.safeParse({
      scope: 'exercise',
      id: 'ex-1',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.options).toEqual({
        overwrite: false,
        targetFields: ['hints', 'solution', 'fullSolution'],
      })
    }
  })

  it('allows overriding options', () => {
    const result = GenerateSupportSchema.safeParse({
      scope: 'section',
      id: 'ex-1',
      blockId: 'b1',
      options: {
        overwrite: true,
        targetFields: ['hints'],
      },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.options.overwrite).toBe(true)
      expect(result.data.options.targetFields).toEqual(['hints'])
    }
  })

  it('rejects invalid targetFields values', () => {
    const result = GenerateSupportSchema.safeParse({
      scope: 'section',
      id: 'ex-1',
      options: {
        targetFields: ['invalid_field'],
      },
    })
    expect(result.success).toBe(false)
  })

  it('blockId is optional', () => {
    const result = GenerateSupportSchema.safeParse({
      scope: 'exercise',
      id: 'ex-1',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.blockId).toBeUndefined()
    }
  })
})
