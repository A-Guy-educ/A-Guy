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

  it('returns published system prompts sorted by createdAt,id', async () => {
    mockPayload.find.mockResolvedValue({
      docs: [
        { id: 'p1', title: 'First', template: 'First system prompt' },
        { id: 'p2', title: 'Second', template: 'Second system prompt' },
      ],
    })

    const result = await fetchPublishedSystemPrompts(mockPayload as any)

    expect(result.count).toBe(2)
    expect(result.templates).toEqual(['First system prompt', 'Second system prompt'])
    expect(result.promptIds).toEqual(['p1', 'p2'])
    expect(result.promptTitles).toEqual(['First', 'Second'])

    expect(mockPayload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: 'createdAt,id',
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
    mockPayload.find.mockResolvedValue({
      docs: [
        { id: 'p1', title: 'Valid', template: 'Valid content' },
        { id: 'p2', title: 'Empty', template: '' },
        { id: 'p3', title: 'Whitespace', template: '   ' },
        { id: 'p4', title: 'Also Valid', template: 'More content' },
      ],
    })

    const result = await fetchPublishedSystemPrompts(mockPayload as any)

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
})
