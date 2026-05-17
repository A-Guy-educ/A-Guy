/**
 * Exercise Generation Service
 *
 * Generates exercise question blocks using AI.
 * Designed for resilience: creates empty exercise shells first, then
 * populates content one at a time so partial results survive rate limits.
 *
 * Two-phase flow:
 * 1. createEmptyExercises() — creates N draft exercises in DB (no AI)
 * 2. generateExerciseContent() — AI generates content for each exercise individually
 *
 * @fileType utility
 * @domain exercises
 * @ai-summary Generates exercise question blocks with AI, resilient to rate limits
 */
import type { Payload } from 'payload'
import type { AIModel, AIModelKey } from '../models'
import { getModelRegistryEntry, getProviderModelName } from '../models'
import {
  EXERCISE_GENERATION_PROMPT,
  buildExerciseGenerationUserPrompt,
} from '../prompts/exercise-generation'
import { LLMProviderType } from '../providers/types'
import { logger } from '@/infra/utils/logger'
import type { ContentBlock } from '@/server/payload/collections/Exercises/schemas'
import { generateId } from '@/server/payload/collections/Exercises/defaults'

export interface ExerciseGenerationInput {
  prompt: string
  lessonId: string
  exerciseIndex: number
  difficultyLevel?: 'easy' | 'medium' | 'hard'
}

export interface GeneratedExerciseContent {
  blocks: ContentBlock[]
}

export interface ExerciseGenerationResponse {
  success: boolean
  data?: GeneratedExerciseContent
  error?: string
}

export async function generateExerciseContent(
  input: ExerciseGenerationInput,
  payload: Payload,
): Promise<ExerciseGenerationResponse> {
  try {
    const { createGenkitUnifiedAdapter } = await import('../genkit/adapters/unified-adapter')
    const adapter = await createGenkitUnifiedAdapter(payload)
    const modelConfig = resolveModelConfig('EXERCISE_GENERATION')
    const userPrompt = buildExerciseGenerationUserPrompt(input.prompt, input.exerciseIndex)

    const result = await adapter.generateChatCompletion(
      {
        system: EXERCISE_GENERATION_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        model: modelConfig,
        acknowledgment: 'Generating exercise content',
      },
      payload,
    )

    logger.info(
      { rawLength: result.text.length, raw: result.text.slice(0, 500) },
      '[Exercise Generation] Raw LLM response',
    )

    const parsed = parseLLMResponse(result.text)
    if (!parsed) {
      return { success: false, error: 'Failed to parse LLM response' }
    }

    logger.info(
      { exerciseIndex: input.exerciseIndex, blocksCount: parsed.blocks?.length ?? 0 },
      '[Exercise Generation] Parsed blocks',
    )

    return { success: true, data: parsed }
  } catch (error) {
    logger.error(
      { err: error, exerciseIndex: input.exerciseIndex },
      '[Exercise Generation] LLM call failed',
    )
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Create N empty draft exercises in the database for a lesson.
 * This is the "script phase" — no AI involved, always succeeds.
 *
 * Returns array of created exercise IDs in order.
 */
export async function createEmptyExercises(
  lessonId: string,
  count: number,
  payload: Payload,
): Promise<string[]> {
  const exerciseIds: string[] = []

  for (let i = 0; i < count; i++) {
    const exercise = await payload.create({
      collection: 'exercises',
      data: {
        title: `תרגיל ${i + 1}`,
        lesson: lessonId,
        content: { blocks: [] },
        status: 'draft',
      } as never,
      overrideAccess: true,
    })
    exerciseIds.push(exercise.id)
    logger.info(
      { exerciseId: exercise.id, index: i },
      '[Exercise Generation] Created empty exercise',
    )
  }

  return exerciseIds
}

/**
 * Update a single exercise with AI-generated content.
 * Returns the updated exercise ID on success.
 */
export async function updateExerciseWithContent(
  exerciseId: string,
  blocks: ContentBlock[],
  payload: Payload,
): Promise<{ success: boolean; error?: string }> {
  try {
    await payload.update({
      collection: 'exercises',
      id: exerciseId,
      data: { content: { blocks } } as never,
      overrideAccess: true,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.error(
      { err: exerciseId, error: message },
      '[Exercise Generation] Failed to update exercise',
    )
    return { success: false, error: message }
  }
}

function parseLLMResponse(text: string): GeneratedExerciseContent | null {
  try {
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    // Validate it has the basic structure we expect
    if (!parsed || typeof parsed !== 'object') return null

    // Ensure it has blocks array, even if empty
    const blocks: ContentBlock[] = Array.isArray(parsed.blocks)
      ? parsed.blocks.map(normalizeBlock)
      : []

    return { blocks }
  } catch {
    logger.warn({ text: text.slice(0, 200) }, '[Exercise Generation] JSON parse failed')
    return null
  }
}

/**
 * Normalize a raw parsed block to ensure it has all required fields.
 * Adds generated IDs where missing.
 */
function normalizeBlock(block: Record<string, unknown>): ContentBlock {
  // If it's already a valid ContentBlock shape, ensure it has an id
  if (block.id && typeof block.id === 'string') {
    return block as unknown as ContentBlock
  }

  // Add a generated ID if missing
  return {
    ...block,
    id: generateId(),
  } as unknown as ContentBlock
}

function resolveModelConfig(modelKey: AIModelKey): AIModel {
  const entry = getModelRegistryEntry(modelKey)
  return {
    name: getProviderModelName(LLMProviderType.GEMINI, modelKey),
    ...entry,
    modelKey,
  }
}
