import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for lesson-duplication-variation-service.
 *
 * Tests the generateVariation function with light/medium/deep levels and
 * subject routing, verifying two-pass behavior (creative + deterministic).
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

// Mock models — returns different temps per model key
vi.mock('@/infra/llm/models', () => ({
  getModelRegistryEntry: vi.fn((key: string) => {
    if (key === 'LESSON_DUPLICATION_VARIATION_CREATIVE') {
      return { temperature: 0.7, maxOutputTokens: 8192, capabilities: ['chat', 'generation'] }
    }
    if (key === 'LESSON_DUPLICATION_VARIATION_DETERMINISTIC') {
      return { temperature: 0.0, maxOutputTokens: 8192, capabilities: ['chat', 'generation'] }
    }
    return { temperature: 0.3, maxOutputTokens: 8192, capabilities: ['chat', 'generation'] }
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
    vi.resetAllMocks()
    mockGenerateChatCompletion = vi.fn()
    ;(createGenkitUnifiedAdapter as ReturnType<typeof vi.fn>).mockResolvedValue({
      generateChatCompletion: mockGenerateChatCompletion,
    })
  })

  // ── Two-pass: correct model keys and temperatures ────────────────────────

  it('pass1 uses LESSON_DUPLICATION_VARIATION_CREATIVE at temp 0.7, pass2 uses LESSON_DUPLICATION_VARIATION_DETERMINISTIC at temp 0.0', async () => {
    const callLog: Array<{ modelKey: string; temperature: number }> = []

    mockGenerateChatCompletion.mockImplementation(
      async ({ model }: { model: { modelKey?: string; temperature: number } }) => {
        callLog.push({ modelKey: model.modelKey ?? '', temperature: model.temperature })

        if (callLog.length === 1) {
          // Pass 1: creative output
          return {
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
                    hint: {
                      type: 'rich_text',
                      format: 'md-math-v1',
                      value: 'Add them.',
                      mediaIds: [],
                    },
                    solution: {
                      type: 'rich_text',
                      format: 'md-math-v1',
                      value: '3+3',
                      mediaIds: [],
                    },
                    fullSolution: {
                      type: 'rich_text',
                      format: 'md-math-v1',
                      value: '3+3=6',
                      mediaIds: [],
                    },
                    answer: {
                      options: [
                        {
                          id: 'a',
                          content: {
                            type: 'rich_text',
                            format: 'md-math-v1',
                            value: '6',
                            mediaIds: [],
                          },
                        },
                        {
                          id: 'b',
                          content: {
                            type: 'rich_text',
                            format: 'md-math-v1',
                            value: '9',
                            mediaIds: [],
                          },
                        },
                      ],
                      correctOptionIds: ['WRONG'],
                    },
                  },
                ],
              },
            }),
          }
        } else {
          // Pass 2: correct answer derivation
          return {
            text: JSON.stringify({
              solution: { type: 'rich_text', format: 'md-math-v1', value: '3+3=6', mediaIds: [] },
              fullSolution: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: 'Step 1: add 3+3=6',
                mediaIds: [],
              },
              answer: { correctOptionIds: ['a'] },
            }),
          }
        }
      },
    )

    const inputExercise = makeMockExercise('ex-two-pass-keys')
    const result = await generateVariation(
      { exercise: inputExercise, level: 'medium', subject: 'algebra' },
      mockPayload,
    )

    expect(callLog.length).toBe(2)
    expect(callLog[0]).toMatchObject({
      modelKey: 'LESSON_DUPLICATION_VARIATION_CREATIVE',
      temperature: 0.7,
    })
    expect(callLog[1]).toMatchObject({
      modelKey: 'LESSON_DUPLICATION_VARIATION_DETERMINISTIC',
      temperature: 0.0,
    })
    expect(result.exercise).toBeDefined()
  })

  it('pass2 correct_option overwrites the wrong pass1 correct_option', async () => {
    mockGenerateChatCompletion.mockImplementation(async () => {
      const callCount = mockGenerateChatCompletion.mock.calls.length

      if (callCount === 1) {
        // Pass 1: returns wrong correctOptionIds
        return {
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
                  solution: { type: 'rich_text', format: 'md-math-v1', value: '5+5', mediaIds: [] },
                  fullSolution: {
                    type: 'rich_text',
                    format: 'md-math-v1',
                    value: '5+5=10',
                    mediaIds: [],
                  },
                  answer: {
                    options: [
                      {
                        id: 'a',
                        content: {
                          type: 'rich_text',
                          format: 'md-math-v1',
                          value: '10',
                          mediaIds: [],
                        },
                      },
                      {
                        id: 'b',
                        content: {
                          type: 'rich_text',
                          format: 'md-math-v1',
                          value: '12',
                          mediaIds: [],
                        },
                      },
                    ],
                    correctOptionIds: ['WRONG'],
                  },
                },
              ],
            },
          }),
        }
      } else {
        // Pass 2: correct answer derivation
        return {
          text: JSON.stringify({
            solution: { type: 'rich_text', format: 'md-math-v1', value: '5+5=10', mediaIds: [] },
            fullSolution: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'Step 1: add 5+5=10',
              mediaIds: [],
            },
            answer: { correctOptionIds: ['a'] },
          }),
        }
      }
    })

    const inputExercise = makeMockExercise('ex-overwrite')
    const result = await generateVariation(
      { exercise: inputExercise, level: 'medium', subject: 'mixed' },
      mockPayload,
    )

    const resultBlock = (result.exercise.content as { blocks: unknown[] }).blocks[0] as {
      answer: { correctOptionIds: string[] }
    }
    expect(resultBlock.answer.correctOptionIds).toEqual(['a'])
  })

  // ── Single-pass tests (updated with subject param) ──────────────────────

  it('returns exercise with only numeric values changed for light level', async () => {
    mockGenerateChatCompletion.mockImplementation(async () => {
      const callCount = mockGenerateChatCompletion.mock.calls.length

      if (callCount === 1) {
        // Pass 1
        return {
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
                        content: {
                          type: 'rich_text',
                          format: 'md-math-v1',
                          value: '6',
                          mediaIds: [],
                        },
                      },
                      {
                        id: 'b',
                        content: {
                          type: 'rich_text',
                          format: 'md-math-v1',
                          value: '9',
                          mediaIds: [],
                        },
                      },
                    ],
                    correctOptionIds: ['a'],
                  },
                },
              ],
            },
          }),
        }
      } else {
        // Pass 2
        return {
          text: JSON.stringify({
            solution: { type: 'rich_text', format: 'md-math-v1', value: '3+3=6', mediaIds: [] },
            fullSolution: { type: 'rich_text', format: 'md-math-v1', value: '3+3=6', mediaIds: [] },
            answer: { correctOptionIds: ['a'] },
          }),
        }
      }
    })

    const inputExercise = makeMockExercise('ex-1')
    const result = await generateVariation(
      { exercise: inputExercise, level: 'light', subject: 'mixed' },
      mockPayload,
    )

    expect(result.exercise).toBeDefined()
    const resultBlock = (result.exercise.content as { blocks: unknown[] }).blocks[0] as {
      prompt: { value: string }
      answer: { options: Array<{ content: { value: string } }> }
    }
    expect(resultBlock.prompt.value).toBe('What is $3+3$?')
    expect(resultBlock.answer.options[0].content.value).toBe('6')
  })

  it('returns exercise with reworded phrasing for medium level', async () => {
    mockGenerateChatCompletion.mockImplementation(async () => {
      const callCount = mockGenerateChatCompletion.mock.calls.length

      if (callCount === 1) {
        return {
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
                  solution: { type: 'rich_text', format: 'md-math-v1', value: '2+2', mediaIds: [] },
                  fullSolution: {
                    type: 'rich_text',
                    format: 'md-math-v1',
                    value: '2+2=4',
                    mediaIds: [],
                  },
                  answer: {
                    options: [
                      {
                        id: 'a',
                        content: {
                          type: 'rich_text',
                          format: 'md-math-v1',
                          value: '3',
                          mediaIds: [],
                        },
                      },
                      {
                        id: 'b',
                        content: {
                          type: 'rich_text',
                          format: 'md-math-v1',
                          value: '4',
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
        }
      } else {
        return {
          text: JSON.stringify({
            solution: { type: 'rich_text', format: 'md-math-v1', value: '2+2=4', mediaIds: [] },
            fullSolution: { type: 'rich_text', format: 'md-math-v1', value: '2+2=4', mediaIds: [] },
            answer: { correctOptionIds: ['b'] },
          }),
        }
      }
    })

    const inputExercise = makeMockExercise('ex-2')
    const result = await generateVariation(
      { exercise: inputExercise, level: 'medium', subject: 'mixed' },
      mockPayload,
    )

    expect(result.exercise).toBeDefined()
    const resultBlock = (result.exercise.content as { blocks: unknown[] }).blocks[0] as {
      prompt: { value: string }
    }
    expect(resultBlock.prompt.value).toBe('Calculate $2+2$.')
  })

  it('may add/remove sections but produces no PNG fields for deep level', async () => {
    mockGenerateChatCompletion.mockImplementation(async () => {
      const callCount = mockGenerateChatCompletion.mock.calls.length

      if (callCount === 1) {
        return {
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
                  solution: {
                    type: 'rich_text',
                    format: 'md-math-v1',
                    value: '3x+6=12',
                    mediaIds: [],
                  },
                  fullSolution: {
                    type: 'rich_text',
                    format: 'md-math-v1',
                    value: '3x+6=12 → x=2',
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
        }
      } else {
        return {
          text: JSON.stringify({
            solution: { type: 'rich_text', format: 'md-math-v1', value: 'x=2', mediaIds: [] },
            fullSolution: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: '3x+6=12 → x=2',
              mediaIds: [],
            },
            answer: { correctOptionIds: ['b'] },
          }),
        }
      }
    })

    const inputExercise = makeMockExercise('ex-3')
    const result = await generateVariation(
      { exercise: inputExercise, level: 'deep', subject: 'mixed' },
      mockPayload,
    )

    expect(result.exercise).toBeDefined()
    const resultText = JSON.stringify(result.exercise)
    expect(resultText).not.toMatch(/\.png/i)
    expect(resultText).not.toMatch(/image\/png/i)
  })

  // ── Error handling tests ─────────────────────────────────────────────────

  it('pass1 retry exhausted throws VariationGenerationError', async () => {
    // First call returns invalid JSON → retry → still invalid → throw
    mockGenerateChatCompletion.mockResolvedValueOnce({ text: 'not json {' })
    mockGenerateChatCompletion.mockResolvedValueOnce({ text: 'still not json' })

    const inputExercise = makeMockExercise('ex-pass1-fail')

    await expect(
      generateVariation({ exercise: inputExercise, level: 'light', subject: 'mixed' }, mockPayload),
    ).rejects.toThrow(VariationGenerationError)

    // 2 calls (initial + retry)
    expect(mockGenerateChatCompletion).toHaveBeenCalledTimes(2)
  })

  it('pass2 retry exhausted throws VariationGenerationError (pass1 succeeds)', async () => {
    let callCount = 0
    mockGenerateChatCompletion.mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        // Pass 1: success
        return {
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
                  answer: { options: [], correctOptionIds: ['a'] },
                },
              ],
            },
          }),
        }
      } else if (callCount === 2) {
        // Pass 2: invalid JSON
        return { text: 'not json {' }
      } else {
        // Pass 2 retry: still invalid
        return { text: 'still not json' }
      }
    })

    const inputExercise = makeMockExercise('ex-pass2-fail')

    await expect(
      generateVariation(
        { exercise: inputExercise, level: 'medium', subject: 'algebra' },
        mockPayload,
      ),
    ).rejects.toThrow(VariationGenerationError)

    // 3 calls: pass1, pass2 (fail), pass2 retry (fail)
    expect(mockGenerateChatCompletion).toHaveBeenCalledTimes(3)
  })

  it('logs latency, level, subject, exerciseId per successful call', async () => {
    mockGenerateChatCompletion.mockImplementation(async () => {
      const callCount = mockGenerateChatCompletion.mock.calls.length

      if (callCount === 1) {
        return {
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
                  answer: { options: [], correctOptionIds: ['a'] },
                },
              ],
            },
          }),
        }
      } else {
        return {
          text: JSON.stringify({
            solution: { type: 'rich_text', format: 'md-math-v1', value: '5+5=10', mediaIds: [] },
            fullSolution: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: '5+5=10',
              mediaIds: [],
            },
            answer: { correctOptionIds: ['a'] },
          }),
        }
      }
    })

    const inputExercise = makeMockExercise('ex-log')
    await generateVariation(
      { exercise: inputExercise, level: 'light', subject: 'geometry' },
      mockPayload,
    )

    // Last log call is the two-pass complete log
    const logCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls
    const logObject = logCalls[logCalls.length - 1][0] as Record<string, unknown>
    expect(logObject).toHaveProperty('latencyMs')
    expect(logObject).toHaveProperty('level', 'light')
    expect(logObject).toHaveProperty('subject', 'geometry')
    expect(logObject).toHaveProperty('exerciseId', 'ex-log')
  })

  it('throws VariationGenerationError with correct exerciseId on non-retryable error', async () => {
    mockGenerateChatCompletion.mockImplementation(() => Promise.reject(new Error('API timeout')))

    const inputExercise = makeMockExercise('ex-api-fail')

    let error: unknown
    try {
      await generateVariation(
        { exercise: inputExercise, level: 'medium', subject: 'calculus' },
        mockPayload,
      )
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(VariationGenerationError)
    expect((error as VariationGenerationError).exerciseId).toBe('ex-api-fail')
    expect((error as VariationGenerationError).reason).toBe('API timeout')

    // Only one call made (non-JSON error = no retry)
    expect(mockGenerateChatCompletion).toHaveBeenCalledTimes(1)
  })

  // ── Schema-constrained output ────────────────────────────────────────────

  it('uses adapter `output` when present, even with empty `text` (Gemini responseSchema path)', async () => {
    // Simulates the production failure path: Genkit's structured-output mode
    // populates `result.output` but `result.text` comes back empty / non-JSON.
    // Before the fix, parseVariationResponseFromText would throw "Response
    // missing required content.blocks field" on the empty text.
    mockGenerateChatCompletion.mockImplementation(async () => {
      const callCount = mockGenerateChatCompletion.mock.calls.length
      if (callCount === 1) {
        return {
          text: '',
          output: {
            content: {
              blocks: [
                {
                  id: 'block-1',
                  type: 'question_select',
                  variant: 'mcq',
                  prompt: {
                    type: 'rich_text',
                    format: 'md-math-v1',
                    value: 'What is $4+4$?',
                    mediaIds: [],
                  },
                  answer: { options: [], correctOptionIds: ['a'] },
                },
              ],
            },
          },
        }
      }
      return {
        text: '',
        output: {
          solution: { type: 'rich_text', format: 'md-math-v1', value: '4+4=8', mediaIds: [] },
          fullSolution: { type: 'rich_text', format: 'md-math-v1', value: '4+4=8', mediaIds: [] },
          answer: { correctOptionIds: ['a'] },
        },
      }
    })

    const result = await generateVariation(
      { exercise: makeMockExercise('ex-output-path'), level: 'medium', subject: 'algebra' },
      mockPayload,
    )

    const block = (result.exercise.content as { blocks: unknown[] }).blocks[0] as {
      prompt: { value: string }
      answer: { correctOptionIds: string[] }
    }
    expect(block.prompt.value).toBe('What is $4+4$?')
    expect(block.answer.correctOptionIds).toEqual(['a'])
  })

  it('falls back to `text` parsing when `output` is missing (free-text fallback path)', async () => {
    // Adapter didn't populate `output` (e.g. outputSchema was rejected or
    // provider returned free text). Service should JSON.parse `text` instead.
    mockGenerateChatCompletion.mockImplementation(async () => {
      const callCount = mockGenerateChatCompletion.mock.calls.length
      if (callCount === 1) {
        return {
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
                    value: 'Fallback?',
                    mediaIds: [],
                  },
                  answer: { options: [], correctOptionIds: ['a'] },
                },
              ],
            },
          }),
        }
      }
      return {
        text: JSON.stringify({
          solution: { type: 'rich_text', format: 'md-math-v1', value: 's', mediaIds: [] },
          fullSolution: { type: 'rich_text', format: 'md-math-v1', value: 'fs', mediaIds: [] },
          answer: { correctOptionIds: ['a'] },
        }),
      }
    })

    const result = await generateVariation(
      { exercise: makeMockExercise('ex-text-fallback'), level: 'light', subject: 'algebra' },
      mockPayload,
    )

    const block = (result.exercise.content as { blocks: unknown[] }).blocks[0] as {
      prompt: { value: string }
    }
    expect(block.prompt.value).toBe('Fallback?')
  })

  it('passes a per-exercise input-derived schema to pass 1 and a Zod schema to pass 2', async () => {
    const callInputs: Array<{
      outputSchema?: unknown
      outputJsonSchema?: unknown
      modelVersion?: unknown
    }> = []

    mockGenerateChatCompletion.mockImplementation(
      async (input: {
        outputSchema?: unknown
        outputJsonSchema?: unknown
        modelVersion?: unknown
      }) => {
        callInputs.push({
          outputSchema: input.outputSchema,
          outputJsonSchema: input.outputJsonSchema,
          modelVersion: input.modelVersion,
        })
        const callCount = callInputs.length

        if (callCount === 1) {
          return {
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
                      value: 'What?',
                      mediaIds: [],
                    },
                    answer: { options: [], correctOptionIds: ['a'] },
                  },
                ],
              },
            }),
          }
        }
        return {
          text: JSON.stringify({
            solution: { type: 'rich_text', format: 'md-math-v1', value: 's', mediaIds: [] },
            fullSolution: { type: 'rich_text', format: 'md-math-v1', value: 'fs', mediaIds: [] },
            answer: { correctOptionIds: ['a'] },
          }),
        }
      },
    )

    await generateVariation(
      { exercise: makeMockExercise('ex-schema'), level: 'medium', subject: 'algebra' },
      mockPayload,
    )

    expect(callInputs).toHaveLength(2)
    // Pass 1: raw JSON schema derived from the input exercise.
    expect(callInputs[0].outputSchema).toBeUndefined()
    expect(callInputs[0].outputJsonSchema).toBeDefined()
    const pass1Schema = callInputs[0].outputJsonSchema as {
      type: string
      properties?: { content?: { properties?: { blocks?: unknown } } }
    }
    expect(pass1Schema.type).toBe('object')
    expect(pass1Schema.properties?.content?.properties?.blocks).toBeDefined()
    // Pass 2: Zod schema for the small derivation envelope.
    expect(callInputs[1].outputJsonSchema).toBeUndefined()
    expect(callInputs[1].outputSchema).toBeDefined()
    expect(typeof (callInputs[1].outputSchema as { parse?: unknown }).parse).toBe('function')
    // Both passes pin gemini-3.1-pro-preview.
    expect(callInputs[0].modelVersion).toBe('gemini-3.1-pro-preview')
    expect(callInputs[1].modelVersion).toBe('gemini-3.1-pro-preview')
  })

  it('strips markdown code fences from LLM response', async () => {
    let callCount = 0
    mockGenerateChatCompletion.mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        return {
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
                    answer: { options: [], correctOptionIds: ['a'] },
                  },
                ],
              },
            }) +
            '\n```',
        }
      } else {
        return {
          text: JSON.stringify({
            solution: { type: 'rich_text', format: 'md-math-v1', value: '7+7=14', mediaIds: [] },
            fullSolution: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: '7+7=14',
              mediaIds: [],
            },
            answer: { correctOptionIds: ['a'] },
          }),
        }
      }
    })

    const inputExercise = makeMockExercise('ex-fence')
    const result = await generateVariation(
      { exercise: inputExercise, level: 'deep', subject: 'mixed' },
      mockPayload,
    )

    expect(result.exercise).toBeDefined()
    const resultBlock = (result.exercise.content as { blocks: unknown[] }).blocks[0] as {
      prompt: { value: string }
    }
    expect(resultBlock.prompt.value).toBe('What is $7+7$?')
  })
})
