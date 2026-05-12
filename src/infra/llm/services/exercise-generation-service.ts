/**
 * Exercise Generation Service
 * Generates AI-powered exercises for lessons
 * Server-side only — content is persisted to DB, never sent to client
 *
 * @fileType service
 * @domain exercises
 * @pattern llm-service
 * @ai-summary Generates exercises using AI based on lesson context and admin prompt
 */
import type { Payload } from 'payload'
import type { AIModel, AIModelKey } from '../models'
import { getModelRegistryEntry, getProviderModelName } from '../models'
import { EXERCISE_GENERATION_PROMPT } from '../prompts/exercise-generation'
import { LLMProviderType } from '../providers/types'
import { logger } from '@/infra/utils/logger'

export type ExerciseType = 'mcq' | 'true_false' | 'free_response' | 'table' | 'mixed'

export interface ExerciseGenerationInput {
  lessonTitle: string
  lessonDescription?: string
  chapterTitle?: string
  courseTitle?: string
  adminPrompt: string
  exerciseType: ExerciseType
  count: number
}

export interface GeneratedExercise {
  type: 'question_select' | 'question_free_response' | 'question_table'
  prompt: string
  options?: Array<{ id: string; label: string; correct: boolean }>
  answer?: string | string[]
  table?: {
    headers: string[]
    rowsData: string[][]
    answers: Record<string, string>
  }
  hint: string
  solution: string
  fullSolution: string
}

export interface ExerciseGenerationResponse {
  success: boolean
  data?: GeneratedExercise[]
  error?: string
}

function buildUserPrompt(input: ExerciseGenerationInput): string {
  const contextParts: string[] = []

  if (input.courseTitle) {
    contextParts.push(`קורס: ${input.courseTitle}`)
  }
  if (input.chapterTitle) {
    contextParts.push(`פרק: ${input.chapterTitle}`)
  }
  if (input.lessonTitle) {
    contextParts.push(`שיעור: ${input.lessonTitle}`)
  }
  if (input.lessonDescription) {
    contextParts.push(`תיאור השיעור: ${input.lessonDescription}`)
  }

  const context = contextParts.length > 0 ? `## הקשר השיעור\n${contextParts.join('\n')}\n\n` : ''

  const exerciseTypeInstructions: Record<ExerciseType, string> = {
    mcq: 'צור תרגילי בחירה מרובה (MCQ) עם 4 אפשרויות',
    true_false: 'צור תרגילי נכון/לא נכון',
    free_response: 'צור תרגילי תשובה חופשית',
    table: 'צור תרגילי השלמת טבלה',
    mixed: 'ערבב בין סוגי התרגילים השונים (בחירה מרובה, נכון/לא נכון, תשובה חופשית, טבלה)',
  }

  return `${context}## הנחיות המורה
${input.adminPrompt}

## דרישות לסוג התרגיל
${exerciseTypeInstructions[input.exerciseType]}

## דרישות כלליות
- צור בדיוק ${input.count} תרגילים
- התרגילים מיועדים לתלמידי כיתה ז' (גיל 12-13)
- כל התרגילים חייבים להיות בעברית
- השתמש ב-$$LaTeX$$ לביטויים מתמטיים
- כל תרגיל חייב לכלול: תרגיל, רמז, פתרון (שאלה מכוונת), ופתרון מלא`
}

export async function generateExercises(
  input: ExerciseGenerationInput,
  payload: Payload,
): Promise<ExerciseGenerationResponse> {
  try {
    const { createGenkitUnifiedAdapter } = await import('../genkit/adapters/unified-adapter')
    const adapter = await createGenkitUnifiedAdapter(payload)
    const modelConfig = resolveModelConfig('SUPPORT_GENERATION')
    const userPrompt = buildUserPrompt(input)

    const result = await adapter.generateChatCompletion(
      {
        system: EXERCISE_GENERATION_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        model: modelConfig,
        acknowledgment: 'Generating exercises',
      },
      payload,
    )

    logger.info(
      { rawLength: result.text.length, raw: result.text.slice(0, 500) },
      '[Exercise Generation] Raw LLM response',
    )

    const parsed = parseLLMResponse(result.text)

    // Validate we got exercises
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      logger.error('[Exercise Generation] No exercises parsed from LLM response')
      return { success: false, error: 'Failed to parse exercises from LLM response' }
    }

    logger.info({ exerciseCount: parsed.length }, '[Exercise Generation] Parsed exercises')

    return { success: true, data: parsed }
  } catch (error) {
    logger.error({ err: error }, '[Exercise Generation] LLM call failed')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

function parseLLMResponse(text: string): GeneratedExercise[] {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim()

  const parsed = JSON.parse(cleaned)

  if (!Array.isArray(parsed)) {
    throw new Error('LLM response is not an array')
  }

  return parsed.map((item): GeneratedExercise => {
    // Validate required fields
    if (!item.prompt || !item.hint || !item.solution || !item.fullSolution) {
      throw new Error('Exercise missing required fields (prompt, hint, solution, fullSolution)')
    }

    const exercise: GeneratedExercise = {
      type: item.type || 'question_select',
      prompt: String(item.prompt),
      hint: String(item.hint),
      solution: String(item.solution),
      fullSolution: String(item.fullSolution),
    }

    if (exercise.type === 'question_table') {
      exercise.table = item.table || {
        headers: ['Column 1', 'Column 2'],
        rowsData: [['', '']],
        answers: {},
      }
    } else if (exercise.type === 'question_free_response') {
      exercise.answer = item.answer || ''
    } else {
      // question_select (MCQ or True/False)
      exercise.options = Array.isArray(item.options) ? item.options : []
      exercise.answer = item.answer || ''
    }

    return exercise
  })
}

function resolveModelConfig(modelKey: AIModelKey): AIModel {
  const entry = getModelRegistryEntry(modelKey)
  return {
    name: getProviderModelName(LLMProviderType.GEMINI, modelKey),
    ...entry,
    modelKey,
  }
}
