/**
 * Unit tests for system prompts fetcher
 */
import { fetchPublishedSystemPrompts } from '@/lib/ai/system-prompts.server'
import { logger } from '@/utilities/logger'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utilities/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}))

const mockPayload = {
  find: vi.fn(),
}

describe('fetchPublishedSystemPrompts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns published system prompts sorted by createdAt ASC (via DESC + reverse)', async () => {
    // Mock returns docs in DESC order (newest first)
    mockPayload.find.mockResolvedValue({
      docs: [
        { id: 'p2', title: 'Second (Newer)', template: 'Second system prompt' },
        { id: 'p1', title: 'First (Older)', template: 'First system prompt' },
      ],
    })

    const result = await fetchPublishedSystemPrompts(mockPayload as any)

    expect(result.count).toBe(2)
    // After reverse(), should be in ASC order (oldest first)
    expect(result.templates).toEqual(['First system prompt', 'Second system prompt'])
    expect(result.promptIds).toEqual(['p1', 'p2'])
    expect(result.promptTitles).toEqual(['First (Older)', 'Second (Newer)'])

    expect(mockPayload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: '-createdAt,-id',
        where: {
          and: [
            { type: { equals: 'system' } },
            { status: { equals: 'published' } },
          ],
        },
      }),
    )
  })

  it('returns empty array when no system prompts exist', async () => {
    mockPayload.find.mockResolvedValue({ docs: [] })

    const result = await fetchPublishedSystemPrompts(mockPayload as any)

    expect(result).toEqual({
      templates: [],
      count: 0,
      promptIds: [],
      promptTitles: [],
    })
    expect(logger.debug).toHaveBeenCalledWith(
      'No published system prompts found, proceeding without them',
    )
  })

  it('handles database errors gracefully', async () => {
    mockPayload.find.mockRejectedValue(new Error('DB connection failed'))

    const result = await fetchPublishedSystemPrompts(mockPayload as any)

    expect(result).toEqual({
      templates: [],
      count: 0,
      promptIds: [],
      promptTitles: [],
    })
    expect(logger.error).toHaveBeenCalled()
  })

  it('filters out prompts with empty templates', async () => {
    // Mock returns in DESC order, after reverse will be ASC
    mockPayload.find.mockResolvedValue({
      docs: [
        { id: 'p4', title: 'Also Valid', template: 'More content' },
        { id: 'p3', title: 'Whitespace', template: '   ' },
        { id: 'p2', title: 'Empty', template: '' },
        { id: 'p1', title: 'Valid', template: 'Valid content' },
      ],
    })

    const result = await fetchPublishedSystemPrompts(mockPayload as any)

    // After reverse and filter, should maintain order
    expect(result.templates).toEqual(['Valid content', 'More content'])
    expect(result.count).toBe(4) // count is all docs, templates is filtered
  })

  it('handles prompts with missing title gracefully', async () => {
    mockPayload.find.mockResolvedValue({
      docs: [
        { id: 'p1', title: null, template: 'Content' },
        { id: 'p2', title: undefined, template: 'More' },
      ],
    })

    const result = await fetchPublishedSystemPrompts(mockPayload as any)

    expect(result.promptTitles).toEqual(['Untitled', 'Untitled'])
  })

  it('excludes draft, archived, and non-system type prompts', async () => {
    // This test verifies the filter shape - actual filtering is done by DB query
    mockPayload.find.mockResolvedValue({ docs: [] })

    await fetchPublishedSystemPrompts(mockPayload as any)

    // Verify the where clause contains the correct filters
    expect(mockPayload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          and: [
            { type: { equals: 'system' } },
            { status: { equals: 'published' } },
          ],
        },
      }),
    )
  })

  it('maintains deterministic order with createdAt ASC (via DESC + reverse)', async () => {
    // Mock returns docs in DESC order (newest first, id as tiebreaker)
    // After reverse, should be ASC order (oldest first)
    mockPayload.find.mockResolvedValue({
      docs: [
        { id: 'id3', title: 'Third (Newest)', template: 'Third content', createdAt: '2024-01-03T00:00:00Z' },
        { id: 'id2', title: 'Second (Middle)', template: 'Second content', createdAt: '2024-01-02T00:00:00Z' },
        { id: 'id1', title: 'First (Oldest)', template: 'First content', createdAt: '2024-01-01T00:00:00Z' },
      ],
    })

    const result = await fetchPublishedSystemPrompts(mockPayload as any)

    // After reverse, should be in ASC order (oldest first)
    expect(result.templates).toEqual(['First content', 'Second content', 'Third content'])
    expect(result.promptIds).toEqual(['id1', 'id2', 'id3'])
  })
})
