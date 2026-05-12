import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for the pure functions in exercise-generation-service.
 * We test parseLLMResponse via the module's internal logic,
 * and mock the LLM adapter for the main generateExercises function.
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

// Mock generateId for transformToContentBlock tests
vi.mock('@/server/payload/collections/Exercises/defaults', () => ({
  generateId: vi.fn(() => 'test-generated-id'),
}))

import { generateExercises } from '@/infra/llm/services/exercise-generation-service'
import type { ExerciseType } from '@/infra/llm/services/exercise-generation-service'
import { transformToContentBlock } from '@/server/payload/endpoints/lessons/generate-exercises'

const mockPayload = {} as never

const sampleExercise = {
  type: 'question_select',
  prompt: 'פתור את המשוואה $$2x + 5 = 13$$',
  options: [
    { id: 'a', label: '$$x = 3$$', correct: false },
    { id: 'b', label: '$$x = 4$$', correct: true },
    { id: 'c', label: '$$x = 5$$', correct: false },
    { id: 'd', label: '$$x = 6$$', correct: false },
  ],
  hint: 'התחל בהעברת 5 לצד השני',
  solution: 'מה הפעולה ההפוכה של חיבור?',
  fullSolution: '$$2x + 5 = 13$$\nנעביר את 5: $$2x = 8$$\nנחלק ב-2: $$x = 4$$',
}

describe('generateExercises', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed exercises on success', async () => {
    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: JSON.stringify([sampleExercise]),
    })

    const result = await generateExercises(
      {
        lessonTitle: 'Linear Equations',
        adminPrompt: 'Create exercises about linear equations',
        exerciseType: 'mcq' as ExerciseType,
        count: 10,
      },
      mockPayload,
    )

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data?.[0].prompt).toBe(sampleExercise.prompt)
    expect(result.data?.[0].hint).toBe(sampleExercise.hint)
    expect(result.data?.[0].solution).toBe(sampleExercise.solution)
    expect(result.data?.[0].fullSolution).toBe(sampleExercise.fullSolution)
  })

  it('strips markdown code fences from LLM response', async () => {
    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: '```json\n' + JSON.stringify([sampleExercise]) + '\n```',
    })

    const result = await generateExercises(
      {
        lessonTitle: 'Linear Equations',
        adminPrompt: 'Create exercises',
        exerciseType: 'mixed' as ExerciseType,
        count: 10,
      },
      mockPayload,
    )

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
  })

  it('returns error on LLM failure', async () => {
    mockGenerateChatCompletion.mockRejectedValueOnce(new Error('API rate limit exceeded'))

    const result = await generateExercises(
      {
        lessonTitle: 'Linear Equations',
        adminPrompt: 'Create exercises',
        exerciseType: 'mcq' as ExerciseType,
        count: 10,
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

    const result = await generateExercises(
      {
        lessonTitle: 'Linear Equations',
        adminPrompt: 'Create exercises',
        exerciseType: 'mcq' as ExerciseType,
        count: 10,
      },
      mockPayload,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('returns error when LLM returns empty array', async () => {
    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: '[]',
    })

    const result = await generateExercises(
      {
        lessonTitle: 'Linear Equations',
        adminPrompt: 'Create exercises',
        exerciseType: 'mcq' as ExerciseType,
        count: 10,
      },
      mockPayload,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('Failed to parse exercises from LLM response')
  })

  it('handles free_response exercise type', async () => {
    const freeResponseExercise = {
      type: 'question_free_response',
      prompt: 'פתור: $$x^2 = 16$$',
      answer: ['4', '-4'],
      hint: 'חשבו על מה בריבוע נותן 16',
      solution: 'אילו מספרים בריבוע שלהם נותנים 16?',
      fullSolution: '$$x^2 = 16$$ → $$x = \\pm 4$$',
    }

    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: JSON.stringify([freeResponseExercise]),
    })

    const result = await generateExercises(
      {
        lessonTitle: 'Quadratic Equations',
        adminPrompt: 'Create free response exercises',
        exerciseType: 'free_response' as ExerciseType,
        count: 10,
      },
      mockPayload,
    )

    expect(result.success).toBe(true)
    expect(result.data?.[0].type).toBe('question_free_response')
    expect(result.data?.[0].answer).toEqual(['4', '-4'])
  })

  it('handles table exercise type', async () => {
    const tableExercise = {
      type: 'question_table',
      prompt: 'השלם את הטבלה:',
      table: {
        headers: ['x', 'x+2'],
        rowsData: [
          ['1', ''],
          ['2', ''],
          ['3', ''],
        ],
        answers: { '0-1': '3', '1-1': '4', '2-1': '5' },
      },
      hint: 'הוסף 2 לכל ערך של x',
      solution: 'מה מתקבל כשמוסיפים 2?',
      fullSolution: 'לכל שורה, הערך בעמודה השנייה הוא x+2',
    }

    mockGenerateChatCompletion.mockResolvedValueOnce({
      text: JSON.stringify([tableExercise]),
    })

    const result = await generateExercises(
      {
        lessonTitle: 'Linear Functions',
        adminPrompt: 'Create table exercises',
        exerciseType: 'table' as ExerciseType,
        count: 10,
      },
      mockPayload,
    )

    expect(result.success).toBe(true)
    expect(result.data?.[0].type).toBe('question_table')
    expect(result.data?.[0].table?.headers).toEqual(['x', 'x+2'])
  })
})

describe('transformToContentBlock', () => {
  const baseExercise = {
    prompt: 'Test prompt',
    hint: 'Test hint',
    solution: 'Test solution',
    fullSolution: 'Test full solution',
  }

  describe('MCQ fallback behavior', () => {
    it('falls back to option id "a" when no correct option is provided', () => {
      const mcqNoCorrect = {
        ...baseExercise,
        type: 'question_select' as const,
        options: [
          { id: 'a', label: 'Option A', correct: false },
          { id: 'b', label: 'Option B', correct: false },
          { id: 'c', label: 'Option C', correct: false },
          { id: 'd', label: 'Option D', correct: false },
        ],
      }

      const result = transformToContentBlock(mcqNoCorrect)

      expect(result.type).toBe('question_select')
      expect(
        (result as { answer: { correctOptionIds: string[] } }).answer.correctOptionIds,
      ).toEqual(['a'])
    })

    it('uses provided correct option id when available', () => {
      const mcqWithCorrect = {
        ...baseExercise,
        type: 'question_select' as const,
        options: [
          { id: 'a', label: 'Option A', correct: false },
          { id: 'b', label: 'Option B', correct: true },
          { id: 'c', label: 'Option C', correct: false },
          { id: 'd', label: 'Option D', correct: false },
        ],
      }

      const result = transformToContentBlock(mcqWithCorrect)

      expect(result.type).toBe('question_select')
      expect(
        (result as { answer: { correctOptionIds: string[] } }).answer.correctOptionIds,
      ).toEqual(['b'])
    })
  })

  describe('true/false fallback behavior', () => {
    it('falls back to "true" when no correct option is provided', () => {
      const tfNoCorrect = {
        ...baseExercise,
        type: 'question_select' as const,
        options: [
          { id: 'true', label: 'נכון', correct: false },
          { id: 'false', label: 'לא נכון', correct: false },
        ],
      }

      const result = transformToContentBlock(tfNoCorrect)

      expect(result.type).toBe('question_select')
      expect((result as { variant: string; answer: { correctOptionId: string } }).variant).toBe(
        'true_false',
      )
      expect((result as { answer: { correctOptionId: string } }).answer.correctOptionId).toBe(
        'true',
      )
    })

    it('uses provided correct option id when available', () => {
      const tfWithCorrect = {
        ...baseExercise,
        type: 'question_select' as const,
        options: [
          { id: 'true', label: 'נכון', correct: false },
          { id: 'false', label: 'לא נכון', correct: true },
        ],
      }

      const result = transformToContentBlock(tfWithCorrect)

      expect(result.type).toBe('question_select')
      expect((result as { answer: { correctOptionId: string } }).answer.correctOptionId).toBe(
        'false',
      )
    })
  })

  describe('table fallback behavior', () => {
    it('uses fallback table values when table field is missing', () => {
      const tableNoData = {
        ...baseExercise,
        type: 'question_table' as const,
        table: undefined,
      }

      const result = transformToContentBlock(tableNoData)

      expect(result.type).toBe('question_table')
      const tableResult = result as {
        table: { headers: string[]; rowsData: string[][]; answers: Record<string, string> }
      }
      expect(tableResult.table.headers).toEqual(['Column 1', 'Column 2'])
      expect(tableResult.table.rowsData).toEqual([['', '']])
      expect(tableResult.table.answers).toEqual({})
    })

    it('uses provided table data when available', () => {
      const tableWithData = {
        ...baseExercise,
        type: 'question_table' as const,
        table: {
          headers: ['x', 'x+2'],
          rowsData: [
            ['1', ''],
            ['2', ''],
          ],
          answers: { '0-1': '3', '1-1': '4' },
        },
      }

      const result = transformToContentBlock(tableWithData)

      expect(result.type).toBe('question_table')
      const tableResult = result as {
        table: { headers: string[]; rowsData: string[][]; answers: Record<string, string> }
      }
      expect(tableResult.table.headers).toEqual(['x', 'x+2'])
      expect(tableResult.table.rowsData).toEqual([
        ['1', ''],
        ['2', ''],
      ])
      expect(tableResult.table.answers).toEqual({ '0-1': '3', '1-1': '4' })
    })
  })

  describe('free_response handling', () => {
    it('wraps string answer in array', () => {
      const frString = {
        ...baseExercise,
        type: 'question_free_response' as const,
        answer: '42',
      }

      const result = transformToContentBlock(frString)

      expect(result.type).toBe('question_free_response')
      expect((result as { answer: { acceptedAnswers: string[] } }).answer.acceptedAnswers).toEqual([
        '42',
      ])
    })

    it('keeps array answer as-is', () => {
      const frArray = {
        ...baseExercise,
        type: 'question_free_response' as const,
        answer: ['4', '-4'],
      }

      const result = transformToContentBlock(frArray)

      expect(result.type).toBe('question_free_response')
      expect((result as { answer: { acceptedAnswers: string[] } }).answer.acceptedAnswers).toEqual([
        '4',
        '-4',
      ])
    })

    it('uses empty array when answer is missing', () => {
      const frNoAnswer = {
        ...baseExercise,
        type: 'question_free_response' as const,
        answer: undefined,
      }

      const result = transformToContentBlock(frNoAnswer)

      expect(result.type).toBe('question_free_response')
      expect((result as { answer: { acceptedAnswers: string[] } }).answer.acceptedAnswers).toEqual(
        [],
      )
    })
  })
})
