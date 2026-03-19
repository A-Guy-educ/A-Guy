import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for the pure functions in support-generation-service.
 * We test parseLLMResponse and mergeResults via the module's internal logic,
 * and mock the LLM adapter for the main generateSupport function.
 */

// Mock the genkit adapter
const mockGenerateChatCompletion = vi.fn()
vi.mock('@/infra/llm/genkit/adapters/unified-adapter', () => ({
  createGenkitUnifiedAdapter: vi.fn().mockResolvedValue({
    generateChatCompletion: (...args: unknown[]) => mockGenerateChatCompletion(...args),
  }),
}))

// Mock logger
vi.mock('@/infra/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}))

// Mock models
vi.mock('@/infra/llm/models', () => ({
  getModelRegistryEntry: vi.fn().mockReturnValue({
    temperature: 0.5,
    maxOutputTokens: 4096,
    capabilities: ['chat', 'generation'],
  }),
  getProviderModelName: vi.fn().mockReturnValue('gemini-pro'),
}))

import { generateSupport } from '@/infra/llm/services/support-generation-service'
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

function makeMcqBlock(): ContentBlock {
  return {
    id: 'block-1',
    type: 'question_select',
    variant: 'mcq',
    prompt: { type: 'rich_text', format: 'md-math-v1', value: 'What is 2+2?', mediaIds: [] },
    answer: {
      options: [
        { id: 'a', content: { type: 'rich_text', format: 'md-math-v1', value: '3', mediaIds: [] } },
        { id: 'b', content: { type: 'rich_text', format: 'md-math-v1', value: '4', mediaIds: [] } },
      ],
      correctOptionIds: ['b'],
    },
  } as unknown as ContentBlock
}

const mockPayload = {} as never

describe('generateSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed LLM response on success', async () => {
    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: JSON.stringify({
        hints: ['Think about addition', 'Count on your fingers'],
        solution: 'What operation combines two numbers?',
        fullSolution: '2 + 2 = 4',
      }),
    })

    const result = await generateSupport(
      {
        block: makeMcqBlock(),
        targetFields: ['hints', 'solution', 'fullSolution'],
      },
      mockPayload,
    )

    expect(result.success).toBe(true)
    expect(result.data?.hints).toEqual(['Think about addition', 'Count on your fingers'])
    expect(result.data?.solution).toBe('What operation combines two numbers?')
    expect(result.data?.fullSolution).toBe('2 + 2 = 4')
  })

  it('strips markdown code fences from LLM response', async () => {
    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: '```json\n{"hints":["h1"],"solution":"s","fullSolution":"fs"}\n```',
    })

    const result = await generateSupport(
      {
        block: makeMcqBlock(),
        targetFields: ['hints', 'solution', 'fullSolution'],
      },
      mockPayload,
    )

    expect(result.success).toBe(true)
    expect(result.data?.hints).toEqual(['h1'])
  })

  it('retries when LLM omits required fields', async () => {
    // First call returns incomplete response
    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: JSON.stringify({ hints: ['h1'], solution: '', fullSolution: '' }),
    })
    // Retry returns complete response
    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: JSON.stringify({
        hints: ['h1', 'h2'],
        solution: 'Think about it',
        fullSolution: 'Full answer here',
      }),
    })

    const result = await generateSupport(
      {
        block: makeMcqBlock(),
        targetFields: ['hints', 'solution', 'fullSolution'],
      },
      mockPayload,
    )

    expect(result.success).toBe(true)
    expect(mockGenerateChatCompletion).toHaveBeenCalledTimes(2)
    // Should merge: first hints preserved, retry fills solution/fullSolution
    expect(result.data?.hints).toEqual(['h1'])
    expect(result.data?.solution).toBe('Think about it')
    expect(result.data?.fullSolution).toBe('Full answer here')
  })

  it('returns error on LLM failure', async () => {
    mockGenerateChatCompletion.mockRejectedValueOnce(new Error('API rate limit exceeded'))

    const result = await generateSupport(
      {
        block: makeMcqBlock(),
        targetFields: ['hints', 'solution', 'fullSolution'],
      },
      mockPayload,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('API rate limit exceeded')
  })

  it('returns error on invalid JSON response', async () => {
    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: 'This is not JSON at all',
    })

    const result = await generateSupport(
      {
        block: makeMcqBlock(),
        targetFields: ['hints', 'solution', 'fullSolution'],
      },
      mockPayload,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})
