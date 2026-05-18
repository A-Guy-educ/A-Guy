/**
 * Unit tests for exercise-generation-service
 *
 * Tests the two-phase flow:
 * 1. createEmptyExercises — creates draft exercises without AI
 * 2. generateExerciseContent — generates content using AI
 * 3. updateExerciseWithContent — saves generated content to DB
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the genkit adapter
vi.mock('@/infra/llm/genkit/adapters/unified-adapter', () => ({
  createGenkitUnifiedAdapter: vi.fn(),
}))

// Mock logger
vi.mock('@/infra/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}))

// Mock models
vi.mock('@/infra/llm/models', () => ({
  getModelRegistryEntry: vi.fn().mockReturnValue({
    temperature: 0.5,
    maxOutputTokens: 8192,
    capabilities: ['chat', 'generation'],
  }),
  getProviderModelName: vi.fn().mockReturnValue('gemini-2.5-pro'),
}))

// Mock the prompt builder (test the service logic, not the prompt itself)
vi.mock('@/infra/llm/prompts/exercise-generation', () => ({
  EXERCISE_GENERATION_PROMPT: 'mock system prompt',
  buildExerciseGenerationUserPrompt: vi.fn().mockReturnValue('mock user prompt'),
}))

import {
  createEmptyExercises,
  generateExerciseContent,
  updateExerciseWithContent,
} from '@/infra/llm/services/exercise-generation-service'
import { createGenkitUnifiedAdapter } from '@/infra/llm/genkit/adapters/unified-adapter'
import { logger } from '@/infra/utils/logger'

const mockAdapter = {
  generateChatCompletion: vi.fn(),
}

const mockPayload = {
  create: vi.fn(),
  update: vi.fn(),
} as any

const mockReq = { user: { id: 'user-1' } }

beforeEach(() => {
  vi.clearAllMocks()
  ;(createGenkitUnifiedAdapter as ReturnType<typeof vi.fn>).mockResolvedValue(mockAdapter)
})

describe('createEmptyExercises', () => {
  it('creates the requested number of draft exercises', async () => {
    const createdIds = ['ex-1', 'ex-2', 'ex-3']
    let callCount = 0
    ;(mockPayload.create as ReturnType<typeof vi.fn>).mockImplementation(() => {
      return { id: createdIds[callCount++] }
    })

    const ids = await createEmptyExercises('lesson-1', 3, mockPayload)

    expect(ids).toEqual(['ex-1', 'ex-2', 'ex-3'])
    expect(mockPayload.create).toHaveBeenCalledTimes(3)
  })

  it('sets correct exercise fields on create', async () => {
    ;(mockPayload.create as ReturnType<typeof vi.fn>).mockImplementation(() => ({ id: 'ex-1' }))

    await createEmptyExercises('lesson-abc', 1, mockPayload)

    expect(mockPayload.create).toHaveBeenCalledWith({
      collection: 'exercises',
      data: {
        title: 'תרגיל 1',
        lesson: 'lesson-abc',
        content: {
          blocks: [
            {
              id: expect.any(String),
              type: 'rich_text',
              format: 'md-math-v1',
              value: '',
              mediaIds: [],
            },
          ],
        },
        status: 'draft',
      },
      overrideAccess: true,
    })
  })
})

describe('generateExerciseContent', () => {
  it('returns generated blocks on success', async () => {
    const mockBlocks = [
      {
        id: 'block-1',
        type: 'question_select',
        variant: 'mcq',
        selectionMode: 'single',
        prompt: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'What is $2+2$?',
          mediaIds: [],
        },
        answer: {
          multiSelect: false,
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
    ]

    mockAdapter.generateChatCompletion.mockResolvedValue({
      text: JSON.stringify({ blocks: mockBlocks }),
    })

    const result = await generateExerciseContent(
      { prompt: 'generate math exercise', lessonId: 'lesson-1', exerciseIndex: 1 },
      mockPayload,
    )

    expect(result.success).toBe(true)
    expect(result.data?.blocks).toHaveLength(1)
    expect(result.data?.blocks[0]).toMatchObject({ type: 'question_select' })
  })

  it('returns error on JSON parse failure', async () => {
    mockAdapter.generateChatCompletion.mockResolvedValue({ text: 'not valid json' })

    const result = await generateExerciseContent(
      { prompt: 'test', lessonId: 'lesson-1', exerciseIndex: 1 },
      mockPayload,
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('parse')
  })

  it('returns error on LLM exception', async () => {
    mockAdapter.generateChatCompletion.mockRejectedValue(new Error('Rate limit exceeded'))

    const result = await generateExerciseContent(
      { prompt: 'test', lessonId: 'lesson-1', exerciseIndex: 1 },
      mockPayload,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('Rate limit exceeded')
  })

  it('strips markdown code fences from response', async () => {
    mockAdapter.generateChatCompletion.mockResolvedValue({
      text: '```json\n{"blocks": []}\n```',
    })

    const result = await generateExerciseContent(
      { prompt: 'test', lessonId: 'lesson-1', exerciseIndex: 1 },
      mockPayload,
    )

    expect(result.success).toBe(true)
    expect(result.data?.blocks).toHaveLength(0)
  })
})

describe('updateExerciseWithContent', () => {
  it('updates exercise with blocks content', async () => {
    const blocks = [{ id: 'block-1', type: 'question_select' }] as never
    ;(mockPayload.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'ex-1' })

    const result = await updateExerciseWithContent('ex-1', blocks, mockPayload)

    expect(result.success).toBe(true)
    expect(mockPayload.update).toHaveBeenCalledWith({
      collection: 'exercises',
      id: 'ex-1',
      data: { content: { blocks } },
      overrideAccess: true,
    })
  })

  it('returns error on update failure', async () => {
    ;(mockPayload.update as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'))
    const blocks = [{ id: 'block-1' }] as never

    const result = await updateExerciseWithContent('ex-1', blocks, mockPayload)

    expect(result.success).toBe(false)
    expect(result.error).toBe('DB error')
  })
})
