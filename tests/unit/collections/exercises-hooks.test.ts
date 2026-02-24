/**
 * @fileType unit-test
 * @domain exercises
 * @pattern slug-generation, transaction-safety
 * @ai-summary Unit tests for Exercises hooks: generateSlug and validateSlugUniqueness
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Create mock function at module level
const mockFind = vi.fn()

// Import after mocks are set up
import { generateSlug, validateSlugUniqueness } from '@/server/payload/collections/Exercises/hooks'

describe('Exercises Hooks - generateSlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the module to clear any cached calls
    vi.resetModules()

    mockFind.mockResolvedValue({ docs: [] })
  })

  // Helper to create minimal FieldHookArgs
  const createHookArgs = (overrides: Record<string, unknown> = {}): any => {
    const defaultReq = { payload: { find: mockFind } }
    return {
      value: undefined as any,
      operation: 'create',
      originalDoc: undefined as any,
      siblingData: {},
      req: defaultReq as any,
      collection: { config: { slug: 'exercises' } } as any,
      context: {},
      field: { name: 'slug', type: 'text' } as any,
      data: {},
      blockData: {},
      path: 'slug' as any,
      ...overrides,
    }
  }

  describe('normal slug generation', () => {
    it('returns formatted slug when no conflict exists', async () => {
      mockFind.mockResolvedValue({ docs: [] })

      const result = await generateSlug(
        createHookArgs({
          siblingData: { title: 'Test Exercise', lesson: 'lesson-1' },
        }),
      )

      expect(result).toBe('test-exercise')
      // find is called once to check for conflicts
      expect(mockFind).toHaveBeenCalledTimes(1)
    })

    it('returns provided value if already a valid slug', async () => {
      const result = await generateSlug(
        createHookArgs({
          value: 'existing-slug',
          siblingData: { title: 'Test Exercise', lesson: 'lesson-1' },
        }),
      )

      expect(result).toBe('existing-slug')
    })

    it('returns undefined when no title and no value', async () => {
      const result = await generateSlug(
        createHookArgs({
          siblingData: {},
        }),
      )

      expect(result).toBeUndefined()
    })
  })

  describe('incremented slug generation', () => {
    it('appends -1 when base slug conflicts', async () => {
      // First call returns a conflict, second call returns no conflict
      mockFind
        .mockResolvedValueOnce({ docs: [{ id: 'existing-1', slug: 'test-exercise' }] })
        .mockResolvedValueOnce({ docs: [] })

      const result = await generateSlug(
        createHookArgs({
          siblingData: { title: 'Test Exercise', lesson: 'lesson-1' },
        }),
      )

      expect(result).toBe('test-exercise-1')
    })

    it('appends -2 when first increment also conflicts', async () => {
      // First two calls return conflicts, third returns no conflict
      mockFind
        .mockResolvedValueOnce({ docs: [{ id: 'existing-1', slug: 'test-exercise' }] })
        .mockResolvedValueOnce({ docs: [{ id: 'existing-2', slug: 'test-exercise-1' }] })
        .mockResolvedValueOnce({ docs: [] })

      const result = await generateSlug(
        createHookArgs({
          siblingData: { title: 'Test Exercise', lesson: 'lesson-1' },
        }),
      )

      expect(result).toBe('test-exercise-2')
    })

    it('does not increment when conflicting doc is the same as originalDoc', async () => {
      mockFind.mockResolvedValue({ docs: [] })

      const result = await generateSlug(
        createHookArgs({
          operation: 'update',
          originalDoc: { id: 'exercise-1', title: 'Test Exercise', lesson: 'lesson-1' },
          siblingData: { title: 'Test Exercise', lesson: 'lesson-1' },
        }),
      )

      // No slug check needed since no conflicts found
      expect(result).toBe('test-exercise')
    })
  })

  describe('infinite loop protection (FR-001, FR-002, NFR-001)', () => {
    it('throws an error after MAX_SLUG_ATTEMPTS when slug is never unique', async () => {
      // Mock req.payload.find to ALWAYS return a conflicting doc
      // This simulates a race condition or bug where uniqueness can never be achieved
      const mockFind = vi
        .fn()
        .mockResolvedValue({ docs: [{ id: 'conflict-1', slug: 'test-exercise' }] })
      const mockReq = {
        payload: { find: mockFind },
      }

      // Attempt to generate slug - should throw after MAX_ATTEMPTS instead of hanging forever
      await expect(
        generateSlug(
          createHookArgs({
            siblingData: { title: 'Test Exercise', lesson: 'lesson-1' },
            req: mockReq as any,
          }),
        ),
      ).rejects.toThrow(/Unable to generate unique slug after \d+ attempts/)

      // Verify it tried multiple times (not infinite)
      expect(mockFind).toHaveBeenCalled()
    })

    it('throws error with specific message about max attempts', async () => {
      const mockFind = vi
        .fn()
        .mockResolvedValue({ docs: [{ id: 'conflict-1', slug: 'test-exercise' }] })
      const mockReq = {
        payload: { find: mockFind },
      }

      // The error message should mention the attempt limit
      await expect(
        generateSlug(
          createHookArgs({
            siblingData: { title: 'Test Exercise', lesson: 'lesson-1' },
            req: mockReq as any,
          }),
        ),
      ).rejects.toThrow(/attempt/i)
    })
  })

  describe('transaction safety (FR-003)', () => {
    it('uses req.payload.find when req is available', async () => {
      const mockFind = vi.fn().mockResolvedValue({ docs: [] })
      const mockReq = {
        payload: { find: mockFind },
      }

      await generateSlug(
        createHookArgs({
          siblingData: { title: 'Test Exercise', lesson: 'lesson-1' },
          req: mockReq as any,
        }),
      )

      // Should use req.payload.find, NOT getPayloadInstance
      expect(mockFind).toHaveBeenCalled()

      // Verify it was called with the correct parameters including req and depth: 0
      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'exercises',
          where: {
            and: [{ lesson: { equals: 'lesson-1' } }, { slug: { equals: 'test-exercise' } }],
          },
          limit: 1,
          depth: 0,
          req: mockReq,
        }),
      )
    })

    it('passes req to payload.find for transaction safety', async () => {
      const mockFind = vi.fn().mockResolvedValue({ docs: [] })
      const mockReq = {
        payload: { find: mockFind },
      }

      await generateSlug(
        createHookArgs({
          siblingData: { title: 'Test Exercise', lesson: 'lesson-1' },
          req: mockReq as any,
        }),
      )

      // Verify req is passed to maintain transaction context
      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          req: mockReq,
        }),
      )
    })

    it('uses depth: 0 for efficient queries', async () => {
      const mockFind = vi.fn().mockResolvedValue({ docs: [] })
      const mockReq = {
        payload: { find: mockFind },
      }

      await generateSlug(
        createHookArgs({
          siblingData: { title: 'Test Exercise', lesson: 'lesson-1' },
          req: mockReq as any,
        }),
      )

      // Verify depth: 0 is used to avoid over-fetching
      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          depth: 0,
        }),
      )
    })
  })

  describe('delete operation', () => {
    it('returns value unchanged for delete operation', async () => {
      const result = await generateSlug(
        createHookArgs({
          value: 'test-slug',
          operation: 'delete',
          siblingData: { title: 'Test', lesson: 'lesson-1' },
        }),
      )

      expect(result).toBe('test-slug')
    })
  })
})

describe('Exercises Hooks - validateSlugUniqueness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    mockFind.mockResolvedValue({ docs: [] })
  })

  // Helper to create minimal FieldHookArgs
  const createHookArgs = (overrides: Record<string, unknown> = {}): any => {
    const defaultReq = { payload: { find: mockFind } }
    return {
      value: undefined as any,
      operation: 'create',
      originalDoc: undefined as any,
      siblingData: {},
      req: defaultReq as any,
      collection: { config: { slug: 'exercises' } } as any,
      context: {},
      field: { name: 'slug', type: 'text' } as any,
      data: {},
      blockData: {},
      path: 'slug' as any,
      ...overrides,
    }
  }

  it('returns value when no conflict exists', async () => {
    mockFind.mockResolvedValue({ docs: [] })

    const result = await validateSlugUniqueness(
      createHookArgs({
        value: 'test-slug',
        siblingData: { lesson: 'lesson-1' },
      }),
    )

    expect(result).toBe('test-slug')
  })

  it('throws error when slug conflicts with another exercise', async () => {
    mockFind.mockResolvedValue({
      docs: [{ id: 'other-exercise', slug: 'test-slug' }],
    })

    await expect(
      validateSlugUniqueness(
        createHookArgs({
          value: 'test-slug',
          originalDoc: { id: 'my-exercise' },
          siblingData: { lesson: 'lesson-1' },
        }),
      ),
    ).rejects.toThrow('An exercise with this slug already exists in this lesson')
  })

  it('allows same slug when updating own document', async () => {
    mockFind.mockResolvedValue({
      docs: [{ id: 'my-exercise', slug: 'test-slug' }],
    })

    const result = await validateSlugUniqueness(
      createHookArgs({
        value: 'test-slug',
        operation: 'update',
        originalDoc: { id: 'my-exercise' },
        siblingData: { lesson: 'lesson-1' },
      }),
    )

    expect(result).toBe('test-slug')
  })

  it('returns value for delete operation', async () => {
    const result = await validateSlugUniqueness(
      createHookArgs({
        value: 'test-slug',
        operation: 'delete',
        siblingData: { lesson: 'lesson-1' },
      }),
    )

    expect(result).toBe('test-slug')
  })

  it('returns value when no lesson is provided', async () => {
    const result = await validateSlugUniqueness(
      createHookArgs({
        value: 'test-slug',
        siblingData: {},
      }),
    )

    expect(result).toBe('test-slug')
    expect(mockFind).not.toHaveBeenCalled()
  })

  it('returns value when value is empty', async () => {
    const result = await validateSlugUniqueness(
      createHookArgs({
        value: '',
        siblingData: { lesson: 'lesson-1' },
      }),
    )

    expect(result).toBe('')
  })
})
