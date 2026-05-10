/**
 * Unit tests for the Lesson Exercise Generation Service.
 * Tests the pure logic (parseLLMResponse via schema) and mocks the LLM adapter
 * for the main generateLessonExercises function.
 *
 * @fileType test
 * @domain exercises
 * @pattern lesson-exercise-generation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
    temperature: 0.4,
    maxOutputTokens: 8192,
    capabilities: ['chat', 'generation'],
  }),
  getProviderModelName: vi.fn().mockReturnValue('gemini-3.1-pro'),
}))

import { generateLessonExercises } from '@/infra/llm/services/lesson-exercise-generation-service'

const mockPayload = {} as never

// Helper: build a valid 10-exercise LLM response
function buildValidResponse(): string {
  const exercises = Array.from({ length: 10 }, (_, i) => ({
    title: `תרגיל ${i + 1}`,
    content: {
      blocks: [
        {
          id: `b-${i}`,
          type: 'question_free_response',
          prompt: {
            type: 'rich_text',
            format: 'md-math-v1',
            value: `שאלה ${i + 1}: $x^2 + ${i}x + ${i + 1} = 0$`,
            mediaIds: [],
          },
          answer: { acceptedAnswers: [`${i * 3}`] },
          hint: {
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'נסה לפרק לגורמים',
            mediaIds: [],
          },
          solution: {
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'מהו הדיסקרימיננטה של המשוואה?',
            mediaIds: [],
          },
          fullSolution: {
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'צעד 1: זהה מקדמים\nצעד 2: השתמש בנוסחת השורשים\nהתשובה: $x = ${i * 3}$',
            mediaIds: [],
          },
        },
      ],
    },
  }))
  return JSON.stringify({ exercises })
}

describe('generateLessonExercises', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed exercises on successful LLM call', async () => {
    mockGenerateChatCompletion.mockResolvedValueOnce({ text: buildValidResponse() })

    const result = await generateLessonExercises(
      {
        lessonTitle: 'Quadratic Equations',
        userPrompt: 'Generate 10 exercises about quadratics',
      },
      mockPayload,
    )

    expect(result.success).toBe(true)
    expect(result.data?.exercises).toHaveLength(10)
    expect(result.data?.exercises[0].title).toBe('תרגיל 1')
  })

  it('injects lessonTitle and lessonContextText into the user prompt', async () => {
    mockGenerateChatCompletion.mockResolvedValueOnce({ text: buildValidResponse() })

    await generateLessonExercises(
      {
        lessonTitle: 'My Lesson',
        lessonContextText: 'This is a context note about the lesson.',
        userPrompt: 'Make exercises about algebra',
      },
      mockPayload,
    )

    expect(mockGenerateChatCompletion).toHaveBeenCalledTimes(1)
    const callArg = mockGenerateChatCompletion.mock.calls[0][0] as {
      messages: { content: string }[]
    }
    const userMessage = callArg.messages[0].content as string
    expect(userMessage).toContain('My Lesson')
    expect(userMessage).toContain('This is a context note')
    expect(userMessage).toContain('Make exercises about algebra')
  })

  it('strips markdown code fences from LLM response', async () => {
    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: '```json\n' + buildValidResponse() + '\n```',
    })

    const result = await generateLessonExercises(
      {
        lessonTitle: 'Test',
        userPrompt: 'test prompt',
      },
      mockPayload,
    )

    expect(result.success).toBe(true)
    expect(result.data?.exercises).toHaveLength(10)
  })

  it('retries once on JSON parse failure', async () => {
    mockGenerateChatCompletion
      .mockResolvedValueOnce({ text: 'not valid json at all' })
      .mockResolvedValueOnce({ text: buildValidResponse() })

    const result = await generateLessonExercises(
      {
        lessonTitle: 'Test',
        userPrompt: 'test prompt',
      },
      mockPayload,
    )

    expect(result.success).toBe(true)
    expect(mockGenerateChatCompletion).toHaveBeenCalledTimes(2)
  })

  it('returns error after exhausting retries on JSON parse failure', async () => {
    mockGenerateChatCompletion
      .mockResolvedValueOnce({ text: 'still not json' })
      .mockResolvedValueOnce({ text: 'still not json again' })

    const result = await generateLessonExercises(
      {
        lessonTitle: 'Test',
        userPrompt: 'test prompt',
      },
      mockPayload,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(mockGenerateChatCompletion).toHaveBeenCalledTimes(2)
  })

  it('returns error on non-JSON LLM failure (network/API error)', async () => {
    mockGenerateChatCompletion.mockRejectedValueOnce(new Error('API key invalid'))

    const result = await generateLessonExercises(
      {
        lessonTitle: 'Test',
        userPrompt: 'test prompt',
      },
      mockPayload,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('API key invalid')
  })

  it('returns error when LLM returns wrong schema (non-10 exercises)', async () => {
    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: JSON.stringify({ exercises: [{ title: 'Only One' }] }),
    })

    const result = await generateLessonExercises(
      {
        lessonTitle: 'Test',
        userPrompt: 'test prompt',
      },
      mockPayload,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('returns error when LLM returns empty response', async () => {
    mockGenerateChatCompletion.mockResolvedValueOnce({ text: '' })

    const result = await generateLessonExercises(
      {
        lessonTitle: 'Test',
        userPrompt: 'test prompt',
      },
      mockPayload,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('handles missing lessonContextText gracefully', async () => {
    mockGenerateChatCompletion.mockResolvedValueOnce({ text: buildValidResponse() })

    const result = await generateLessonExercises(
      {
        lessonTitle: 'No Context Lesson',
        lessonContextText: null,
        userPrompt: 'some prompt',
      },
      mockPayload,
    )

    expect(result.success).toBe(true)
    expect(result.data?.exercises).toHaveLength(10)
  })
})
