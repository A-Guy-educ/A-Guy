/**
 * Lesson Exercise Generation Service
 *
 * Generates 10 educational exercises for a lesson from a user-provided dynamic prompt.
 * Uses LESSON_EXERCISE_GENERATION model key.
 *
 * @fileType service
 * @domain exercises
 * @pattern llm-generation
 */
import { z } from 'zod'
import type { Payload } from 'payload'
import type { AIModel, AIModelKey } from '@/infra/llm/models'
import { getModelRegistryEntry, getProviderModelName } from '@/infra/llm/models'
import { LLMProviderType } from '@/infra/llm/providers/types'
import { LESSON_EXERCISE_GENERATION_PROMPT } from '@/infra/llm/prompts/lesson-exercise-generation'
import { logger } from '@/infra/utils/logger'

export interface GenerateLessonExercisesInput {
  lessonTitle: string
  lessonContextText?: string | null
  userPrompt: string
}

const InlineRichTextSchema = z.object({
  type: z.literal('rich_text'),
  format: z.literal('md-math-v1'),
  value: z.string(),
  mediaIds: z.array(z.string()).default([]),
})

const FreeResponseBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('question_free_response'),
  prompt: InlineRichTextSchema,
  answer: z.object({ acceptedAnswers: z.array(z.string().min(1)).min(1) }),
  hint: InlineRichTextSchema.optional(),
  solution: InlineRichTextSchema.optional(),
  fullSolution: InlineRichTextSchema.optional(),
})

const GeneratedExerciseSchema = z.object({
  title: z.string().min(1),
  content: z.object({
    blocks: z.array(FreeResponseBlockSchema),
  }),
})

export const GeneratedExercisesSchema = z.object({
  exercises: z.array(GeneratedExerciseSchema).length(10),
})

export type ParsedGeneratedExercises = z.infer<typeof GeneratedExercisesSchema>

export interface LessonExerciseGenerationResult {
  success: boolean
  data?: ParsedGeneratedExercises
  error?: string
}

export async function generateLessonExercises(
  input: GenerateLessonExercisesInput,
  payload: Payload,
): Promise<LessonExerciseGenerationResult> {
  const { lessonTitle, lessonContextText, userPrompt } = input
  const requestId = crypto.randomUUID()

  try {
    const { createGenkitUnifiedAdapter } = await import('../genkit/adapters/unified-adapter')
    const adapter = await createGenkitUnifiedAdapter(payload)
    const modelConfig = resolveModelConfig('LESSON_EXERCISE_GENERATION')

    // Build context string from lesson info
    const lessonContext = lessonContextText ? `\nLesson context text:\n${lessonContextText}` : ''
    const fullUserPrompt = `Lesson title: ${lessonTitle}${lessonContext}

Content manager request:
${userPrompt}`

    let lastError: Error | null = null

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await adapter.generateChatCompletion(
          {
            system: LESSON_EXERCISE_GENERATION_PROMPT,
            messages: [{ role: 'user', content: fullUserPrompt }],
            model: modelConfig,
            acknowledgment: `Generating 10 exercises for lesson: ${lessonTitle}`,
          },
          payload,
        )

        const parsed = parseLLMResponse(result.text)
        logger.info(
          { requestId, attempt, exerciseCount: parsed.exercises?.length ?? 0 },
          '[LessonExerciseGeneration]',
        )

        return { success: true, data: parsed }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (!isJsonParseError(lastError)) {
          throw lastError // non-retryable
        }
        // retry
      }
    }

    // Exhausted retries
    throw lastError ?? new Error('Exhausted retries')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ requestId, err }, '[LessonExerciseGeneration] Failed')
    return { success: false, error: msg }
  }
}

function parseLLMResponse(text: string): ParsedGeneratedExercises {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim()

  const parsed = JSON.parse(cleaned)
  const result = GeneratedExercisesSchema.parse(parsed)
  return result
}

function resolveModelConfig(modelKey: AIModelKey): AIModel {
  const entry = getModelRegistryEntry(modelKey)
  return {
    name: getProviderModelName(LLMProviderType.GEMINI, modelKey),
    ...entry,
    modelKey,
  }
}

function isJsonParseError(error: Error): boolean {
  return (
    error instanceof SyntaxError ||
    error.message.includes('JSON') ||
    error.message.includes('parse')
  )
}
