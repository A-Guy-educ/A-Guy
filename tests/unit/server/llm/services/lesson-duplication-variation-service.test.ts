import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for lesson-duplication-variation-service.
 *
 * Tests the generateVariation function with light/medium/deep levels,
 * verifying retry behavior and logging.
 */

// Mock the genkit adapter
vi.mock('@/infra/llm/genkit/adapters/unified-adapter', () => ({
  createGenkitUnifiedAdapter: vi.fn(),
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
    temperature: 0.3,
    maxOutputTokens: 8192,
    capabilities: ['chat', 'generation'],
  }),
  getProviderModelName: vi.fn().mockReturnValue('gemini-3.1-pro'),
}))

import { generateVariation } from '@/infra/llm/services/lesson-duplication-variation-service'
import { VariationGenerationError } from '@/infra/llm/errors'
import type { Exercise } from '@/payload-types'
import { logger } from '@/infra/utils/logger'
import { createGenkitUnifiedAdapter } from '@/infra/llm/genkit/adapters/unified-adapter'

const mockPayload = {} as never

function makeMockExercise(id: string): Exercise {
  return {
    id,
    tenant: 'test-tenant',
    locale: 'en',
    lesson: 'test-lesson',
    origin: 'manual',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    content: {
      blocks: [
        {
          id: 'block-1',
          type: 'question_select',
          variant: 'mcq',
          prompt: {
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'What is $2+2$?',
            mediaIds: [],
          },
          answer: {
            options: [
              {
                id: 'a',
                content: { type: 'rich_text', format: 'md-math-v1', value: '3', mediaIds: [] },
              },
              {
                id: 'b',
                content: { type: 'rich_text', format: 'md-math-v1', value: '4', mediaIds: [] },
              },
            ],
            correctOptionIds: ['b'],
          },
        },
      ],
    },
  } as Exercise
}

describe('generateVariation', () => {
  /** Reference to generateChatCompletion mock, set up fresh in each test */
  let mockGenerateChatCompletion: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    // Use resetAllMocks to clear mockReturnValue/mocksResolvedValue queues too
    vi.resetAllMocks()

    // Create fresh mock for generateChatCompletion each test
    mockGenerateChatCompletion = vi.fn()
    ;(createGenkitUnifiedAdapter as ReturnType<typeof vi.fn>).mockResolvedValue({
      generateChatCompletion: mockGenerateChatCompletion,
    })
  })

  it('returns exercise with only numeric values changed for light level', async () => {
    // Light variation: only numeric values changed, phrasing preserved
    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: JSON.stringify({
        content: {
          blocks: [
            {
              id: 'block-1',
              type: 'question_select',
              variant: 'mcq',
              prompt: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: 'What is $3+3$?',
                mediaIds: [],
              },
              answer: {
                options: [
                  {
                    id: 'a',
                    content: { type: 'rich_text', format: 'md-math-v1', value: '6', mediaIds: [] },
                  },
                  {
                    id: 'b',
                    content: { type: 'rich_text', format: 'md-math-v1', value: '9', mediaIds: [] },
                  },
                ],
                correctOptionIds: ['a'],
              },
            },
          ],
        },
      }),
    })

    const inputExercise = makeMockExercise('ex-1')
    const result = await generateVariation({ exercise: inputExercise, level: 'light' }, mockPayload)

    expect(result.exercise).toBeDefined()
    // Verify the result has different numeric values
    const resultBlock = (result.exercise.content as { blocks: unknown[] }).blocks[0] as {
      prompt: { value: string }
      answer: { options: Array<{ content: { value: string } }> }
    }
    expect(resultBlock.prompt.value).toBe('What is $3+3$?')
    expect(resultBlock.answer.options[0].content.value).toBe('6')
  })

  it('returns exercise with reworded phrasing for medium level', async () => {
    // Medium variation: phrasing reworded, structure preserved
    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: JSON.stringify({
        content: {
          blocks: [
            {
              id: 'block-1',
              type: 'question_select',
              variant: 'mcq',
              prompt: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: 'Calculate $2+2$.',
                mediaIds: [],
              },
              answer: {
                options: [
                  {
                    id: 'a',
                    content: { type: 'rich_text', format: 'md-math-v1', value: '3', mediaIds: [] },
                  },
                  {
                    id: 'b',
                    content: { type: 'rich_text', format: 'md-math-v1', value: '4', mediaIds: [] },
                  },
                ],
                correctOptionIds: ['b'],
              },
            },
          ],
        },
      }),
    })

    const inputExercise = makeMockExercise('ex-2')
    const result = await generateVariation(
      { exercise: inputExercise, level: 'medium' },
      mockPayload,
    )

    expect(result.exercise).toBeDefined()
    // Verify phrasing changed (same numbers, different wording)
    const resultBlock = (result.exercise.content as { blocks: unknown[] }).blocks[0] as {
      prompt: { value: string }
    }
    expect(resultBlock.prompt.value).toBe('Calculate $2+2$.')
  })

  it('may add/remove sections but produces no PNG fields for deep level', async () => {
    // Deep variation: values, functions, sections may change
    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: JSON.stringify({
        content: {
          blocks: [
            {
              id: 'block-1',
              type: 'question_select',
              variant: 'mcq',
              prompt: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: 'Solve for x: $3x + 6 = 12$.',
                mediaIds: [],
              },
              answer: {
                options: [
                  {
                    id: 'a',
                    content: {
                      type: 'rich_text',
                      format: 'md-math-v1',
                      value: 'x=1',
                      mediaIds: [],
                    },
                  },
                  {
                    id: 'b',
                    content: {
                      type: 'rich_text',
                      format: 'md-math-v1',
                      value: 'x=2',
                      mediaIds: [],
                    },
                  },
                ],
                correctOptionIds: ['b'],
              },
            },
          ],
        },
      }),
    })

    const inputExercise = makeMockExercise('ex-3')
    const result = await generateVariation({ exercise: inputExercise, level: 'deep' }, mockPayload)

    expect(result.exercise).toBeDefined()
    // Verify no PNG fields in the result
    const resultText = JSON.stringify(result.exercise)
    expect(resultText).not.toMatch(/\.png/i)
    expect(resultText).not.toMatch(/image\/png/i)
  })

  it('triggers exactly one retry on invalid JSON then throws VariationGenerationError', async () => {
    // First call returns invalid JSON → JSON.parse throws → retry
    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: 'not json {',
    })
    // Second call also returns invalid JSON → JSON.parse throws → retry exhausted → throw
    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: 'still not json',
    })

    const inputExercise = makeMockExercise('ex-4')

    await expect(
      generateVariation({ exercise: inputExercise, level: 'light' }, mockPayload),
    ).rejects.toThrow(VariationGenerationError)

    // With the fix: each generateVariation makes 2 adapter calls (initial + one retry)
    // This first call consumed both queued responses
    expect(mockGenerateChatCompletion).toHaveBeenCalledTimes(2)

    // Set up fresh queue for second call
    mockGenerateChatCompletion.mockResolvedValueOnce({ text: 'also invalid' })
    mockGenerateChatCompletion.mockResolvedValueOnce({ text: 'still invalid' })

    await expect(
      generateVariation({ exercise: inputExercise, level: 'light' }, mockPayload),
    ).rejects.toMatchObject({
      exerciseId: 'ex-4',
    })

    // Second generateVariation also makes 2 adapter calls
    expect(mockGenerateChatCompletion).toHaveBeenCalledTimes(4)
  })

  it('logs latency, level, exerciseId, retryCount per successful call', async () => {
    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: JSON.stringify({
        content: {
          blocks: [
            {
              id: 'block-1',
              type: 'question_select',
              variant: 'mcq',
              prompt: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: 'What is $5+5$?',
                mediaIds: [],
              },
              answer: {
                options: [
                  {
                    id: 'a',
                    content: { type: 'rich_text', format: 'md-math-v1', value: '10', mediaIds: [] },
                  },
                ],
                correctOptionIds: ['a'],
              },
            },
          ],
        },
      }),
    })

    const inputExercise = makeMockExercise('ex-5')
    await generateVariation({ exercise: inputExercise, level: 'light' }, mockPayload)

    expect(logger.info).toHaveBeenCalledTimes(1)
    const logCall = (logger.info as ReturnType<typeof vi.fn>).mock.calls[0]
    const logObject = logCall[0] as Record<string, unknown>
    expect(logObject).toHaveProperty('latencyMs')
    expect(logObject).toHaveProperty('level', 'light')
    expect(logObject).toHaveProperty('exerciseId', 'ex-5')
    expect(logObject).toHaveProperty('retryCount', 0)
  })

  it('throws VariationGenerationError with correct exerciseId and reason on non-retryable error', async () => {
    // Simulate a non-JSON error (e.g., LLM API error)
    mockGenerateChatCompletion.mockImplementation(() => Promise.reject(new Error('API timeout')))

    const inputExercise = makeMockExercise('ex-6')

    let error: unknown
    try {
      await generateVariation({ exercise: inputExercise, level: 'medium' }, mockPayload)
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(VariationGenerationError)
    expect((error as VariationGenerationError).exerciseId).toBe('ex-6')
    expect((error as VariationGenerationError).reason).toBe('API timeout')

    // Should not have retried for non-JSON errors (only one call made)
    expect(mockGenerateChatCompletion).toHaveBeenCalledTimes(1)
  })

  it('strips markdown code fences from LLM response', async () => {
    mockGenerateChatCompletion.mockResolvedValueOnce({
      text:
        '```json\n' +
        JSON.stringify({
          content: {
            blocks: [
              {
                id: 'block-1',
                type: 'question_select',
                variant: 'mcq',
                prompt: {
                  type: 'rich_text',
                  format: 'md-math-v1',
                  value: 'What is $7+7$?',
                  mediaIds: [],
                },
                answer: {
                  options: [
                    {
                      id: 'a',
                      content: {
                        type: 'rich_text',
                        format: 'md-math-v1',
                        value: '14',
                        mediaIds: [],
                      },
                    },
                  ],
                  correctOptionIds: ['a'],
                },
              },
            ],
          },
        }) +
        '\n```',
    })

    const inputExercise = makeMockExercise('ex-7')
    const result = await generateVariation({ exercise: inputExercise, level: 'deep' }, mockPayload)

    expect(result.exercise).toBeDefined()
    const resultBlock = (result.exercise.content as { blocks: unknown[] }).blocks[0] as {
      prompt: { value: string }
    }
    expect(resultBlock.prompt.value).toBe('What is $7+7$?')
  })

  it('retries once and throws when LLM returns empty object missing content.blocks', async () => {
    const inputExercise = makeMockExercise('ex-8')
    let callCount = 0

    // Directly mock createGenkitUnifiedAdapter per-call to ensure fresh mock each loop iteration
    ;(createGenkitUnifiedAdapter as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++
      const chatCompletion = vi.fn().mockResolvedValueOnce({ text: '{}' })
      return { generateChatCompletion: chatCompletion }
    })

    await expect(
      generateVariation({ exercise: inputExercise, level: 'light' }, mockPayload),
    ).rejects.toThrow(VariationGenerationError)

    // Verify the retry mechanism triggered (adapter called twice: initial + one retry)
    expect(callCount).toBe(2)
  })
})
